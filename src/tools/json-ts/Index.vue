<script setup lang="ts">
import { ref } from 'vue'
import { Check, Copy, FileJson2 } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import ToolLayout from '@/components/ToolLayout.vue'
import { copyText } from '@/lib/utils'

const input = ref('')
const output = ref('')
const error = ref('')
const copied = ref(false)
const expandNamedTypes = ref(true)

let typeCounter = 0
let namedBlocks: string[] = []

/** 生成一份命名的类型：对象 → 命名接口，其它 → 内联表达式 */
function toNamed(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) {
    if (value.length === 0) return 'unknown[]'
    let sample: unknown = null
    for (const v of value) {
      if (v !== null) { sample = v; break }
    }
    let e = toNamed(sample)
    if (value.some(v => v === null)) e = e.includes('|') ? `(${e}) | null` : `${e} | null`
    return `${e}[]`
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const keys = Object.keys(obj)
    if (keys.length === 0) return 'Record<string, unknown>'
    const name = `Type${++typeCounter}`
    const lines = keys.map((k) => {
      const validKey = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : `'${k}'`
      return `  ${validKey}: ${toNamed(obj[k])};`
    })
    namedBlocks.push(`${name} {\n${lines.join('\n')}\n}`)
    return name
  }
  return typeof value
}

/** 生成内联展开的类型（不产生命名接口） */
function toInline(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) {
    if (value.length === 0) return 'unknown[]'
    let sample: unknown = null
    for (const v of value) {
      if (v !== null) { sample = v; break }
    }
    let e = toInline(sample)
    if (value.some(v => v === null)) e = e.includes('|') ? `(${e}) | null` : `${e} | null`
    return `${e}[]`
  }
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const keys = Object.keys(obj)
    if (keys.length === 0) return 'Record<string, unknown>'
    const props = keys.map((k) => {
      const validKey = /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(k) ? k : `'${k}'`
      return `${validKey}: ${toInline(obj[k])}`
    })
    return `{ ${props.join(', ')} }`
  }
  return typeof value
}

function convert() {
  error.value = ''
  copied.value = false
  output.value = ''
  if (!input.value.trim()) return
  let parsed: unknown
  try {
    parsed = JSON.parse(input.value)
  } catch (e) {
    error.value = `JSON 解析失败：${(e as Error).message}`
    return
  }

  if (expandNamedTypes.value) {
    typeCounter = 0
    namedBlocks = []
    const rootType = toNamed(parsed)
    if (namedBlocks.length && rootType.startsWith('Type')) {
      namedBlocks[0] = namedBlocks[0].replace('Type1 {', 'RootInterface {')
    }
    const unique = Array.from(new Set(namedBlocks))
    const rootRef = namedBlocks.length ? 'RootInterface' : rootType
    output.value = [...unique, '', `export type Root = ${rootRef};`].join('\n\n')
  } else {
    output.value = `export type Root = ${toInline(parsed)};`
  }
}

async function doCopy() {
  if (await copyText(output.value)) {
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  }
}
</script>

<template>
  <ToolLayout>
    <div class="grid gap-4 lg:grid-cols-2">
      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <Label class="flex items-center gap-2 text-sm"><FileJson2 class="h-4 w-4" /> JSON 输入</Label>
          <label class="flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground" for="named-switch">
            生成命名类型
            <Switch v-model="expandNamedTypes" id="named-switch" class="scale-90" />
          </label>
        </div>
        <Textarea
          v-model="input"
          :rows="18"
          class="h-[420px] resize-none font-mono text-xs"
          placeholder='{"name": "Trae", "tags": ["sdk", "api"], "meta": {"enabled": true}}'
        />
        <div class="flex items-center justify-between">
          <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
          <Button size="sm" :disabled="!input.trim()" @click="convert">转换</Button>
        </div>
      </div>

      <div class="space-y-2">
        <div class="flex items-center justify-between">
          <Label class="flex items-center gap-2 text-sm"><FileJson2 class="h-4 w-4" /> TypeScript 类型</Label>
          <Button size="sm" variant="outline" :disabled="!output" @click="doCopy">
            <Check v-if="copied" class="h-4 w-4" />
            <Copy v-else class="h-4 w-4" />
            {{ copied ? '已复制' : '复制' }}
          </Button>
        </div>
        <pre class="h-[420px] overflow-auto rounded-md border bg-card p-3 font-mono text-xs whitespace-pre-wrap">{{ output }}</pre>
        <Badge v-if="!error && output" variant="secondary" class="text-xs">生成成功</Badge>
      </div>
    </div>
  </ToolLayout>
</template>