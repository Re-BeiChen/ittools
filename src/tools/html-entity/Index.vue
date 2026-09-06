<script setup lang="ts">
import { ref } from 'vue'
import { ArrowDown, ArrowUp, Copy } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import ToolLayout from '@/components/ToolLayout.vue'
import { copyText } from '@/lib/utils'

const input = ref('')
const output = ref('')
const error = ref('')

// 常用命名实体（字符 → 实体名）
const NAMED: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  ' ': '&nbsp;', '©': '&copy;', '®': '&reg;', '™': '&trade;', '€': '&euro;',
  '£': '&pound;', '¥': '&yen;', '°': '&deg;', '±': '&plusmn;', '×': '&times;',
  '÷': '&divide;', '→': '&rarr;', '←': '&larr;', '↑': '&uarr;', '↓': '&darr;',
  '♥': '&hearts;', '★': '&star;', '✓': '&check;', '✗': '&cross;', '…': '&hellip;',
}
// 反向：实体名 → 字符
const BY_NAME: Record<string, string> = {}
for (const [ch, ent] of Object.entries(NAMED)) {
  BY_NAME[ent.slice(1, -1)] ??= ch // 优先保留第一个映射
}
BY_NAME['amp'] = '&'
BY_NAME['lt'] = '<'
BY_NAME['gt'] = '>'
BY_NAME['quot'] = '"'
BY_NAME['apos'] = "'"

function doEncode() {
  error.value = ''
  let out = ''
  for (const ch of input.value) {
    const named = NAMED[ch]
    if (named) {
      out += named
    } else if (ch.codePointAt(0)! > 127) {
      // 非 ASCII 转十进制 &#N;（与多数库一致，避免命名实体表爆炸）
      out += `&#${ch.codePointAt(0)!};`
    } else {
      out += ch
    }
  }
  output.value = out
}

function doDecode() {
  error.value = ''
  try {
    // 先解析数字实体 &#123; / &#x1F6;，再解析命名实体，最后用 DOM 兜底剩余
    let s = input.value.replace(/&#(\d{1,7});?/g, (_, n) => String.fromCodePoint(Number(n)))
    s = s.replace(/&#[xX]([0-9a-fA-F]{1,6});?/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    // 命名实体：利用浏览器自带解析，避免手写巨型表
    const text = s.replace(/&([a-zA-Z][a-zA-Z0-9]{1,31});/g, (m, name) => BY_NAME[name] ?? m)
    output.value = text
  } catch {
    error.value = '输入包含无法解析的实体'
  }
}

function copy() {
  if (output.value) copyText(output.value)
}
</script>

<template>
  <ToolLayout>
    <div class="space-y-4">
      <div class="flex flex-wrap items-center gap-3">
        <Button size="sm" @click="doEncode">
          <ArrowDown /> 编码
        </Button>
        <Button size="sm" variant="secondary" @click="doDecode">
          <ArrowUp /> 解码
        </Button>
        <Button v-if="output" size="sm" variant="ghost" @click="copy">
          <Copy /> 复制结果
        </Button>
      </div>

      <Textarea
        v-model="input"
        placeholder="输入文本，或包含 &lt; &amp; &#123; 等实体的 HTML 片段"
        class="min-h-[140px] font-mono text-xs"
      />

      <pre class="min-h-[140px] overflow-auto whitespace-pre-wrap break-all rounded-md border bg-muted/50 p-3 font-mono text-xs">{{ output || '（结果）' }}</pre>

      <p v-if="error" class="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
        {{ error }}
      </p>
    </div>
  </ToolLayout>
</template>