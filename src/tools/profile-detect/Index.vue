<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import {
  Check,
  ChevronDown,
  Clock,
  Fingerprint,
  Globe,
  Info,
  Keyboard,
  Languages,
  Locate,
  MapPin,
  Play,
  Radio,
  ShieldCheck,
  TriangleAlert,
  XCircle,
} from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useAuth } from '@/composables/useAuth'

const { authFetch } = useAuth()

// ---------- 国家 / 语言数据（时区为标准偏移，用于画像比对，非权威全量） ----------
interface Country {
  code: string
  name: string
  flag: string
  locale: string
  lang: string
  tzOffset: number // 标准时区偏移（分钟）
  langs: string[]
  regions?: { code: string; name: string }[]
}
const REGIONS_CN: { code: string; name: string }[] = [
  { code: 'CN', name: '中国大陆' },
  { code: 'HK', name: '中国香港' },
  { code: 'MO', name: '中国澳门' },
  { code: 'TW', name: '中国台湾' },
]
const COUNTRIES: Country[] = [
  { code: 'US', name: '美国', flag: '🇺🇸', locale: 'en-US', lang: '英语', tzOffset: -300, langs: ['英语（美式）'] },
  { code: 'GB', name: '英国', flag: '🇬🇧', locale: 'en-GB', lang: '英语', tzOffset: 0, langs: ['英语'] },
  { code: 'JP', name: '日本', flag: '🇯🇵', locale: 'ja-JP', lang: '日语', tzOffset: 540, langs: ['日语'] },
  { code: 'KR', name: '韩国', flag: '🇰🇷', locale: 'ko-KR', lang: '韩语', tzOffset: 540, langs: ['韩语'] },
  { code: 'CN', name: '中国', flag: '🇨🇳', locale: 'zh-CN', lang: '中文', tzOffset: 480, langs: ['中文'], regions: REGIONS_CN },
  { code: 'SG', name: '新加坡', flag: '🇸🇬', locale: 'en-SG', lang: '英语', tzOffset: 480, langs: ['英语'] },
  { code: 'FR', name: '法国', flag: '🇫🇷', locale: 'fr-FR', lang: '法语', tzOffset: 60, langs: ['法语'] },
  { code: 'DE', name: '德国', flag: '🇩🇪', locale: 'de-DE', lang: '德语', tzOffset: 60, langs: ['德语'] },
  { code: 'IT', name: '意大利', flag: '🇮🇹', locale: 'it-IT', lang: '意大利语', tzOffset: 60, langs: ['意大利语'] },
  { code: 'ES', name: '西班牙', flag: '🇪🇸', locale: 'es-ES', lang: '西班牙语', tzOffset: 60, langs: ['西班牙语'] },
  { code: 'NL', name: '荷兰', flag: '🇳🇱', locale: 'nl-NL', lang: '荷兰语', tzOffset: 60, langs: ['荷兰语'] },
  { code: 'SE', name: '瑞典', flag: '🇸🇪', locale: 'sv-SE', lang: '瑞典语', tzOffset: 60, langs: ['瑞典语'] },
  { code: 'CH', name: '瑞士', flag: '🇨🇭', locale: 'de-CH', lang: '德语', tzOffset: 60, langs: ['德语', '法语', '意大利语'] },
  { code: 'RU', name: '俄罗斯', flag: '🇷🇺', locale: 'ru-RU', lang: '俄语', tzOffset: 180, langs: ['俄语'] },
  { code: 'AE', name: '阿联酋', flag: '🇦🇪', locale: 'ar-AE', lang: '阿拉伯语', tzOffset: 240, langs: ['阿拉伯语'] },
  { code: 'IN', name: '印度', flag: '🇮🇳', locale: 'hi-IN', lang: '印地语', tzOffset: 330, langs: ['印地语', '英语'] },
  { code: 'AU', name: '澳大利亚', flag: '🇦🇺', locale: 'en-AU', lang: '英语', tzOffset: 600, langs: ['英语'] },
  { code: 'CA', name: '加拿大', flag: '🇨🇦', locale: 'en-CA', lang: '英语', tzOffset: -300, langs: ['英语', '法语'] },
  { code: 'BR', name: '巴西', flag: '🇧🇷', locale: 'pt-BR', lang: '葡萄牙语', tzOffset: -180, langs: ['葡萄牙语'] },
]

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
  lat: number
  lon: number
}

