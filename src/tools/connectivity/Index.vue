<script setup lang="ts">
import { computed, ref } from 'vue'
import {
  Activity, Circle, CircleCheck, Clock, LoaderCircle, Plus, RefreshCw, Square, TriangleAlert, X,
} from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import BrandIcon from '@/components/BrandIcon.vue'
import ToolLayout from '@/components/ToolLayout.vue'

// 预置服务（探测由浏览器直连发起，反映用户本机网络）
const SERVICES: { name: string; url: string; category: string }[] = [
  { name: 'ChatGPT', category: 'AI', url: 'https://chat.openai.com' },
  { name: 'Claude', category: 'AI', url: 'https://claude.ai' },
  { name: 'Gemini', category: 'AI', url: 'https://gemini.google.com' },
  { name: 'Grok', category: 'AI', url: 'https://grok.com' },
  { name: 'GitHub', category: '开发', url: 'https://github.com' },
  { name: 'Cloudflare', category: '开发', url: 'https://www.cloudflare.com' },
  { name: 'Vercel', category: '开发', url: 'https://vercel.com' },
  { name: 'npm', category: '开发', url: 'https://www.npmjs.com' },
  { name: 'Docker Hub', category: '开发', url: 'https://hub.docker.com' },
  { name: '阿里云', category: '国内云', url: 'https://www.aliyun.com' },
  { name: '腾讯云', category: '国内云', url: 'https://cloud.tencent.com' },
  { name: '百度', category: '国内服务', url: 'https://www.baidu.com' },
  { name: '微信', category: '国内服务', url: 'https://weixin.qq.com' },
  { name: '哔哩哔哩', category: '国内服务', url: 'https://www.bilibili.com' },
  { name: 'Apple（国内）', category: '国内服务', url: 'https://www.apple.com.cn' },
  { name: 'Google', category: '海外服务', url: 'https://www.google.com' },
  { name: 'Apple（海外）', category: '海外服务', url: 'https://www.apple.com' },
  { name: 'YouTube', category: '海外服务', url: 'https://www.youtube.com' },
  { name: 'V2EX', category: '海外服务', url: 'https://www.v2ex.com' },
]
const DEFAULT_URLS = new Set(SERVICES.map(s => s.url))

const ROUNDS = 10 // 持续检测：每个站点共采样 10 次
const TIMEOUT_MS = 8000 // 单次探测超时
const SLOW_MS = 3000 // 响应超过该值判定为「缓慢」

type Status = 'up' | 'degraded' | 'down'
interface Sample { status: Status; ms: number }
interface Service { name: string; url: string; category: string; samples: Sample[]; running: boolean }

const services = ref<Service[]>(SERVICES.map(s => ({ ...s, samples: [], running: false })))
const runningAll = ref(false)
const progress = ref(0)

// 分类分组（预置分类在前，自定义在后）
const categories = ['AI', '开发', '国内云', '国内服务', '海外服务', '自定义']

// 全局检测纪元：仅「停止」与「全部重测」时自增以中断旧循环；单项并发不改变它，故互不影响
let epoch = 0

// 自定义添加
const showAdd = ref(false)
const addName = ref('')
const addUrl = ref('')
const addErr = ref('')

// ---------- 汇总统计（顶部胶囊式概览） ----------
function lastOf(s: Service): Sample | undefined {
  return s.samples[s.samples.length - 1]
}
const hasRun = computed(() => services.value.some(s => s.samples.length))
const okCount = computed(() => services.value.filter(s => lastOf(s)?.status === 'up').length)
const downCount = computed(() => services.value.filter(s => {
  const l = lastOf(s)
  return !!l && (l.status === 'down' || l.status === 'degraded')
}).length)
const avgLatency = computed(() => {
  const all = services.value.flatMap(s => s.samples.filter(x => x.ms > 0).map(x => x.ms))
  if (!all.length) return 0
  return Math.round(all.reduce((a, b) => a + b, 0) / all.length)
})

// ---------- 卡片展示 ----------
const STATUS_VIEW: Record<Status, { label: string; cls: string; icon: typeof Circle; bar: string }> = {
  up: { label: '可用', cls: 'text-emerald-500', icon: CircleCheck, bar: 'bg-emerald-500' },
  degraded: { label: '缓慢', cls: 'text-amber-500', icon: TriangleAlert, bar: 'bg-amber-500' },
  down: { label: '不可达', cls: 'text-destructive', icon: Clock, bar: 'bg-destructive' },
}

function cardView(s: Service) {
  if (!s.samples.length) return { label: '未测试', cls: 'text-muted-foreground', icon: Circle }
  return STATUS_VIEW[s.samples[s.samples.length - 1].status]
}

