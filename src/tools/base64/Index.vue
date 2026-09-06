<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowDown, ArrowUp, Check, Copy } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import ToolLayout from '@/components/ToolLayout.vue'
import { copyText } from '@/lib/utils'

const input = ref('')
const output = ref('')
const copied = ref(false)

/** UTF-8 安全的 Base64 编码 */
function encode(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin)
}

/** UTF-8 安全的 Base64 解码 */
function decode(s: string): string {
  const bin = atob(s.trim())
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

const error = computed(() => {
  if (!input.value.trim()) return ''
  try {
    atob(input.value.trim())
    return ''
  } catch {
    return '输入不是合法的 Base64'
  }
})

function doEncode() {
  output.value = encode(input.value)
}

function doDecode() {
  try {
    output.value = decode(input.value)
  } catch {
    output.value = ''
  }
}

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
      <div class="flex gap-2">
        <Button @click="doEncode">
          <ArrowDown /> 编码
        </Button>
        <Button variant="secondary" @click="doDecode">
          <ArrowUp /> 解码
        </Button>
      </div>

      <Textarea
        v-model="input"
        placeholder="输入文本或 Base64（支持中文）"
        class="min-h-[140px] font-mono text-xs"
      />

      <div class="relative">
        <pre class="min-h-[140px] overflow-auto whitespace-pre-wrap break-all rounded-md border bg-muted/50 p-3 font-mono text-xs">{{ output || '（结果）' }}</pre>
        <Button v-if="output" size="icon" variant="outline" class="absolute right-2 top-2 h-7 w-7" @click="copy">
          <Check v-if="copied" />
          <Copy v-else />
        </Button>
      </div>

      <p v-if="error" class="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
        {{ error }}
      </p>
    </div>
  </ToolLayout>
</template>