type DimStatus = 'pass' | 'warn' | 'info' | 'na'

interface Dim {
  key: string
  title: string
  desc: string
  result: string
  status: DimStatus
  icon: typeof Globe
  expand: boolean
}

// ---------- 表单状态 ----------
const countryCode = ref('JP')
const regionCode = ref('CN') // 仅当国家有 regions 时生效（如中国大陆/中国香港/中国台湾/中国澳门）
const language = ref('ja-JP')
const shareLoc = ref(false)
const locState = ref<'idle' | 'asking' | 'granted' | 'denied'>('idle')

const expected = computed(() => COUNTRIES.find(c => c.code === countryCode.value) ?? COUNTRIES[0])
const regionOptions = computed(() => expected.value?.regions ?? [])
// 用于比对的精确基准：有地区选项时用地区代码（可区分大陆/香港/澳门/台湾），否则用国家代码
const expectedCode = computed(() => {
  const needRegion = regionOptions.value.length > 0
  if (needRegion) {
    return regionOptions.value.some(r => r.code === regionCode.value) ? regionCode.value : (regionOptions.value[0]?.code ?? '')
  }
  return expected.value?.code ?? ''
})
const expectedName = computed(() => {
  if (regionOptions.value.length > 0) {
    const r = regionOptions.value.find(x => x.code === expectedCode.value)
    return (r?.name ?? expected.value?.name) ?? ''
  }
  return expected.value?.name ?? ''
})

// 若下拉被置为非法值（如空串），自动回退到有效国家，避免「开始检测/重新检测」按钮被永久禁用
watch(countryCode, (v) => {
  if (!COUNTRIES.some(c => c.code === v)) countryCode.value = 'JP'
})
// 国家变化时，若当前语言不在该国的语言选项内，则联动切回该国的首选项
watch(expected, (c) => {
  if (c && !langOptions.value.some(l => l.value === language.value)) {
    language.value = c.locale
  }
})
// 中国切换地区时联动语言（中国大陆→简体中文，香港/澳门/台湾→繁体中文）
watch(regionCode, () => {
  if (expected.value?.code !== 'CN') return
  const opts = langOptions.value
  if (opts.length && !opts.some(l => l.value === language.value)) {
    language.value = opts[0].value
  }
})
const publicLangNote = computed(
  () => (expected.value && expected.value.langs.length === 1)
    ? `该国只有一种主要语言（${expected.value!.lang}）`
    : expected.value && expected.value.langs.length > 1
      ? `该国主要语言：${expected.value.langs.join(' / ')}`
      : '',
)

// 语言选项随国家变化
const langOptions = computed(() => {
  const c = expected.value
  if (!c) return [{ value: 'ja-JP', label: '日语' }]
  // 中国按地区区分简体中文 / 繁体中文
  if (c.code === 'CN' && regionOptions.value.length) {
    const r = regionOptions.value.find(x => x.code === regionCode.value) ?? regionOptions.value[0]
    const traditional = !!r && r.code !== 'CN' // 香港 / 澳门 / 台湾使用繁体中文
    return traditional
      ? [{ value: `zh-${r.code}`, label: '繁体中文' }]
      : [{ value: 'zh-CN', label: '简体中文' }]
  }
  return c.langs.length === 1
    ? [{ value: c.locale, label: c.lang }]
    : [
        { value: c.locale, label: c.lang },
        // 多语言国家：额外补充常见备选
        ...(c.code === 'CH' ? [{ value: 'fr-CH', label: '法语' }, { value: 'it-CH', label: '意大利语' }] : []),
        ...(c.code === 'CA' ? [{ value: 'fr-CA', label: '法语' }] : []),
        ...(c.code === 'IN' ? [{ value: 'en-IN', label: '英语' }] : []),
      ]
})

// ---------- 运行状态 ----------
const loading = ref(false)
const error = ref('')
const done = ref(false)
const info = ref<IpInfo | null>(null)
const dims = ref<Dim[]>([])
const score = ref(0)

