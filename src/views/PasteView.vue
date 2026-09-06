<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { Button } from '@/components/ui/button'
import { copyText } from '@/lib/utils'

const route = useRoute()
const code = route.params.code as string

interface PasteData {
  code: string
  content: string
  burn: boolean
  createdAt: number
  expiresAt: number | null
}

const data = ref<PasteData | null>(null)
const error = ref('')
const copied = ref(false)

onMounted(async () => {
  try {
    const res = await fetch(`/api/paste/${code}`)
    if (!res.ok) {
      error.value = (await res.json()).error ?? '加载失败'
      return
    }
    data.value = await res.json()
  } catch {
    error.value = '网络错误'
  }
})

async function copy() {
  if (data.value && await copyText(data.value.content)) {
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  }
}

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN')
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-6 py-12">
    <h1 class="mb-6 text-xl font-bold tracking-tight">
      文本分享 <span class="ml-2 font-mono text-sm text-muted-foreground">#{{ code }}</span>
    </h1>

    <div v-if="error" class="rounded-xl border border-destructive/50 bg-destructive/10 p-6 text-sm text-destructive">
      {{ error }}
    </div>

    <template v-else-if="data">
      <div class="mb-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>创建于 {{ fmtTime(data.createdAt) }}</span>
        <span v-if="data.expiresAt">过期于 {{ fmtTime(data.expiresAt) }}</span>
        <span v-if="data.burn" class="rounded bg-yellow-500/15 px-2 py-0.5 text-yellow-600 dark:text-yellow-400">
          阅后即焚：内容已被删除，刷新后不可见
        </span>
      </div>
      <pre class="max-h-[60vh] overflow-auto whitespace-pre-wrap break-all rounded-xl border bg-card p-4 font-mono text-sm shadow-sm">{{ data.content }}</pre>
      <div class="mt-4">
        <Button @click="copy">
          {{ copied ? '已复制' : '复制内容' }}
        </Button>
      </div>
    </template>

    <div v-else class="py-20 text-center text-sm text-muted-foreground">加载中...</div>
  </div>
</template>
