<script setup lang="ts">
import { ref } from 'vue'
import { Search, ShieldCheck } from '@lucide/vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import ToolLayout from '@/components/ToolLayout.vue'
import { useAuth } from '@/composables/useAuth'

const { authFetch } = useAuth()

interface SiteResult {
  url: string
  finalUrl: string
  statusCode: number
  responseTimeMs: number
  tls: {
    subject: string
    issuer: string
    validFrom: string
    validTo: string
    daysRemaining: number
    protocol: string
    san: string[]
  } | null
}

const url = ref('')
const checking = ref(false)
const error = ref('')
const result = ref<SiteResult | null>(null)

async function check() {
  if (!url.value.trim()) {
    error.value = '请输入域名或 URL'
    return
  }
  checking.value = true
  error.value = ''
  result.value = null
  try {
    const res = await authFetch(`/api/site-check?url=${encodeURIComponent(url.value.trim())}`)
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? '检测失败')
    result.value = data
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    checking.value = false
  }
}

function statusColor(code: number): string {
  if (code >= 200 && code < 300) return 'bg-green-500/15 text-green-600 dark:text-green-400'
  if (code >= 300 && code < 400) return 'bg-blue-500/15 text-blue-600 dark:text-blue-400'
  if (code >= 400 && code < 500) return 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400'
  return 'bg-red-500/15 text-red-600 dark:text-red-400'
}

function certColor(days: number): string {
  if (days < 0) return 'destructive'
  if (days < 14) return 'bg-red-500/15 text-red-600 dark:text-red-400'
  if (days < 30) return 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-400'
  return 'bg-green-500/15 text-green-600 dark:text-green-400'
}
</script>

<template>
  <ToolLayout>
    <div class="space-y-4">
      <div class="flex gap-2">
        <Input v-model="url" placeholder="example.com 或 https://example.com" @keyup.enter="check" />
        <Button :disabled="checking" @click="check">
          <Search /> {{ checking ? '检测中...' : '检测' }}
        </Button>
      </div>

      <p v-if="error" class="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
        {{ error }}
      </p>

      <div v-if="result" class="space-y-4">
        <!-- 概览 -->
        <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
          <div class="rounded-xl border bg-card p-4 text-center shadow-sm">
            <div class="text-xs text-muted-foreground">状态码</div>
            <div class="mt-1"><Badge :class="statusColor(result.statusCode)" class="font-mono text-sm">{{ result.statusCode }}</Badge></div>
          </div>
          <div class="rounded-xl border bg-card p-4 text-center shadow-sm">
            <div class="text-xs text-muted-foreground">响应时间</div>
            <div class="mt-1 font-mono text-xl font-bold">{{ result.responseTimeMs }}<span class="text-xs font-normal">ms</span></div>
          </div>
          <div class="rounded-xl border bg-card p-4 text-center shadow-sm">
            <div class="text-xs text-muted-foreground">TLS 协议</div>
            <div class="mt-1 font-mono text-xl font-bold">{{ result.tls?.protocol ?? '—' }}</div>
          </div>
          <div class="rounded-xl border bg-card p-4 text-center shadow-sm">
            <div class="text-xs text-muted-foreground">证书剩余</div>
            <div class="mt-1">
              <Badge v-if="result.tls" :class="certColor(result.tls.daysRemaining)" class="font-mono text-sm">
                {{ result.tls.daysRemaining }} 天
              </Badge>
              <span v-else class="text-sm text-muted-foreground">无 HTTPS</span>
            </div>
          </div>
        </div>

        <div v-if="result.finalUrl !== result.url" class="rounded-md border bg-muted/50 px-3 py-2 text-xs">
          <span class="text-muted-foreground">重定向至：</span>
          <span class="font-mono break-all">{{ result.finalUrl }}</span>
        </div>

        <!-- 证书详情 -->
        <div v-if="result.tls" class="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div class="flex items-center gap-2 border-b px-4 py-2 text-sm font-semibold">
            <ShieldCheck class="h-4 w-4 text-green-500" /> TLS 证书
          </div>
          <table class="w-full text-sm">
            <tbody>
              <tr class="border-b"><td class="w-28 bg-muted/50 px-4 py-2 text-xs text-muted-foreground">颁发给</td><td class="px-4 py-2 font-mono break-all">{{ result.tls.subject }}</td></tr>
              <tr class="border-b"><td class="w-28 bg-muted/50 px-4 py-2 text-xs text-muted-foreground">签发机构</td><td class="px-4 py-2">{{ result.tls.issuer }}</td></tr>
              <tr class="border-b"><td class="w-28 bg-muted/50 px-4 py-2 text-xs text-muted-foreground">有效期</td><td class="px-4 py-2 font-mono text-xs">{{ result.tls.validFrom }} ~ {{ result.tls.validTo }}</td></tr>
              <tr v-if="result.tls.san.length">
                <td class="w-28 bg-muted/50 px-4 py-2 text-xs text-muted-foreground">SAN 域名</td>
                <td class="px-4 py-2 font-mono text-xs break-all">{{ result.tls.san.join(', ') }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p class="text-xs text-muted-foreground">
          数据来源：本服务实时探测目标站点 · 证书信息直接读取自目标服务器 · 响应时间受本机网络影响
        </p>
      </div>
    </div>
  </ToolLayout>
</template>