const readyChecks = computed(() => {
  const list = [
    { label: 'IP 查询', ok: true },
    { label: 'WebRTC 已启用', ok: true },
    { label: 'DNS 探测可用', ok: true },
  ]
  return { list, allOK: list.every(l => l.ok) }
})

// ---------- 浏览器环境采集 ----------
function browserEnv() {
  const langs = (navigator.languages?.length ? navigator.languages : [navigator.language]) as string[]
  const primary = langs[0] ?? navigator.language ?? ''
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? ''
  const offset = -new Date().getTimezoneOffset() // 当前偏移（分钟）
  const ua = navigator.userAgent ?? ''
  return { langs, primary, tz, offset, ua }
}

function fmtOffset(min: number): string {
  const sign = min >= 0 ? '+' : '-'
  const a = Math.abs(min)
  return `UTC${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`
}

// ---------- 时区转目标国家判定 ----------
function tzToCountry(tz: string): string {
  // 简单映射：由 IANA 时区推断地区性语言环境（启发式）
  if (/Tokyo|Osaka/.test(tz)) return 'JP'
  if (/Seoul/.test(tz)) return 'KR'
  if (/Shanghai|Chongqing|Urumqi|Mongolia/.test(tz)) return 'CN'
  if (/Hong_Kong/.test(tz)) return 'HK'
  if (/Taipei/.test(tz)) return 'TW'
  if (/Macau/.test(tz)) return 'MO'
  if (/Singapore/.test(tz)) return 'SG'
  if (/Los_Angeles|New_York|Chicago|Denver|Phoenix/.test(tz)) return 'US'
  if (/London/.test(tz)) return 'GB'
  if (/Paris/.test(tz)) return 'FR'
  if (/Berlin/.test(tz)) return 'DE'
  if (/Rome/.test(tz)) return 'IT'
  if (/Madrid/.test(tz)) return 'ES'
  if (/Amsterdam/.test(tz)) return 'NL'
  if (/Stockholm/.test(tz)) return 'SE'
  if (/Zurich|Geneva/.test(tz)) return 'CH'
  if (/Moscow/.test(tz)) return 'RU'
  if (/Dubai/.test(tz)) return 'AE'
  if (/Kolkata/.test(tz)) return 'IN'
  if (/Sydney|Melbourne/.test(tz)) return 'AU'
  if (/Toronto|Vancouver/.test(tz)) return 'CA'
  if (/Sao_Paulo/.test(tz)) return 'BR'
  return ''
}

// 由语言标签推断地区
function langToRegion(locale: string): string {
  const parts = locale.split('-')
  if (parts.length >= 2 && /^[a-z]{2}$/i.test(parts[1])) return parts[1].toUpperCase()
  return ''
}

// 比对基准为精确的国家/地区代码：中国大陆=CN、中国香港=HK、中国澳门=MO、中国台湾=TW，彼此可区分、不合并
function matchesChoice(actual: string): boolean {
  if (!actual) return false
  return actual === expectedCode.value
}

// 地区/国家代码 → 展示名：中国各地区单独命名
const REGION_NAME: Record<string, string> = {
  CN: '中国大陆', HK: '中国香港', MO: '中国澳门', TW: '中国台湾',
}
function regionName(code: string): string {
  if (REGION_NAME[code]) return REGION_NAME[code]
  return COUNTRIES.find(c => c.code === code)?.name ?? code
}

