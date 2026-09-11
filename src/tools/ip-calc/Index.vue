<script setup lang="ts">
import { computed, ref } from 'vue'
import { Binary, Calculator } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import ToolLayout from '@/components/ToolLayout.vue'

const input = ref('192.168.1.0/24')
const error = ref('')

function ipToInt(ip: string): number | null {
  const parts = ip.split('.').map(Number)
  if (parts.length !== 4 || parts.some(p => !Number.isInteger(p) || p < 0 || p > 255)) return null
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
}

function intToIp(v: number): string {
  return `${(v >>> 24) & 255}.${(v >>> 16) & 255}.${(v >>> 8) & 255}.${v & 255}`
}

interface CalcResult {
  input: string
  ip: string
  prefix: number
  netmask: string
  wildcard: string
  network: string
  broadcast: string
  firstHost: string
  lastHost: string
  hostCount: string
  ipBinary: string
  maskBinary: string
  ipHex: string
  usable: number
  cidrList: { range: string; subnets: string }[]
}

const result = computed<CalcResult | null>(() => {
  const raw = input.value.trim().replace(/\s+/g, '')
  error.value = ''
  if (!raw) return null

  const m = raw.match(/^([\d.]+)(?:\/(\d{1,2}))?$/)
  if (!m) {
    error.value = '格式应为 IP 或 IP/前缀，如 192.168.1.0/24'
    return null
  }
  const ipInt = ipToInt(m[1])
  if (ipInt === null) {
    error.value = 'IPv4 地址不合法'
    return null
  }
  const prefix = m[2] === undefined ? 24 : Number(m[2])
  if (prefix < 0 || prefix > 32) {
    error.value = '前缀长度应在 0-32 之间'
    return null
  }

  const mask = prefix === 0 ? 0 : ((0xffffffff << (32 - prefix)) >>> 0)
  const wildcard = (~mask) >>> 0
  const network = (ipInt & mask) >>> 0
  const broadcast = (network | wildcard) >>> 0
  const hostCount = prefix >= 31 ? (prefix === 31 ? 2 : 1) : Math.max(0, 2 ** (32 - prefix) - 2)
  const firstHost = prefix >= 31 ? network : network + 1
  const lastHost = prefix >= 31 ? broadcast : broadcast - 1

  const cidrList =
    prefix < 32
      ? Array.from({ length: Math.min(4, 32 - prefix) }, (_, i) => {
          const subPrefix = prefix + i
          const count = 2 ** i
          const step = 2 ** (32 - subPrefix)
          const parts: string[] = []
          for (let j = 0; j < count; j++) {
            parts.push(`${intToIp(network + j * step)}/${subPrefix}`)
          }
          return { range: `/${subPrefix} 划分 ${count} 个子网`, subnets: parts.join('  ') }
        })
      : []

  return {
    input: raw,
    ip: intToIp(ipInt),
    prefix,
    netmask: intToIp(mask),
    wildcard: intToIp(wildcard),
    network: intToIp(network),
    broadcast: intToIp(broadcast),
    firstHost: intToIp(firstHost),
    lastHost: intToIp(lastHost),
    hostCount: hostCount.toLocaleString(),
    usable: hostCount,
    ipBinary: intToIp(ipInt).split('.').map(p => Number(p).toString(2).padStart(8, '0')).join('.'),
    maskBinary: intToIp(mask).split('.').map(p => Number(p).toString(2).padStart(8, '0')).join('.'),
    ipHex: `0x${ipInt.toString(16).padStart(8, '0')}`,
    cidrList,
  }
})

// 常用示例
const examples = ['10.0.0.0/8', '172.16.0.0/12', '192.168.1.1/28', '203.0.113.5/32']

function setInput(v: string) {
  input.value = v
}
</script>

<template>
  <ToolLayout>
    <div class="space-y-4">
      <div class="flex flex-wrap items-center gap-2">
        <div class="relative min-w-[280px] flex-1">
          <Binary class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input v-model="input" placeholder="IP / 前缀，如 192.168.1.0/24" class="pl-8 font-mono" />
        </div>
        <Button variant="secondary" v-for="ex in examples" :key="ex" @click="setInput(ex)">
          {{ ex }}
        </Button>
      </div>

      <p v-if="error" class="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
        {{ error }}
      </p>

      <template v-if="result && !error">
        <div class="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div class="flex items-center gap-2 border-b px-4 py-2.5 text-sm font-semibold">
            <Calculator class="h-4 w-4 text-primary" /> {{ result.input }} 计算结果
          </div>
          <div class="grid grid-cols-2 gap-x-6 gap-y-1 p-4 text-sm md:grid-cols-3">
            <div class="col-span-2 md:col-span-1"><div class="text-xs text-muted-foreground">网络地址</div><div class="font-mono font-semibold text-primary">{{ result.network }}</div></div>
            <div><div class="text-xs text-muted-foreground">广播地址</div><div class="font-mono">{{ result.broadcast }}</div></div>
            <div><div class="text-xs text-muted-foreground">可用主机数</div><div class="font-mono">{{ result.hostCount }}</div></div>
            <div><div class="text-xs text-muted-foreground">子网掩码</div><div class="font-mono">{{ result.netmask }} ({{ result.prefix }})</div></div>
            <div><div class="text-xs text-muted-foreground">通配符掩码</div><div class="font-mono">{{ result.wildcard }}</div></div>
            <div><div class="text-xs text-muted-foreground">IP 十六进制</div><div class="font-mono">{{ result.ipHex }}</div></div>
            <div><div class="text-xs text-muted-foreground">首可用主机</div><div class="font-mono">{{ result.firstHost }}</div></div>
            <div><div class="text-xs text-muted-foreground">末可用主机</div><div class="font-mono">{{ result.lastHost }}</div></div>
          </div>
          <div class="space-y-1 border-t px-4 py-3 font-mono text-xs">
            <div class="flex gap-2"><span class="w-16 shrink-0 text-muted-foreground">IP</span><span class="break-all">{{ result.ipBinary }}</span></div>
            <div class="flex gap-2"><span class="w-16 shrink-0 text-muted-foreground">掩码</span><span class="break-all">{{ result.maskBinary }}</span></div>
          </div>
        </div>

        <div v-if="result.cidrList.length" class="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div class="border-b px-4 py-2.5 text-sm font-semibold">子网划分预览</div>
          <div class="divide-y text-xs">
            <div v-for="c in result.cidrList" :key="c.range" class="px-4 py-2.5">
              <div class="mb-1 font-medium text-muted-foreground">{{ c.range }}</div>
              <div class="font-mono break-all text-foreground/90">{{ c.subnets }}</div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </ToolLayout>
</template>
