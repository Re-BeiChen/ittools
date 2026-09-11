<script setup lang="ts">
import { ref } from 'vue'
import { Globe, Network, Search } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import ToolLayout from '@/components/ToolLayout.vue'
import { useAuth } from '@/composables/useAuth'

const { authFetch } = useAuth()

interface ChannelResult {
  channel: string
  server: string
  ok: boolean
  timeMs: number
  answers: string[]
  error?: string
}

const query = ref('example.com')
const type = ref('A')
const types = ['A', 'AAAA', 'CNAME', 'MX', 'NS', 'TXT', 'SOA']
const loading = ref(false)
const error = ref('')
const channels = ref<ChannelResult[] | null>(null)
const resolvedName = ref('')

async function lookup() {
  const name = query.value.trim()
  if (!name) {
    error.value = '请输入域名'
    return
  }
  loading.value = true
  error.value = ''
  channels.value = null
  try {
    const res = await authFetch(`/api/dns?name=${encodeURIComponent(name)}&type=${type.value}`)
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? '查询失败')
    resolvedName.value = `${data.name}  ${data.type}`
    channels.value = data.channels
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
      <div class="flex flex-wrap gap-2">
        <div class="relative min-w-[240px] flex-1">
          <Network class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input v-model="query" placeholder="输入域名，如 example.com" class="pl-8" @keyup.enter="lookup()" />
        </div>
        <Select v-model="type">
          <SelectTrigger class="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="t in types" :key="t" :value="t">{{ t }}</SelectItem>
          </SelectContent>
        </Select>
        <Button :disabled="loading" @click="lookup()">
          <Search /> {{ loading ? '解析中...' : '解析' }}
        </Button>
      </div>

      <p v-if="error" class="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
        {{ error }}
      </p>

      <div v-if="channels" class="space-y-3">
        <div class="font-mono text-lg font-bold">{{ resolvedName }}</div>
        <div v-for="ch in channels" :key="ch.channel" class="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div class="flex items-center justify-between border-b px-4 py-2.5">
            <div class="flex items-center gap-2 text-sm font-semibold">
              <Globe class="h-4 w-4 text-primary" /> {{ ch.channel }}
            </div>
            <span
              class="rounded-full px-2 py-0.5 text-xs font-medium"
              :class="ch.ok ? 'bg-emerald-500/15 text-emerald-500' : 'bg-destructive/10 text-destructive'"
            >
              {{ ch.ok ? `${ch.timeMs}ms` : '失败' }}
            </span>
          </div>
          <div class="px-4 py-3">
            <p v-if="ch.error" class="text-sm text-destructive">{{ ch.error }}</p>
            <ul v-else class="space-y-1">
              <li v-for="(a, i) in ch.answers" :key="i" class="font-mono text-sm break-all">{{ a }}</li>
              <li v-if="!ch.answers.length" class="text-sm text-muted-foreground">（无记录）</li>
            </ul>
          </div>
        </div>
        <p class="text-xs text-muted-foreground">
          数据来源：Cloudflare / Google / 阿里云公共 DNS 服务器
        </p>
      </div>
    </div>
  </ToolLayout>
</template>