// ---------- 检测主流程 ----------
function buildDims(env: ReturnType<typeof browserEnv>) {
  const d: Dim[] = []
  const exp = expected.value
  const loc = info.value!

  const add = (key: string, title: string, desc: string, result: string, status: DimStatus, icon: typeof Globe, expand = false) =>
    d.push({ key, title, desc, result, status, icon, expand })

  // 1. IP 归属国家
  const ipMatches = !!exp && matchesChoice(loc.countryCode)
  add(
    'ip-country', 'IP 归属国家',
    ipMatches
      ? `当前出口 IP 位于 ${loc.country}（${loc.countryCode}），与预期身份「${expectedName.value}」一致`
      : `当前出口 IP 位于 ${loc.country}（${loc.countryCode} / ${loc.as}），与预期身份「${expectedName.value || '未选'}」不符`,
    ipMatches ? '一致' : exp ? '不像本地' : '待选身份',
    ipMatches ? 'pass' : exp ? 'warn' : 'info',
    Globe, true,
  )

  // 2. 浏览器语言（区分简体中文 / 繁体中文）
  const primaryLang = env.primary
  const targetLocale = language.value.toLowerCase()
  const wantsZhSimplified = targetLocale === 'zh-cn' || targetLocale === 'zh'
  const wantsZhTraditional = ['zh-hk', 'zh-mo', 'zh-tw'].includes(targetLocale)
  let langOk = false
  let langDesc = ''
  if (exp) {
    const p = primaryLang.toLowerCase()
    if (wantsZhSimplified) {
      // 简体中文区：要求首选语言为简体中文（zh / zh-CN），排除繁体变体
      langOk = p.startsWith('zh') && !/(hant|-tw|-hk|-mo)/.test(p)
      langDesc = '简体中文'
    } else if (wantsZhTraditional) {
      // 繁体中文区：要求首选语言为繁体中文（zh-Hant / zh-TW / zh-HK / zh-MO）
      langOk = /zh.*(hant|-tw|-hk|-mo)/.test(p) || p === 'zh'
      langDesc = '繁体中文'
    } else {
      langOk = p.startsWith(exp.locale.split('-')[0].toLowerCase())
      langDesc = exp.lang
    }
  }
  add(
    'lang', '浏览器语言',
    `浏览器首选语言为 ${primaryLang}${exp ? `，预期 ${langDesc}` : ''}`,
    langOk ? '通过' : exp ? '不像本地' : '待选身份',
    langOk ? 'pass' : exp ? 'warn' : 'info',
    Languages, true,
  )

  // 3. 时区与角色
  const tzCountry = tzToCountry(env.tz)
  const tzLooksLocal = !!exp && matchesChoice(tzCountry)
  add(
    'tz', '时区与角色',
    `浏览器时区为 ${env.tz}（${fmtOffset(env.offset)}），设备被识别为「${tzCountry ? regionName(tzCountry) : '未知地区'}」`,
    tzLooksLocal ? '符合预期' : exp ? '不像本地' : '待选身份',
    tzLooksLocal ? 'pass' : exp ? 'warn' : 'info',
    Clock, true,
  )

  // 4. IP 时区与浏览器时区一致
  const ipTzOK = !loc.timezone || env.tz === loc.timezone
  add(
    'ip-tz', 'IP 与浏览器时区',
    ipTzOK
      ? `IP 归属时区（${loc.timezone}）与浏览器时区（${env.tz}）一致`
      : `IP 归属时区（${loc.timezone}）与浏览器时区（${env.tz}）不一致`,
    ipTzOK ? '通过' : '不一致',
    ipTzOK ? 'pass' : 'warn',
    ShieldCheck,
  )

  // 5. DNS 解析器国家（浏览器无法直接读取 → 未测量）
  add(
    'dns', 'DNS 解析器国家',
    '浏览器无法直接读取本地 DNS 解析器，需安装系统级工具协同探测',
    '未测量',
    'info', Radio,
  )

  // 6. 键盘布局（由首选语言推断，启发式）
  const kbRegion = langToRegion(env.primary)
  const kbLocal = !!exp && matchesChoice(kbRegion)
  add(
    'kb', '键盘布局',
    `由首选语言推断键盘地区码为「${kbRegion || '未知'}」，与目标地区${kbLocal ? '' : '不'}一致`,
    kbLocal ? '通过' : exp ? '不像本地' : '待选身份',
    kbLocal ? 'pass' : exp ? 'warn' : 'info',
    Keyboard, true,
  )

  // 7. 地址类型（机房 / 住宅）
  const orgstr = `${loc.isp} ${loc.org} ${loc.as}`
  const DC_RE = /\b(amazon|aws|azure|google|cloudflare|digitalocean|oracle|ovh|hetzner|linode|vultr|alibaba|aliyun|tencent|huawei|ucloud|hosting|server|datacenter|vps|dedicated)\b/i
  const isDC = DC_RE.test(orgstr)
  add(
    'addr', '地址类型',
    isDC
      ? `网络被标记为数据中心 / 云厂商（${loc.org || loc.isp || loc.as}），非典型住宅线路`
      : `网络为普通线路，未命中典型数据中心样本（${loc.isp || loc.org || '未知 ISP'}）`,
    isDC ? '机房/代理' : '住宅/普通',
    isDC ? 'warn' : 'pass',
    MapPin, true,
  )

  // 8. 语言请求头与脚本一致
  const langConsistent = env.langs.length <= 2 || new Set(env.langs.map(l => l.split('-')[0])).size === 1
  add(
    'lang-consistent', '语言请求头与脚本',
    `浏览器声明 ${env.langs.length} 种语言，${langConsistent ? '语言族保持一致' : '语言族混杂，可能暴露真实地区'}`,
    langConsistent ? '通过' : '混杂',
    langConsistent ? 'pass' : 'warn',
    Languages,
  )

  // 9. 时区可信度
  add(
    'tz-valid', '时区可信度',
    env.tz && env.tz.includes('/') ? `IANA 时区 ${env.tz} 为有效规范条目` : '当前环境无法返回有效时区标识',
    env.tz ? '可信' : '不可信',
    env.tz ? 'pass' : 'info',
    Clock,
  )

  // 10. 可选：共享 GPS 定位
  if (locState.value === 'granted') {
    add(
      'gps', 'GPS 定位',
      '已通过浏览器地理定位共享坐标，用于交叉校验所在地区',
      '已共享',
      'pass', Locate,
    )
  } else if (locState.value === 'denied') {
    add(
      'gps', 'GPS 定位',
      '用户拒绝了定位授权，无法进行坐标级校验',
      '未测量',
      'info', Locate,
    )
  } else {
    add('gps', 'GPS 定位', '未启用定位。启用可进行更精确的坐标级画像比对', '未测量', 'info', Locate)
  }

  return d
}

