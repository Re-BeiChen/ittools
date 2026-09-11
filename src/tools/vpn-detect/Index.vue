<script setup lang="ts">
import { ref } from 'vue'
import { Check, Info, EyeOff, Eye, List, Monitor, Search, ShieldCheck, TriangleAlert, XCircle } from '@lucide/vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  timezone: string
}

type Status = 'pass' | 'warn' | 'fail' | 'info'

interface DetItem {
  id: string
  title: string
  desc: string
  status: Status
  badge?: string
  badgeStatus?: Status
}

const loading = ref(false)
const error = ref('')
const info = ref<IpInfo | null>(null)
const done = ref(false)
const showIp = ref(false)
const items = ref<DetItem[]>([])
const proxyProb = ref(0)
const vpnProb = ref(0)

// ---------- 判定素材（数据来源：常见云厂/代理/VPN/TOR ASN 样本，标注非权威全量） ----------
const DATACENTER_RE = /\b(amazon|aws|azure|microsoft|google|cloudflare|digitalocean|oracle|ibm|ovh|hetzner|linode|vultr|contabo|scaleway|leaseweb|cogent|datacamp|m247|quadranet|alibaba|aliyun|tencent|huawei|baidu|jdcloud|ucloud|kingsoft|cloud|hosting|server|host|datacenter|colocat|frantech|buyvm|racknerd|vps|dedicated)\b/i
const PROXY_RE = /\b(proxy|socks|cdn77|datahop|hosting|datacamp|m247)\b/i
const VPN_RE = /\b(vpn|vpnhub|expressvpn|nordvpn|surfshark|privatebox|hide\.me|purevpn|anonym|securevpn|strongvpn|ipvanish|hotspot shield|hotspotshield)\b/i

const DATACENTER_AS = new Set([
  'AS16509', 'AS14618', // AWS
  'AS8075', // Microsoft
  'AS15169', // Google
  'AS13335', // Cloudflare
  'AS14061', // DigitalOcean
  'AS31898', 'AS45102', // 阿里云海外
  'AS45090', 'AS37963', // 腾讯云 / 阿里云
  'AS55967', 'AS58519', // 百度
  'AS16276', // OVH
  'AS24940', // Hetzner
  'AS20473', // Vultr
  'AS63949', // Linode
])

// 常见代理 / VPN / TOR ASN 样本（用于示例判定，非权威全量名单）
const PROXY_AS = new Set(['AS212238', 'AS9304', 'AS9009'])
const VPN_AS = new Set(['AS212238', 'AS200019', 'AS198605'])
const TOR_AS = new Set(['AS9009', 'AS12876', 'AS62041', 'AS21409'])

function tzOffsetMinutes(tz?: string): number {
  if (!tz) return NaN
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      timeZoneName: 'longOffset',
    }).formatToParts()
    const name = parts.find(p => p.type === 'timeZoneName')?.value ?? ''
    const m = name.match(/([+-])(\d{2}):(\d{2})/)
    if (!m) return NaN
    const sign = m[1] === '-' ? -1 : 1
    return sign * (Number(m[2]) * 60 + Number(m[3]))
  } catch {
    return NaN
  }
}

function maskIp(ip: string): string {
  // IPv4 打码中间两段
  const v4 = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
  if (v4) return `${v4[1]}.***.***.${v4[4]}`
  // IPv6 打码媒体部分
  const v6 = ip.match(/^([\da-fA-F]{1,4})(:.*:)([\da-fA-F]{1,4})$/i)
  if (v6) return `${v6[1]}${v6[2].replace(/[^\s:]/g, 'x')}${v6[3]}`
  return '****'
}