function lastLatency(s: Service): number | null {
  for (let i = s.samples.length - 1; i >= 0; i--) {
    if (s.samples[i].status !== 'down') return s.samples[i].ms
  }
  return null
}

function latCls(ms: number): string {
  if (ms < 300) return 'text-emerald-500'
  if (ms < 1500) return 'text-amber-500'
  return 'text-destructive'
}

function sleep(ms: number) {
  return new Promise<void>(r => setTimeout(r, ms))
}

// ---------- 浏览器端直连探测 ----------
/**
 * 以 no-cors 模式从浏览器直接请求目标站点：
 * - fetch resolve 即证明 DNS/TCP/TLS 全链路可达（opaque 响应读不到状态码）
 * - reject（网络错误或超时中止）判定为不可达
 * 延迟用 performance.now() 计量，加随机查询参数破坏缓存
 */
async function probeUrl(url: string): Promise<Sample> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  let target = url
  try {
    const u = new URL(url)
    u.searchParams.set('_', `${Date.now()}${Math.random().toString(36).slice(2, 6)}`)
    target = u.toString()
  } catch {
    return { status: 'down', ms: 0 }
  }
  const start = performance.now()
  try {
    await fetch(target, { mode: 'no-cors', cache: 'no-store', signal: controller.signal })
    const ms = Math.round(performance.now() - start)
    return { status: ms >= SLOW_MS ? 'degraded' : 'up', ms }
  } catch {
    return { status: 'down', ms: Math.round(performance.now() - start) }
  } finally {
    clearTimeout(timer)
  }
}

/** 全量检测：持续采样 ROUNDS 次，每轮所有站点并发直连，边测边刷新；可被「停止」或新检测取消 */
async function detectAll() {
  epoch++ // 全部重测/开始：中断此前任何进行中的单项或全量
  const e = epoch
  runningAll.value = true
  for (const s of services.value) s.samples = []
  progress.value = 0
  try {
    for (let i = 1; i <= ROUNDS; i++) {
      if (e !== epoch) break
      // 一轮：所有站点并发探测，各自入栈
      await Promise.all(services.value.map(async (s) => {
        s.samples.push(await probeUrl(s.url))
      }))
      progress.value = i
      if (i < ROUNDS && e === epoch) await sleep(180)
    }
  } finally {
    runningAll.value = false
  }
}

/** 单项检测：只探测该服务，可与其它单项并发；可被「停止」或新检测取消 */
async function detectOne(s: Service) {
  const e = epoch // 单项并发：不改变纪元，多个单项互不取消；可被「停止」或「全部重测」中断
  s.running = true
  s.samples = []
  try {
    for (let i = 1; i <= ROUNDS; i++) {
      if (e !== epoch) break
      s.samples.push(await probeUrl(s.url))
      if (i < ROUNDS && e === epoch) await sleep(500)
    }
  } finally {
    s.running = false
  }
}

/** 停止：取消所有进行中的检测（全量与单项） */
function stop() {
  epoch++
  runningAll.value = false
  for (const s of services.value) s.running = false
}

// ---------- 自定义添加 ----------
function addCustom() {
  const url = addUrl.value.trim()
  const name = addName.value.trim()
  if (!/^https?:\/\//i.test(url)) {
    addErr.value = '链接需以 http(s):// 开头'
    return
  }
  if (services.value.some(s => s.url === url)) {
    addErr.value = '该站点已在列表中'
    return
  }
  services.value.push({ name: name || url, url, category: '自定义', samples: [], running: false })
  addUrl.value = ''
  addName.value = ''
  addErr.value = ''
  showAdd.value = false
}

function removeCustom(s: Service) {
  services.value = services.value.filter(x => x.url !== s.url)
}
</script>

