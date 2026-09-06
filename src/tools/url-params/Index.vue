<script setup lang="ts">
import { computed, ref } from 'vue'
import { Copy, Plus, Trash2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import ToolLayout from '@/components/ToolLayout.vue'
import { copyText } from '@/lib/utils'

const url = ref('')
const error = ref('')

// 期望的 param 键（占位，可为空）
interface Row {
  key: string
  value: string
}
const rows = ref<Row[]>([])

// 拆分 query 供编辑
function parseIntoRows() {
  error.value = ''
  let q = ''
  try {
    const u = new URL(url.value, 'http://localhost')
    q = u.search.replace(/^\?/, '')
  } catch {
    error.value = 'URL 格式不合法'
    return
  }
  if (!q) {
    rows.value = []
    return
  }
  rows.value = [...new URLSearchParams(q).entries()].map(([key, value]) => ({ key, value }))
}

// 依据 rows 重建 URL
const rebuilt = computed(() => {
  if (!url.value) return ''
  try {
    const u = new URL(url.value, 'http://localhost')
    const sp = new URLSearchParams()
    for (const r of rows.value) if (r.key !== '') sp.append(r.key, r.value)
    const qs = sp.toString()
    return `${u.origin}${u.pathname}${u.search.slice(0, 0) ? u.search.slice(0, 0) : ''}${qs ? `?${qs}` : ''}${u.hash}`
  } catch {
    return ''
  }
})

function addRow() {
  rows.value.push({ key: '', value: '' })
}
function removeRow(i: number) {
  rows.value.splice(i, 1)
}

const count = computed(() => rows.value.filter(r => r.key !== '').length)

function copyResult() {
  if (rebuilt.value) copyText(rebuilt.value)
}
</script>

<template>
  <ToolLayout>
    <div class="space-y-4">
      <Textarea
        v-model="url"
        placeholder="http://example.com/path?a=1&b=hello%20world&arr=1&arr=2"
        class="min-h-[90px] font-mono text-xs"
      />
      <p v-if="error" class="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
        {{ error }}
      </p>

      <Button size="sm" @click="parseIntoRows">
        <Copy class="rotate-90 h-4 w-4" /> 解析查询参数
      </Button>

      <!-- 参数列表 -->
      <div v-if="rows.length" class="space-y-2">
        <div class="flex items-center justify-between text-xs text-muted-foreground">
          <span>共 {{ count }} 个参数</span>
          <Button size="sm" variant="outline" @click="addRow">
            <Plus class="h-3.5 w-3.5" /> 添加
          </Button>
        </div>

        <div
          v-for="(r, i) in rows"
          :key="i"
          class="flex items-center gap-2"
        >
          <Input v-model="r.key" placeholder="参数名" class="font-mono text-xs" />
          <span class="text-muted-foreground">=</span>
          <Input v-model="r.value" placeholder="值" class="flex-1 font-mono text-xs" />
          <Button variant="ghost" size="icon" class="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" @click="removeRow(i)">
            <Trash2 class="h-4 w-4" />
          </Button>
        </div>

        <div class="space-y-1.5">
          <Label class="text-xs text-muted-foreground">重组后的 URL</Label>
          <pre class="overflow-auto whitespace-pre-wrap break-all rounded-md border bg-muted/50 p-3 font-mono text-xs">
            {{ rebuilt || '（结果）' }}
          </pre>
          <Button v-if="rebuilt" size="sm" variant="outline" @click="copyResult">
            <Copy class="h-3.5 w-3.5" /> 复制
          </Button>
        </div>
      </div>

      <p v-else class="text-xs text-muted-foreground">
        输入 URL 后点击「解析查询参数」，参数将拆分到下方可编辑，修改后自动重组 URL。
      </p>
    </div>
  </ToolLayout>
</template>