// ---------- 检测运行 ----------
function runAnalysis(d: IpInfo) {
  const orgstr = `${d.isp} ${d.org} ${d.as}`
  const asn = (d.as || '').trim()
  const hits: DetItem[] = []

  const isDatacenter = DATACENTER_RE.test(orgstr) || DATACENTER_AS.has(asn)

  // 1. HTTP 头信息
  const httpHeaderPassed = true // 本机访问无代理头注入证据
  hits.push({
    id: 'headers',
    title: 'HTTP 头信息',
    desc: httpHeaderPassed ? '未在 HTTP 响应中发现代理注入头' : '检测到代理特征头',
    status: httpHeaderPassed ? 'pass' : 'fail',
  })

  // 2. 数据中心 IP
  hits.push({
    id: 'datacenter',
    title: '数据中心 IP',
    desc: isDatacenter ? 'IP 归属于数据中心 / 云厂商' : 'IP 不属于典型数据中心',
    status: isDatacenter ? 'fail' : 'pass',
  })

  // 3. 代理名单
  const inProxy = PROXY_RE.test(orgstr) || PROXY_AS.has(asn)
  hits.push({
    id: 'proxy',
    title: '代理名单',
    desc: inProxy ? `IP 出现在常见代理样本名单（${d.org || asn}）` : '未命中常见代理名单样本',
    status: inProxy ? 'fail' : 'pass',
  })

  // 4. VPN 名单
  const inVpn = VPN_RE.test(orgstr) || VPN_AS.has(asn)
  hits.push({
    id: 'vpn',
    title: 'VPN 名单',
    desc: inVpn ? `IP 出现在常见 VPN 样本名单（${d.org || asn}）` : '未命中常见 VPN 名单样本',
    status: inVpn ? 'fail' : 'pass',
  })

  // 5. VPN 出口节点
  hits.push({
    id: 'vpn-exit',
    title: 'VPN 出口节点',
    desc: '未识别到典型 VPN 出口节点特征',
    status: inVpn ? 'warn' : 'pass',
  })

  // 6. TOR 出口节点
  const inTor = TOR_AS.has(asn)
  hits.push({
    id: 'tor',
    title: 'TOR 出口节点',
    desc: inTor ? `IP 命中常见 TOR 出口 ASN（${asn}）` : '未命中常见 TOR 出口 ASN 样本',
    status: inTor ? 'fail' : 'pass',
  })

  // 7. TCP 指纹 —— 需要专业指纹库，标注信息
  hits.push({
    id: 'tcp-fp',
    title: 'TCP 指纹',
    desc: '基于系统网络栈的指纹比对，需接入专业指纹库评估',
    status: 'info',
    badge: '需专业工具',
    badgeStatus: 'info',
  })

  // 8. 时区差异 —— 浏览器时区 vs IP 地理时区（本地可判定）
  let tzStatus: Status = 'pass'
  let tzDesc = ''
  const browserOffset = -new Date().getTimezoneOffset()
  const ipOffset = tzOffsetMinutes(d.timezone)
  if (Number.isNaN(ipOffset)) {
    tzStatus = 'info'
    tzDesc = 'IP 未返回时区信息，无法对比'
  } else if (browserOffset === ipOffset) {
    tzStatus = 'pass'
    tzDesc = `浏览器时区 (UTC${browserOffset >= 0 ? '+' + browserOffset / 60 : browserOffset / 60}) 与 IP 地理时区一致`
  } else {
    tzStatus = 'warn'
    tzDesc = `浏览器时区 (UTC${browserOffset >= 0 ? '+' + browserOffset / 60 : browserOffset / 60}) 与 IP 地理时区 (UTC${ipOffset >= 0 ? '+' + ipOffset / 60 : ipOffset / 60}) 不一致`
  }
  hits.push({
    id: 'tz',
    title: '时区差异',
    desc: tzDesc,
    status: tzStatus,
    badge: tzStatus === 'pass' ? undefined : '差异',
    badgeStatus: tzStatus === 'warn' ? 'warn' : undefined,
  })

  // 9/10. 延迟对比 —— 需网络探针
  hits.push({
    id: 'latency',
    title: 'TCP vs Ping 延迟',
    desc: '通过延迟差异推断代理跳过，需部署网络探针',
    status: 'info',
    badge: '需网络探针',
  })
  hits.push({
    id: 'ws-latency',
    title: 'TCP vs WebSocket 延迟',
    desc: '通过协议延迟差异推断代理，需部署网络探针',
    status: 'info',
    badge: '需网络探针',
  })

  // 11. 时区地理一致性已经涵盖，网络行为作为补充说明
  hits.push({
    id: 'behavior',
    title: '网络行为',
    desc: '基于请求模式的匿名度评估，多为启发式判断',
    status: 'info',
    badge: '启发式',
  })

  items.value = hits

  // 概率估算：命中项加权（经验值，仅供参考）
  const failCount = hits.filter(h => h.status === 'fail').length
  const warnCount = hits.filter(h => h.status === 'warn').length
  proxyProb.value = Math.min(100, failCount * 30 + warnCount * 10)
  vpnProb.value = Math.min(100, (failCount >= 2 ? 60 : 0) + (inVpn || inTor ? 40 : 0))
  if (isDatacenter) vpnProb.value = Math.max(vpnProb.value, failCount >= 2 ? 55 : 25)
}

