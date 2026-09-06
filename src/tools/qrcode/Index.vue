<script setup lang="ts">
import { ref, watch } from 'vue'
import { Download } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import ToolLayout from '@/components/ToolLayout.vue'
import QRCode from 'qrcode'

const text = ref('https://chat.279178.xyz')
const size = ref<[number]>([256])
const dataUrl = ref('')
const error = ref('')

watch([text, size], async ([t]) => {
  const s = String(t).trim()
  if (!s) {
    dataUrl.value = ''
    return
  }
  try {
    dataUrl.value = await QRCode.toDataURL(s, {
      width: size.value[0],
      margin: 2,
      errorCorrectionLevel: 'M',
    })
    error.value = ''
  } catch (e) {
    error.value = (e as Error).message
    dataUrl.value = ''
  }
}, { immediate: true })

function download() {
  if (!dataUrl.value) return
  const a = document.createElement('a')
  a.href = dataUrl.value
  a.download = `qrcode-${Date.now()}.png`
  a.click()
}
</script>

<template>
  <ToolLayout>
    <div class="grid gap-6 md:grid-cols-2">
      <div class="space-y-4">
        <div>
          <Label class="mb-1.5 block text-xs text-muted-foreground">内容（文本 / URL）</Label>
          <Textarea
            v-model="text"
            placeholder="输入要编码的内容"
            class="min-h-[120px] font-mono text-xs"
          />
        </div>
        <div class="flex items-center gap-4">
          <Label class="text-sm">尺寸</Label>
          <Slider v-model="size" class="flex-1" :min="128" :max="512" :step="32" />
          <span class="w-12 font-mono text-sm">{{ size[0] }}px</span>
        </div>
        <p v-if="error" class="text-xs text-destructive">{{ error }}</p>
      </div>

      <div class="flex flex-col items-center justify-center rounded-xl border bg-card p-6 shadow-sm">
        <div v-if="dataUrl" class="rounded-lg bg-white p-3">
          <img :src="dataUrl" alt="QR Code" class="block" :style="{ width: '100%', maxWidth: '256px' }">
        </div>
        <p v-else class="py-10 text-sm text-muted-foreground">（输入内容后生成）</p>
        <Button v-if="dataUrl" class="mt-4" variant="outline" @click="download">
          <Download /> 下载 PNG
        </Button>
      </div>
    </div>
  </ToolLayout>
</template>
