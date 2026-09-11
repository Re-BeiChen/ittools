<script setup lang="ts">
import { ref } from 'vue'
import { FileSearch, Search } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import ToolLayout from '@/components/ToolLayout.vue'
import { useAuth } from '@/composables/useAuth'

const { authFetch } = useAuth()

interface WhoisResult {
  domain: string
  server: string
  fields: Record<string, string>
  raw: string
}

const query = ref('')
const loading = ref(false)
const error = ref('')
const info = ref<WhoisResult | null>(null)
const showRaw = ref(false)

async function lookup() {
  const domain = query.value.trim()
  if (!domain) {
    error.value = '请输入域名'
    return
  }
  loading.value = true
  error.value = ''
  info.value = null
  try {
    const res = await authFetch(`/api/whois?domain=${encodeURIComponent(domain)}`)
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? '查询失败')
    info.value = data
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <ToolLayout>
    <div class="space-y-4">
      <div class="flex gap-2">
        <div class="relative flex-1">
          <FileSearch class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input v-model="query" placeholder="输入域名，如 example.com" class="pl-8" @keyup.enter="lookup()" />
        </div>
        <Button :disabled="loading" @click="lookup()">
          <Search /> {{ loading ? '查询中...' : '查询' }}
        </Button>
      </div>

      <p v-if="error" class="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
        {{ error }}
      </p>

      <div v-if="info" class="space-y-4">
        <div class="flex flex-wrap items-center gap-2">
          <span class="font-mono text-xl font-bold">{{ info.domain }}</span>
          <span class="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">注册局：{{ info.server }}</span>
        </div>

        <div v-if="Object.keys(info.fields).length" class="overflow-hidden rounded-xl border bg-card shadow-sm">
          <table class="w-full text-sm">
            <tbody>
              <tr v-for="(v, k) in info.fields" :key="k" class="border-b last:border-0">
                <td class="w-44 bg-muted/50 px-4 py-2 text-xs text-muted-foreground">{{ k }}</td>
                <td class="px-4 py-2 font-mono break-all text-xs">{{ v }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="overflow-hidden rounded-xl border bg-card shadow-sm">
          <button
            class="flex w-full items-center justify-between px-4 py-2.5 text-sm font-semibold"
            @click="showRaw = !showRaw"
          >
            原始 Whois 数据
            <span class="text-xs text-muted-foreground">{{ showRaw ? '收起' : '展开' }}</span>
          </button>
          <pre v-if="showRaw" class="max-h-96 overflow-auto whitespace-pre-wrap border-t px-4 py-3 font-mono text-xs leading-relaxed text-muted-foreground">{{ info.raw }}</pre>
        </div>

        <p class="text-xs text-muted-foreground">
          数据来源：<a href="https://whois.iana.org" target="_blank" rel="noopener" class="underline underline-offset-2 hover:text-foreground">IANA</a> 及各注册局 whois 服务器直连查询
        </p>
      </div>
    </div>
  </ToolLayout>
</template>
