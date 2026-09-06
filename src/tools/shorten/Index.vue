<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check, Copy, Link2, QrCode } from '@lucide/vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import ToolLayout from '@/components/ToolLayout.vue'
import { useAuth } from '@/composables/useAuth'
import QRCode from 'qrcode'
import { copyText } from '@/lib/utils'

const { authFetch } = useAuth()

const url = ref('')
const creating = ref(false)
const error = ref('')
const created = ref<{ code: string; url: string; target: string } | null>(null)
const copied = ref(false)
const qrDataUrl = ref('')

const origin = computed(() => window.location.origin)
const shortUrl = computed(() => (created.value ? `${origin.value}${created.value.url}` : ''))

async function create() {
  const target = url.value.trim()
  if (!/^https?:\/\/.+/i.test(target)) {
    error.value = '请输入合法的 URL（http(s):// 开头）'
    return
  }
  creating.value = true
  error.value = ''
  created.value = null
  qrDataUrl.value = ''
  try {
    const res = await authFetch('/api/shorten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: target }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? '创建失败')
    created.value = data
    qrDataUrl.value = await QRCode.toDataURL(`${origin.value}${data.url}`, { width: 200, margin: 2 })
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    creating.value = false
  }
}

async function copy() {
  if (await copyText(shortUrl.value)) {
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  }
}

const lastResult = ref<{ code: string; clicks: number } | null>(null)

async function loadStats() {
  if (!created.value) return
  try {
    const res = await fetch(`/api/stats/${created.value.code}`)
    if (res.ok) {
      lastResult.value = await res.json()
    }
  } catch {
    // 忽略
  }
}
</script>

<template>
  <ToolLayout>
    <div class="space-y-4">
      <div class="flex gap-2">
        <div class="relative flex-1">
          <Link2 class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input v-model="url" placeholder="https://example.com/很长很长的链接" class="pl-8" @keyup.enter="create" />
        </div>
        <Button :disabled="creating" @click="create">{{ creating ? '生成中...' : '缩短' }}</Button>
      </div>

      <p v-if="error" class="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
        {{ error }}
      </p>

      <div v-if="created" class="grid gap-4 rounded-xl border bg-card p-4 shadow-sm md:grid-cols-[1fr_auto]">
        <div class="space-y-3">
          <div class="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" class="font-mono">/s/{{ created.code }}</Badge>
            <span class="text-xs text-muted-foreground">→ {{ created.target }}</span>
          </div>
          <div class="flex items-center gap-2">
            <code class="flex-1 break-all rounded-md bg-muted px-3 py-2 font-mono text-sm">{{ shortUrl }}</code>
            <Button size="sm" variant="outline" @click="copy">
              <Check v-if="copied" />
              <Copy v-else />
            </Button>
          </div>
          <div class="flex items-center gap-2 text-xs text-muted-foreground">
            <Button size="sm" variant="ghost" @click="loadStats">
              <QrCode class="h-4 w-4" /> 刷新点击统计
            </Button>
            <span v-if="lastResult">点击 {{ lastResult.clicks }} 次</span>
          </div>
        </div>
        <div v-if="qrDataUrl" class="flex items-center justify-center">
          <div class="rounded-lg bg-white p-2">
            <img :src="qrDataUrl" alt="QR" class="block w-[140px]">
          </div>
        </div>
      </div>
    </div>
  </ToolLayout>
</template>
