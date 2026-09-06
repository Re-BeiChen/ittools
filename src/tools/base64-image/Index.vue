<script setup lang="ts">
import { ref } from 'vue'
import { Check, ClipboardPaste, Copy, Image as ImageIcon } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import ToolLayout from '@/components/ToolLayout.vue'
import { copyText } from '@/lib/utils'

const dataUrl = ref('')          // 当前图片 dataURL
const text = ref('')             // Base64 文本（dataURL 或纯 base64）
const copied = ref(false)
const mime = ref('')
const sizeText = ref('')

function handleFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const url = String(reader.result)
    dataUrl.value = url
    mime.value = file.type
    sizeText.value = `${(file.size / 1024).toFixed(1)} KB`
    text.value = url
  }
  reader.readAsDataURL(file)
  input.value = ''
}

async function fromText() {
  const t = text.value.trim()
  if (!t) return
  if (t.startsWith('data:image/')) {
    dataUrl.value = t
    const m = t.match(/^data:(image\/[a-z+]+);base64,/i)
    mime.value = m ? m[1] : ''
    // 估算大小（base64 位长度 / 4 * 3）
    const b64 = t.split(',')[1] ?? ''
    sizeText.value = `${Math.round((b64.length / 4) * 3 / 1024)} KB`
  } else {
    // 纯 base64，当作 PNG 尝试
    dataUrl.value = `data:image/png;base64,${t}`
    mime.value = 'image/png'
    sizeText.value = `${Math.round((t.length / 4) * 3 / 1024)} KB`
  }
}

async function doCopy() {
  if (await copyText(text.value)) {
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  }
}
</script>

<template>
  <ToolLayout>
    <div class="grid gap-4 lg:grid-cols-2">
      <!-- 图片 → Base64 -->
      <div class="space-y-3">
        <Label class="flex items-center gap-2 text-sm"><ImageIcon class="h-4 w-4" /> 图片 → Base64</Label>
        <label
          class="flex h-56 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-muted-foreground transition-colors hover:border-primary hover:text-primary"
        >
          <ImageIcon class="h-8 w-8" />
          <span class="text-sm">点击选择图片（PNG / JPG / WebP / GIF / SVG）</span>
          <span class="text-xs text-muted-foreground/70">图片仅在本机处理，不会上传</span>
          <input
            type="file"
            accept="image/*"
            class="hidden"
            @change="handleFile"
          />
        </label>

        <div v-if="dataUrl" class="space-y-2">
          <div class="flex items-center gap-2 text-xs text-muted-foreground">
            <img :src="dataUrl" class="max-h-40 rounded-md border bg-card object-contain p-1" alt="预览" />
            <div>
              <Badge variant="secondary">{{ mime || '未知类型' }}</Badge>
              <p class="mt-1">{{ sizeText }}</p>
            </div>
          </div>
          <div class="flex items-end gap-2">
            <Textarea v-model="text" :rows="4" class="resize-none font-mono text-xs" />
            <Button size="sm" variant="outline" class="shrink-0" @click="doCopy">
              <Check v-if="copied" class="h-4 w-4" />
              <Copy v-else class="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <!-- Base64 → 图片 -->
      <div class="space-y-3">
        <Label class="flex items-center gap-2 text-sm"><ClipboardPaste class="h-4 w-4" /> Base64 → 图片</Label>
        <Textarea
          v-model="text"
          :rows="8"
          class="min-h-[140px] resize-none font-mono text-xs"
          placeholder="粘贴 data:image/... 或纯 Base64 数据"
        />
        <Button size="sm" variant="secondary" :disabled="!text.trim()" @click="fromText">解码预览</Button>

        <div class="flex min-h-[180px] items-center justify-center rounded-lg border bg-muted/40 p-4">
          <img v-if="dataUrl" :src="dataUrl" class="max-h-64 rounded-md border bg-card object-contain" alt="Base64 解码预览" />
          <span v-else class="text-xs text-muted-foreground">解码后在此预览</span>
        </div>
      </div>
    </div>
  </ToolLayout>
</template>