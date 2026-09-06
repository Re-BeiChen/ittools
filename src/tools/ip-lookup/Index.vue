<script setup lang="ts">
import { ref } from 'vue'
import { Globe, LocateFixed, Search } from '@lucide/vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import ToolLayout from '@/components/ToolLayout.vue'
import { useAuth } from '@/composables/useAuth'

const { authFetch } = useAuth()

interface IpInfo {
  ip: string
  country: string
  countryCode: string
  region: string
  city: string
  isp: string
  org: string
  as: string
  lat: number
  lon: number
  timezone: string
}

const query = ref('')
const loading = ref(false)
const error = ref('')
const info = ref<IpInfo | null>(null)

async function lookup(ip?: string) {
  const target = ip ?? query.value.trim()
  if (!target) {
    error.value = '请输入 IP 地址'
    return
  }
  loading.value = true
  error.value = ''
  info.value = null
  try {
    const res = await authFetch(`/api/ip/${encodeURIComponent(target)}`)
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? '查询失败')
    info.value = data
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

const fields: { key: keyof IpInfo; label: string }[] = [
  { key: 'ip', label: 'IP 地址' },
  { key: 'country', label: '国家/地区' },
  { key: 'region', label: '省份/州' },
  { key: 'city', label: '城市' },
  { key: 'isp', label: 'ISP 运营商' },
  { key: 'org', label: '组织' },
  { key: 'as', label: 'AS 编号' },
  { key: 'lat', label: '纬度' },
  { key: 'lon', label: '经度' },
  { key: 'timezone', label: '时区' },
]
</script>

<template>
  <ToolLayout>
    <div class="space-y-4">
      <div class="flex gap-2">
        <div class="relative flex-1">
          <Globe class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input v-model="query" placeholder="输入 IPv4 / IPv6 地址，如 8.8.8.8" class="pl-8" @keyup.enter="lookup()" />
        </div>
        <Button :disabled="loading" @click="lookup()">
          <Search /> {{ loading ? '查询中...' : '查询' }}
        </Button>
        <Button variant="secondary" :disabled="loading" title="查询我的 IP" @click="lookup(undefined)">
          <LocateFixed /> 我的 IP
        </Button>
      </div>
      <p v-if="query === ''" class="text-xs text-muted-foreground">「我的 IP」留空即可直接点击</p>

      <p v-if="error" class="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
        {{ error }}
      </p>

      <div v-if="info" class="space-y-4">
        <div class="flex items-center gap-3">
          <span class="font-mono text-2xl font-bold">{{ info.ip }}</span>
          <Badge v-if="info.countryCode" variant="secondary">{{ info.countryCode }}</Badge>
          <span class="text-sm text-muted-foreground">{{ info.country }} {{ info.region }} {{ info.city }}</span>
        </div>
        <div class="overflow-hidden rounded-xl border bg-card shadow-sm">
          <table class="w-full text-sm">
            <tbody>
              <tr v-for="f in fields" :key="f.key" class="border-b last:border-0">
                <td class="w-28 bg-muted/50 px-4 py-2 text-xs text-muted-foreground">{{ f.label }}</td>
                <td class="px-4 py-2 font-mono break-all">{{ info[f.key] || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <a
          v-if="info.lat && info.lon"
          :href="`https://www.openstreetmap.org/?mlat=${info.lat}&mlon=${info.lon}#map=10/${info.lat}/${info.lon}`"
          target="_blank"
          rel="noopener"
          class="inline-block text-xs text-primary underline-offset-4 hover:underline"
        >在地图上查看位置 ↗</a>
        <p class="text-xs text-muted-foreground">
          数据来源：<a href="https://ip-api.com" target="_blank" rel="noopener" class="underline underline-offset-2 hover:text-foreground">ip-api.com</a> · 地理位置为估算值，仅供参考
        </p>
      </div>
    </div>
  </ToolLayout>
</template>