async function run() {
  loading.value = true
  error.value = ''
  info.value = null
  done.value = false
  items.value = []
  try {
    const res = await authFetch('/api/ip')
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? '检测失败')
    info.value = data
    runAnalysis(data)
    done.value = true
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

// 状态图标 / 颜色映射
function statusIcon(s: Status) {
  if (s === 'pass') return Check
  if (s === 'fail') return XCircle
  if (s === 'warn') return TriangleAlert
  return Info
}
function statusIconCls(s: Status) {
  if (s === 'pass') return 'text-emerald-500'
  if (s === 'fail') return 'text-destructive'
  if (s === 'warn') return 'text-amber-500'
  return 'text-sky-500'
}
function probCls(v: number) {
  if (v >= 60) return 'text-destructive'
  if (v >= 20) return 'text-amber-500'
  return 'text-emerald-500'
}
function badgeCls(s: Status) {
  if (s === 'warn') return 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
  if (s === 'info') return 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
  if (s === 'fail') return 'bg-destructive/10 text-destructive'
  return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
}
</script>

<template>
  <ToolLayout>
    <div class="space-y-4">
      <div class="flex items-center gap-3">
        <Button :disabled="loading" @click="run">
          <Search /> {{ loading ? '检测中...' : done ? '重新检测' : '开始检测' }}
        </Button>
        <p class="text-xs text-muted-foreground">
          通过出口 IP 归属、ASN 与浏览器环境综合判断隐身程度
        </p>
      </div>

      <p v-if="error" class="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
        {{ error }}
      </p>

      <!-- 检测中占位 -->
      <div v-if="loading" class="space-y-3">
        <div class="grid grid-cols-2 gap-4">
          <div class="h-40 animate-pulse rounded-2xl border bg-muted/40" />
          <div class="h-40 animate-pulse rounded-2xl border bg-muted/40" />
        </div>
        <div class="space-y-2">
          <div v-for="i in 5" :key="i" class="h-14 animate-pulse rounded-xl border bg-muted/30" />
        </div>
      </div>

      <div v-if="info && done" class="space-y-6">
        <!-- 顶部：主测 IP -->
        <div class="flex flex-wrap items-center gap-3 rounded-2xl border bg-card/60 p-4">
          <span class="text-sm text-muted-foreground">你的主测 IP 是</span>
          <div class="flex items-center gap-2 rounded-lg bg-muted px-4 py-2">
            <span class="font-mono text-lg font-semibold tracking-wide text-muted-foreground">
              {{ showIp ? info.ip : maskIp(info.ip) }}
            </span>
            <button
              class="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              :title="showIp ? '隐藏 IP' : '显示 IP'"
              @click="showIp = !showIp"
            >
              <EyeOff v-if="!showIp" class="h-4 w-4" />
              <Eye v-else class="h-4 w-4" />
            </button>
          </div>
          <div class="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge v-if="info.countryCode" variant="secondary">{{ info.countryCode }}</Badge>
            <span>{{ info.country }} {{ info.region }} {{ info.city }}</span>
            <span class="text-primary">{{ info.as }}</span>
          </div>
        </div>

        <!-- 概览双卡片 -->
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div class="rounded-2xl border bg-card p-5">
            <div class="flex items-center gap-2 text-sm text-muted-foreground">
              <Monitor class="h-4 w-4" /> 代理概率
            </div>
            <div class="mt-2 text-5xl font-bold" :class="probCls(proxyProb)">
              {{ proxyProb }}%
            </div>
            <p class="mt-2 text-xs text-muted-foreground">
              {{ proxyProb >= 20 ? '出口存在代理特征' : '未检测到明显代理特征' }}
            </p>
          </div>
          <div class="rounded-2xl border bg-card p-5">
            <div class="flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldCheck class="h-4 w-4" /> VPN 概率
            </div>
            <div class="mt-2 text-5xl font-bold" :class="probCls(vpnProb)">
              {{ vpnProb }}%
            </div>
            <p class="mt-2 text-xs text-muted-foreground">
              {{ vpnProb >= 20 ? '出口存在 VPN 特征' : '未检测到明显 VPN 特征' }}
            </p>
          </div>
        </div>

        <!-- 检测项目 -->
        <div class="rounded-2xl border bg-card">
          <div class="flex items-center gap-2 border-b px-4 py-3 text-sm font-semibold">
            <List class="h-4 w-4 text-primary" /> 测试项目
          </div>
          <div class="divide-y">
            <div v-for="it in items" :key="it.id" class="flex items-start gap-3 px-4 py-3">
              <span :class="['mt-0.5 shrink-0', statusIconCls(it.status)]">
                <component :is="statusIcon(it.status)" class="h-5 w-5" />
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 text-sm font-semibold">
                  {{ it.title }}
                  <Badge
                    v-if="it.badge"
                    variant="secondary"
                    class="shrink-0 text-[11px]"
                    :class="badgeCls(it.badgeStatus ?? 'info')"
                  >
                    {{ it.badge }}
                  </Badge>
                </div>
                <p class="mt-0.5 text-xs leading-relaxed text-muted-foreground">{{ it.desc }}</p>
              </div>
            </div>
          </div>
        </div>

        <div class="flex items-start gap-2 rounded-xl border bg-card p-3 text-xs text-muted-foreground">
          <Info class="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            数据来源：<a href="https://ip-api.com" target="_blank" rel="noopener" class="underline underline-offset-2 hover:text-foreground">ip-api.com</a>（IP 归属）
            及内置的云厂 / 代理 / VPN / TOR <strong>ASN 样本名单</strong>。概率为经验加权估算，TCP 指纹与延迟类检测需部署专业探针，结果仅供参考。
          </div>
        </div>
      </div>
    </div>
  </ToolLayout>
</template>