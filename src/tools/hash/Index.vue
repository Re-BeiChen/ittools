<script setup lang="ts">
import { ref, watch } from 'vue'
import { Check, Copy } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import ToolLayout from '@/components/ToolLayout.vue'
import { md5 } from 'js-md5'
import { copyText } from '@/lib/utils'

const input = ref('hello')

interface HashResult {
  name: string
  value: string
}

const results = ref<HashResult[]>([])
const copiedIdx = ref(-1)
const error = ref('')

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('')
}

async function compute() {
  const s = input.value
  error.value = ''
  if (!s) {
    results.value = []
    return
  }
  try {
    const data = new TextEncoder().encode(s)
    const [sha1, sha256, sha384, sha512] = await Promise.all([
      crypto.subtle.digest('SHA-1', data),
      crypto.subtle.digest('SHA-256', data),
      crypto.subtle.digest('SHA-384', data),
      crypto.subtle.digest('SHA-512', data),
    ])
    results.value = [
      { name: 'MD5', value: md5(s) },
      { name: 'SHA-1', value: toHex(sha1) },
      { name: 'SHA-256', value: toHex(sha256) },
      { name: 'SHA-384', value: toHex(sha384) },
      { name: 'SHA-512', value: toHex(sha512) },
    ]
  } catch (e) {
    error.value = (e as Error).message
  }
}

watch(input, () => compute(), { immediate: true })

async function copyOne(i: number) {
  if (await copyText(results.value[i].value)) {
    copiedIdx.value = i
    setTimeout(() => (copiedIdx.value = -1), 1500)
  }
}
</script>

<template>
  <ToolLayout>
    <div class="space-y-4">
      <div>
        <Textarea
          v-model="input"
          placeholder="输入要计算哈希的文本"
          class="min-h-[100px] font-mono text-xs"
        />
      </div>

      <p v-if="error" class="text-xs text-destructive">{{ error }}</p>

      <div class="space-y-1.5">
        <div
          v-for="(r, i) in results"
          :key="r.name"
          class="group flex items-start justify-between gap-2 rounded-md border bg-card px-3 py-2"
        >
          <div class="min-w-0">
            <div class="text-xs font-semibold">{{ r.name }}</div>
            <div class="break-all font-mono text-xs text-muted-foreground">{{ r.value }}</div>
          </div>
          <Button size="icon" variant="ghost" class="h-6 w-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" @click="copyOne(i)">
            <Check v-if="copiedIdx === i" />
            <Copy v-else />
          </Button>
        </div>
      </div>
    </div>
  </ToolLayout>
</template>
