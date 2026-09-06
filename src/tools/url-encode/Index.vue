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
const component = ref(false)

const error = computed(() => {
  if (!input.value.trim()) return ''
  try {
    if (component.value) decodeURIComponent(input.value)
    else decodeURI(input.value)
    return ''
  } catch {
    return '输入包含无法解码的序列'
  }
})

function doEncode() {
  try {
    output.value = component.value ? encodeURIComponent(input.value) : encodeURI(input.value)
  } catch {
    output.value = ''
  }
}

function doDecode() {
  try {
    output.value = component.value ? decodeURIComponent(input.value) : decodeURI(input.value)
  } catch {
    output.value = ''
  }
}
</script>

<template>
  <ToolLayout>
    <div class="space-y-4">
      <div class="flex flex-wrap items-center gap-4">
        <div class="flex gap-2">
          <Button size="sm" @click="doEncode">
            <ArrowDown /> 编码
          </Button>
          <Button size="sm" variant="secondary" @click="doDecode">
            <ArrowUp /> 解码
          </Button>
        </div>
        <div class="flex items-center gap-2">
          <Switch id="component" v-model:checked="component" />
          <Label for="component" class="text-xs text-muted-foreground">component 模式（含 / ? & = 等特殊字符）</Label>
        </div>
      </div>

      <Textarea
        v-model="input"
        placeholder="输入文本或已编码的 URL"
        class="min-h-[140px] font-mono text-xs"
      />

      <pre class="min-h-[140px] overflow-auto whitespace-pre-wrap break-all rounded-md border bg-muted/50 p-3 font-mono text-xs">{{ output || '（结果）' }}</pre>

      <p v-if="error" class="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
        {{ error }}
      </p>
    </div>
  </ToolLayout>
</template>