<template>
  <ToolLayout>
    <div class="space-y-4">
      <!-- 顶部操作栏 -->
      <div class="flex flex-wrap items-center gap-2.5">
        <Button :disabled="runningAll" @click="detectAll()">
          <LoaderCircle v-if="runningAll" class="animate-spin" />
          <Activity v-else />
          {{ runningAll ? '检测中…' : hasRun ? '全部重测' : '开始检测' }}
        </Button>

        <Button v-if="runningAll" variant="outline" @click="stop()">
          <Square class="h-4 w-4" />
          停止
        </Button>

        <span
          v-if="runningAll"
          class="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold tabular-nums text-primary"
        >
          {{ progress }}/{{ ROUNDS }}
        </span>

        <div v-else-if="hasRun" class="flex flex-wrap items-center gap-1.5 text-xs">
          <span class="rounded-full bg-muted px-2.5 py-1 tabular-nums text-muted-foreground">
            共 {{ services.length }} 站点
          </span>
          <span class="rounded-full bg-emerald-500/10 px-2.5 py-1 font-medium text-emerald-600">
            {{ okCount }} 可用
          </span>
          <span class="rounded-full bg-destructive/10 px-2.5 py-1 font-medium text-destructive">
            {{ downCount }} 不可用
          </span>
          <span class="rounded-full bg-muted px-2.5 py-1 tabular-nums text-muted-foreground">
            avg {{ avgLatency }}ms
          </span>
        </div>

        <span v-else class="text-xs text-muted-foreground">点击开始，将持续采样 {{ ROUNDS }} 次，可随时停止</span>
      </div>

      <!-- 分组的服务卡片 -->
      <div class="space-y-5">
        <div v-for="cat in categories" :key="cat">
          <div
            v-if="services.some(s => s.category === cat)"
            class="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/80"
          >
            <span class="h-1.5 w-1.5 rounded-full bg-primary/70" />{{ cat }}
          </div>
          <div v-if="services.some(s => s.category === cat)" class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div
              v-for="s in services.filter(x => x.category === cat)"
              :key="s.url"
              class="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-sm transition-colors hover:border-primary/40"
            >
              <!-- 头部：品牌图标 + 名称 + 重测/移除 -->
              <div class="flex items-center gap-2.5">
                <BrandIcon :name="s.name" />
                <span class="min-w-0 flex-1 truncate text-sm font-semibold">{{ s.name }}</span>
                <button
                  class="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  :disabled="runningAll || s.running"
                  :title="'重测 ' + s.name"
                  @click="detectOne(s)"
                >
                  <RefreshCw class="h-4 w-4" :class="(runningAll || s.running) && 'animate-spin'" />
                </button>
                <button
                  v-if="!DEFAULT_URLS.has(s.url)"
                  class="rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                  :title="'移除 ' + s.name"
                  @click="removeCustom(s)"
                >
                  <X class="h-4 w-4" />
                </button>
              </div>

              <!-- 中部：状态徽章 + 延迟 -->
              <div class="flex items-center justify-between">
                <span class="inline-flex items-center gap-1.5 text-xs font-medium" :class="cardView(s).cls">
                  <component :is="cardView(s).icon" class="h-4 w-4" />
                  {{ cardView(s).label }}
                </span>
                <span
                  v-if="lastLatency(s) !== null"
                  class="font-mono text-sm tabular-nums"
                  :class="lastLatency(s)! > 0 && s.samples.length ? latCls(lastLatency(s)!) : 'text-foreground/80'"
                >
                  {{ lastLatency(s) }}<span class="text-xs text-muted-foreground">ms</span>
                </span>
                <span v-else-if="s.samples.length" class="font-mono text-xs text-muted-foreground">—</span>
              </div>

              <!-- 底部：采样条形图（10 次） -->
              <div class="flex h-1.5 items-end gap-[3px]">
                <span
                  v-for="i in ROUNDS"
                  :key="i"
                  class="h-full flex-1 rounded-sm"
                  :class="i <= s.samples.length ? STATUS_VIEW[s.samples[i - 1].status].bar : 'bg-muted'"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- 添加测试卡片 -->
        <div v-if="!showAdd" class="flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed bg-muted/20 p-4">
          <Button variant="outline" size="sm" @click="showAdd = true">
            <Plus class="h-4 w-4" />
            添加站点
          </Button>
        </div>
        <div v-else class="flex flex-wrap items-center gap-2 rounded-2xl border bg-muted/20 p-3">
          <Input v-model="addName" placeholder="名称（可选）" class="h-9 w-40" />
          <Input v-model="addUrl" placeholder="https://example.com" class="h-9 w-64" @keyup.enter="addCustom" />
          <Button size="sm" @click="addCustom">添加</Button>
          <Button size="sm" variant="ghost" @click="showAdd = false">取消</Button>
          <span v-if="addErr" class="text-xs text-destructive">{{ addErr }}</span>
        </div>
      </div>

      <div class="flex items-start gap-2 rounded-xl border bg-card p-3 text-xs text-muted-foreground">
        <Activity class="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div>
          检测方式：由<strong>您的浏览器</strong>直接向各服务官方网站发起探测（跨域 no-cors 请求），
          结果反映<strong>您本机网络</strong>到各站点的连通情况，而非服务器侧网络；
          <strong>持续采样共 {{ ROUNDS }} 次</strong>，条形图逐次填充。
          「不可达」表示连接失败或超时（{{ TIMEOUT_MS / 1000 }}s），不代表服务本身故障；「缓慢」表示响应超过 {{ SLOW_MS / 1000 }}s。
        </div>
      </div>
    </div>
  </ToolLayout>
</template>
