<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check, Copy, Minimize2, WrapText } from '@lucide/vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import ToolLayout from '@/components/ToolLayout.vue'
import { copyText } from '@/lib/utils'

const input = ref('')
const output = ref('')
const error = ref('')
const copied = ref(false)

function format(indent: number) {
  error.value = ''
  if (!input.value.trim()) {
    output.value = ''
    return
  }
  try {
    const obj = JSON.parse(input.value)
    output.value = JSON.stringify(obj, null, indent)
  } catch (e) {
    error.value = (e as Error).message
    output.value = ''
  }
}

function minify() {
  error.value = ''
  if (!input.value.trim()) return
  try {
    output.value = JSON.stringify(JSON.parse(input.value))
  } catch (e) {
    error.value = (e as Error).message
  }
}

/** 去除 JSON 字符串外层的转义（如日志中出现的 \"payload\"） */
function unescapeJson() {
  error.value = ''
  try {
    const s = JSON.parse(`"${input.value.replace(/"/g, '\\"')}"`) as string
    output.value = s
  } catch (e) {
    error.value = (e as Error).message
  }
}

const status = computed<'valid' | 'invalid' | 'empty'>(() => {
  if (!input.value.trim()) return 'empty'
  try {
    JSON.parse(input.value)
    return 'valid'
  } catch {
    return 'invalid'
  }
})

async function copy() {
  if (await copyText(output.value)) {
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  }
}
</script>

<template>
  <ToolLayout>
    <div class="space-y-4">
      <div class="flex flex-wrap items-center gap-2">
        <Button size="sm" @click="format(2)">格式化 (2 空格)</Button>
        <Button size="sm" variant="secondary" @click="format(4)">格式化 (4 空格)</Button>
        <Button size="sm" variant="secondary" @click="minify">
          <Minimize2 /> 压缩
        </Button>
        <Button size="sm" variant="outline" @click="unescapeJson">
          <WrapText /> 去转义
        </Button>
        <Badge v-if="status === 'valid'" variant="secondary" class="ml-1 bg-green-500/15 text-green-600 dark:text-green-400">
          JSON 有效
        </Badge>
        <Badge v-else-if="status === 'invalid'" variant="destructive">JSON 无效</Badge>
      </div>

      <Tabs default-value="input">
        <TabsList>
          <TabsTrigger value="input">输入</TabsTrigger>
          <TabsTrigger value="output">输出</TabsTrigger>
        </TabsList>
        <TabsContent value="input">
          <Textarea
            v-model="input"
            placeholder='粘贴 JSON，如 {"name":"ittools","version":1}'
            class="min-h-[320px] font-mono text-xs"
          />
        </TabsContent>
        <TabsContent value="output">
          <div class="relative">
            <pre class="max-h-[320px] min-h-[320px] overflow-auto whitespace-pre-wrap break-all rounded-md border bg-muted/50 p-3 font-mono text-xs">{{ output || '（先操作上方按钮）' }}</pre>
            <Button v-if="output" size="icon" variant="outline" class="absolute right-2 top-2 h-7 w-7" @click="copy">
              <Check v-if="copied" />
              <Copy v-else />
            </Button>
          </div>
        </TabsContent>
      </Tabs>

      <p v-if="error" class="rounded-md border border-destructive/50 bg-destructive/10 p-3 font-mono text-xs text-destructive">
        {{ error }}
      </p>
    </div>
  </ToolLayout>
</template>
