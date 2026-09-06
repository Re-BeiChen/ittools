<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowDown, ArrowUp } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import ToolLayout from '@/components/ToolLayout.vue'

const input = ref('')
const output = ref('')
const error = ref('')
const firstRowHeader = ref(true)

/** 解析 CSV 为二维字符串数组，支持引号内换行、逗号、转义引号 */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += ch
      i++
    } else if (ch === '"') {
      inQuotes = true
      i++
    } else if (ch === ',') {
      row.push(field)
      field = ''
      i++
    } else if (ch === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i++
    } else if (ch === '\r') {
      i++ // 跳过 \r，交给 \n 处理
    } else {
      field += ch
      i++
    }
  }
  if (field !== '' || row.length) {
    row.push(field)
    rows.push(row)
  }
  // 去掉末尾空行
  while (rows.length && rows[rows.length - 1].every(c => c.trim() === '')) rows.pop()
  return rows
}

const preview = computed(() => {
  const rows = parseCsv(input.value)
  return rows.length ? rows : null
})

function toPlain(obj: unknown, seen = new Set<object>()): unknown {
  if (Array.isArray(obj)) return obj.map(x => toPlain(x, seen))
  if (obj && typeof obj === 'object') {
    if (seen.has(obj)) return '[Circular]'
    seen.add(obj)
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj)) out[k] = toPlain(v, seen)
    return out
  }
  return obj
}

function doCsvToJson() {
  error.value = ''
  try {
    const rows = parseCsv(input.value)
    if (!rows.length) {
      output.value = ''
      return
    }
    if (firstRowHeader.value) {
      const headers = rows[0].map(h => h.trim()).filter(Boolean)
      const data = rows.slice(1)
      output.value = JSON.stringify(
        data.map(r => {
          const obj: Record<string, string> = {}
          headers.forEach((h, idx) => {
            if (h) obj[h] = (r[idx] ?? '').trim()
          })
          return obj
        }),
        null, 2,
      )
    } else {
      const maxLen = Math.max(...rows.map(r => r.length))
      const data = rows.map(r => {
        const arr: (string | null)[] = [...r]
        while (arr.length < maxLen) arr.push(null)
        return arr
      })
      output.value = JSON.stringify(data, null, 2)
    }
  } catch (e) {
    error.value = (e as Error).message
  }
}

function toCsvCell(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = typeof v === 'string' ? v : JSON.stringify(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function doJsonToCsv() {
  error.value = ''
  try {
    const parsed = JSON.parse(input.value)
    const arr = Array.isArray(parsed) ? parsed : [parsed]
    if (!arr.length) {
      output.value = ''
      return
    }
    const objs = arr.filter(x => x && typeof x === 'object')
    if (!objs.length) {
      error.value = 'JSON 需为对象或对象数组'
      return
    }
    // 合并表头
    const cols: string[] = []
    for (const o of objs) {
      for (const k of Object.keys(toPlain(o) as object)) if (!cols.includes(k)) cols.push(k)
    }
    const lines = [cols.map(c => toCsvCell(c)).join(',')]
    for (const o of objs) {
      const plain = toPlain(o) as Record<string, unknown>
      lines.push(cols.map(c => toCsvCell((plain as Record<string, unknown>)[c])).join(','))
    }
    output.value = lines.join('\n')
  } catch {
    error.value = '请输入合法的 JSON'
  }
}
</script>

<template>
  <ToolLayout>
    <div class="space-y-4">
      <div class="flex flex-wrap items-center gap-4">
        <Button size="sm" @click="doCsvToJson">
          <ArrowDown /> CSV → JSON
        </Button>
        <Button size="sm" variant="secondary" @click="doJsonToCsv">
          <ArrowUp /> JSON → CSV
        </Button>
        <div class="flex items-center gap-2">
          <Switch v-model:checked="firstRowHeader" />
          <Label class="text-xs text-muted-foreground">首行作为表头（CSV → JSON）</Label>
        </div>
      </div>

      <Textarea
        v-model="input"
        placeholder="粘贴 CSV（逗号分隔，支持引号转义）或 JSON 数组"
        class="min-h-[180px] font-mono text-xs"
      />

      <pre class="min-h-[180px] overflow-auto whitespace-pre-wrap break-all rounded-md border bg-muted/50 p-3 font-mono text-xs">{{ output || '（结果）' }}</pre>

      <div v-if="preview && !output" class="text-xs text-muted-foreground">
        已识别 {{ preview.length }} 行 × {{ Math.max(...preview.map(r => r.length)) }} 列
      </div>

      <p v-if="error" class="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
        {{ error }}
      </p>
    </div>
  </ToolLayout>
</template>