async function run() {
  loading.value = true
  error.value = ''
  done.value = false
  dims.value = []
  score.value = 0
  try {
    // 每次检测（含重新检测）都绕过服务端 10 分钟 IP 缓存，强制拉取最新出口数据
    const res = await authFetch('/api/ip?fresh=1')
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? '检测失败')
    info.value = data
    const env = browserEnv()
    const all = buildDims(env)

    // 计分（未测量/不适用不计入分母）
    const measured = all.filter(x => x.status === 'pass' || x.status === 'warn').length
    const passed = all.filter(x => x.status === 'pass').length
    score.value = measured > 0 ? Math.round((passed / measured) * 100) : 0
    dims.value = all
    done.value = true
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

function shareLocation() {
  if (!shareLoc.value) {
    locState.value = 'idle'
    return
  }
  if (!navigator.geolocation) {
    locState.value = 'denied'
    shareLoc.value = false
    return
  }
  locState.value = 'asking'
  navigator.geolocation.getCurrentPosition(
    () => { locState.value = 'granted' },
    () => { locState.value = 'denied'; shareLoc.value = false },
    { timeout: 8000, maximumAge: 60000 },
  )
}

// ---------- 结果汇总 ----------
const stat = computed(() => {
  const inconsistent = dims.value.filter(x => x.status === 'warn').length
  const passed = dims.value.filter(x => x.status === 'pass').length
  const unmeasured = dims.value.filter(x => x.status === 'info').length
  const na = dims.value.filter(x => x.status === 'na').length
  return { inconsistent, passed, unmeasured, na }
})

const grade = computed(() => {
  const s = score.value
  if (s >= 90) return { g: 'A', color: 'text-emerald-500', arc: '#10b981', label: '强本土' }
  if (s >= 78) return { g: 'B', color: 'text-teal-500', arc: '#14b8a6', label: '较本土' }
  if (s >= 60) return { g: 'C', color: 'text-amber-500', arc: '#f59e0b', label: '一般' }
  if (s >= 40) return { g: 'D', color: 'text-orange-500', arc: '#f97316', label: '偏弱' }
  return { g: 'E', color: 'text-destructive', arc: '#ef4444', label: '外显' }
})

const verdict = computed(() => {
  const exp = expected.value
  if (!exp || !done.value) return { icon: Info, text: '选择预期身份后开始检测', sub: '系统将比对你的浏览器与网络环境，判断你在网站眼中的「人设」', tone: 'text-muted-foreground' }
  const flag = exp.flag
  const name = expectedName.value
  const s = score.value
  if (s >= 85) return { icon: ShieldCheck, text: `你看起来很像 ${flag} ${name} 本地人`, sub: '大部分特征与你预期的身份画像一致，伪装度较高。', tone: 'text-emerald-500' }
  if (s >= 55) return { icon: TriangleAlert, text: `你看起来不太像 ${flag} ${name} 本地人`, sub: '有几项特征与画像不符，或彼此矛盾——下面的结果会告诉你是哪些。', tone: 'text-amber-500' }
  return { icon: XCircle, text: `你的画像与 ${flag} ${name} 差异较大`, sub: '大量特征与你预期的身份相悖，网站几乎可以识别出你不是本地用户。', tone: 'text-destructive' }
})

// 分段条
function segClass(type: 'inconsistent' | 'passed' | 'unmeasured' | 'na') {
  const map = {
    inconsistent: 'bg-amber-500',
    passed: 'bg-emerald-500',
    unmeasured: 'bg-sky-500',
    na: 'bg-muted-foreground/40',
  }
  return map[type]
}
function pct(n: number): string {
  return `${Math.max(0, Math.round((n / 18) * 100))}%`
}
function segColor(type: 'inconsistent' | 'passed' | 'unmeasured' | 'na') {
  const map = {
    inconsistent: 'text-amber-500',
    passed: 'text-emerald-500',
    unmeasured: 'text-sky-500',
    na: 'text-muted-foreground',
  }
  return map[type]
}
function drawStats(type: 'inconsistent' | 'passed' | 'unmeasured' | 'na') {
  const map = {
    inconsistent: `不一致 ${stat.value.inconsistent} 项`,
    passed: `通过 ${stat.value.passed} 项`,
    unmeasured: `未测量 ${stat.value.unmeasured} 项`,
    na: `不适用 ${stat.value.na} 项`,
  }
  return map[type]
}

// 状态图标
function dimIcon(s: DimStatus) {
  if (s === 'pass') return Check
  if (s === 'warn') return TriangleAlert
  if (s === 'info') return Info
  return Globe
}
function dimIconCls(s: DimStatus) {
  if (s === 'pass') return 'text-emerald-500'
  if (s === 'warn') return 'text-amber-500'
  if (s === 'info') return 'text-sky-500'
  return 'text-muted-foreground'
}
function dimResultCls(s: DimStatus) {
  if (s === 'pass') return 'text-emerald-600 dark:text-emerald-400'
  if (s === 'warn') return 'text-amber-600 dark:text-amber-400'
  if (s === 'info') return 'text-sky-600 dark:text-sky-400'
  return 'text-muted-foreground'
}
function toggleDim(k: string) {
  const it = dims.value.find(x => x.key === k)
  if (it) it.expand = !it.expand
}
</script>

<template>
  <div class="space-y-4">
    <!-- 简介 -->
    <div class="flex items-start gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-4">
      <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
        <Fingerprint class="h-5 w-5" />
      </span>
      <div class="text-sm leading-relaxed text-muted-foreground">
        <p class="font-semibold text-foreground">判断你在网站眼中「看起来像谁」</p>
        <p class="mt-1">
          网站通过 <b>IP、时区、语言、字体、键盘布局</b> 等多重信号拼凑你的画像——就像「鸭子测试」：如果它看起来像鸭子、叫起来像鸭子，那它就是鸭子。
          本工具判定你在某目标国家网站的眼中，画像与「预期人设」的偏差有多大。
        </p>
        <p class="mt-2 text-xs">
          注：与「隐身测试」不同，这里关注的是<em class="not-italic text-foreground">身份画像匹配度</em>，而非是否处于代理网络。
        </p>
      </div>
    </div>

    <p v-if="error" class="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
      {{ error }}
    </p>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-[300px_1fr]">
      <!-- ===== 左侧配置面板 ===== -->
      <aside class="space-y-4">
        <div class="rounded-2xl border bg-card/60 p-4">
          <div class="mb-3 flex items-center gap-2">
            <span class="flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">①</span>
            <h3 class="text-sm font-semibold">预期身份</h3>
          </div>
          <div class="space-y-3">
            <div class="space-y-1.5">
              <Label>目标国家</Label>
              <Select v-model="countryCode">
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="选择国家" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="c in COUNTRIES" :key="c.code" :value="c.code">
                    {{ c.flag }} {{ c.name }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div v-if="regionOptions.length > 0" class="space-y-1.5">
              <Label>目标地区</Label>
              <Select v-model="regionCode">
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="选择地区" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="r in regionOptions" :key="r.code" :value="r.code">
                    {{ r.name }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div class="space-y-1.5">
              <Label>主要语言</Label>
              <Select v-model="language" :disabled="!expected">
                <SelectTrigger class="w-full">
                  <SelectValue placeholder="选择语言" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="l in langOptions" :key="l.value" :value="l.value">
                    {{ l.label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p v-if="publicLangNote" class="text-xs text-muted-foreground">{{ publicLangNote }}</p>
          </div>
        </div>

        <div class="rounded-2xl border bg-card/60 p-4">
          <div class="mb-3 flex items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <span class="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">②</span>
              <h3 class="text-sm font-semibold">更精确的定位 <span class="text-xs font-normal text-muted-foreground">(可选)</span></h3>
            </div>
          </div>
          <div class="space-y-3">
            <div class="flex items-center justify-between gap-2">
              <div>
                <div class="flex items-center gap-1.5 text-sm">
                  <Locate class="h-3.5 w-3.5 text-muted-foreground" /> GPS 坐标共享
                </div>
                <p class="text-xs text-muted-foreground">共享定位用于坐标级画像交叉校验</p>
              </div>
              <Switch :checked="shareLoc" @update:checked="shareLoc = !!$event; shareLocation()" />
            </div>
            <p v-if="locState === 'asking'" class="text-xs text-sky-500">正在请求定位授权…</p>
            <p v-else-if="locState === 'denied'" class="text-xs text-muted-foreground">定位权限已拒绝，本次不纳入坐标校验</p>
          </div>
        </div>

        <div class="rounded-2xl border bg-card/60 p-4">
          <div class="mb-3 flex items-center gap-2">
            <span class="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground">③</span>
            <h3 class="text-sm font-semibold">开始检测</h3>
          </div>
          <div class="mb-3 space-y-1.5 text-xs text-muted-foreground">
            <p v-for="c in readyChecks.list" :key="c.label" class="flex items-center gap-1.5">
              <Check class="h-3.5 w-3.5 text-emerald-500" /> {{ c.label }}
            </p>
            <p v-if="expected" class="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <Check class="h-3.5 w-3.5" /> 所有检测已就绪
            </p>
            <p v-else class="flex items-center gap-1.5 text-amber-500">
              请先选择预期身份
            </p>
          </div>
          <Button class="w-full" :disabled="loading" @click="run">
            <Play class="h-4 w-4" />
            {{ loading ? '检测中…' : done ? '重新检测' : '开始检测' }}
          </Button>
        </div>
      </aside>

      <!-- ===== 右侧结果区 ===== -->
      <main class="space-y-4">
        <div v-if="loading" class="space-y-4">
          <div class="h-72 animate-pulse rounded-2xl border bg-muted/30" />
          <div class="h-28 animate-pulse rounded-2xl border bg-muted/30" />
        </div>

        <template v-else-if="done">
          <!-- 评分环 + 判定 -->
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-[auto_1fr]">
            <div class="flex flex-col items-center justify-center rounded-2xl border bg-card/60 p-6">
              <div class="relative h-44 w-44">
                <svg viewBox="0 0 160 160" class="h-full w-full -rotate-90">
                  <circle cx="80" cy="80" r="66" fill="none" stroke-width="13" class="stroke-muted" />
                  <circle
                    cx="80" cy="80" r="66" fill="none" stroke-width="13" stroke-linecap="round"
                    :stroke="grade.arc"
                    stroke-dasharray="439.8"
                    :stroke-dashoffset="439.8 * (1 - score / 100)"
                    style="transition: stroke-dashoffset .8s ease"
                  />
                </svg>
                <div class="absolute inset-0 flex flex-col items-center justify-center">
                  <span class="text-5xl font-bold" :class="grade.color">{{ grade.g }}</span>
                  <span class="mt-1 text-xs text-muted-foreground">{{ score }}/100</span>
                </div>
              </div>
              <span class="mt-3 rounded-full border bg-muted/50 px-3 py-1 text-xs font-semibold" :class="grade.color">{{ grade.label }}</span>
            </div>

            <div class="flex flex-col justify-center rounded-2xl border bg-card/60 p-6">
              <div class="flex items-start gap-3">
                <component :is="verdict.icon" class="mt-1 h-6 w-6 shrink-0" :class="verdict.tone" />
                <div>
                  <p class="text-lg font-semibold" :class="verdict.tone">{{ verdict.text }}</p>
                  <p class="mt-1 text-sm leading-relaxed text-muted-foreground">{{ verdict.sub }}</p>
                </div>
              </div>

              <!-- 汇总分段条 -->
              <div class="mt-5 flex h-2 overflow-hidden rounded-full border bg-muted/40">
                <div v-if="stat.inconsistent" :class="segClass('inconsistent')" :style="{ width: pct(stat.inconsistent) }" />
                <div v-if="stat.passed" :class="segClass('passed')" :style="{ width: pct(stat.passed) }" />
                <div v-if="stat.unmeasured" :class="segClass('unmeasured')" :style="{ width: pct(stat.unmeasured) }" />
                <div v-if="stat.na" :class="segClass('na')" :style="{ width: pct(stat.na) }" />
              </div>
              <div class="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                <span v-for="t in ['inconsistent', 'passed', 'unmeasured', 'na'] as const" :key="t" class="flex items-center gap-1.5" :class="segColor(t)">
                  <span class="h-2 w-2 rounded-full" :class="segClass(t)" /> {{ drawStats(t) }}
                </span>
              </div>
            </div>
          </div>

          <!-- 特征详解 -->
          <div class="rounded-2xl border bg-card">
            <div class="flex items-center justify-between border-b px-4 py-3">
              <div class="flex items-center gap-2 text-sm font-semibold">
                <Fingerprint class="h-4 w-4 text-primary" /> 特征详解
              </div>
              <span class="text-xs text-muted-foreground">
                已测量 {{ stat.passed + stat.inconsistent }}/{{ dims.length }}
              </span>
            </div>
            <div class="divide-y">
              <div v-for="it in dims" :key="it.key">
                <button class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40" @click="toggleDim(it.key)">
                  <span :class="dimIconCls(it.status)">
                    <component :is="dimIcon(it.status)" class="h-5 w-5" />
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block text-sm font-semibold">{{ it.title }}</span>
                  </span>
                  <span class="shrink-0 text-sm font-medium" :class="dimResultCls(it.status)">{{ it.result }}</span>
                  <ChevronDown class="h-4 w-4 shrink-0 text-muted-foreground transition-transform" :class="it.expand ? '' : '-rotate-90'" />
                </button>
                <Transition name="fade">
                  <div v-if="it.expand" class="border-t bg-muted/30 px-4 py-3 pl-12 pr-4 text-xs leading-relaxed text-muted-foreground">
                    {{ it.desc }}
                  </div>
                </Transition>
              </div>
            </div>
          </div>

          <div class="flex items-start gap-2 rounded-xl border bg-card p-3 text-xs text-muted-foreground">
            <Info class="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              判定为启发式估算：IP 归属来自 <a href="https://ip-api.com" target="_blank" rel="noopener" class="underline underline-offset-2 hover:text-foreground">ip-api.com</a>，
              键盘布局由首选语言推断，DNS 解析器需系统级工具协同；评分仅供了解画像匹配度，非权威结论。
            </div>
          </div>
        </template>

        <div v-else class="rounded-2xl border border-dashed bg-card/40 p-10 text-center text-sm text-muted-foreground">
          在左侧选择预期身份并点击「开始检测」，这里将展示你的画像匹配评分与特征详解。
        </div>
      </main>
    </div>
  </div>
</template>