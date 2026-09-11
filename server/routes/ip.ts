import type { FastifyInstance } from 'fastify'
import { request } from 'undici'
import { requireAuth } from './auth'

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

const cache = new Map<string, { data: IpInfo; at: number }>()
const TTL = 10 * 60 * 1000

const IP_RE = /^(\d{1,3}\.){3}\d{1,3}$|^[0-9a-fA-F:]+$/

const PRIVATE_RE =
  /^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.)|^::1$|^fe[89abcdef][0-9a-f]*:/i

// 常用国家/地区中文名（按 countryCode 统一映射，保证不同数据源输出一致）
const COUNTRY_ZH: Record<string, string> = {
  CN: '中国', HK: '中国香港', TW: '中国台湾', MO: '中国澳门',
  US: '美国', JP: '日本', KR: '韩国', SG: '新加坡', GB: '英国',
  DE: '德国', FR: '法国', RU: '俄罗斯', CA: '加拿大', AU: '澳大利亚',
  IN: '印度', BR: '巴西', IT: '意大利', NL: '荷兰', ES: '西班牙',
  SE: '瑞典', CH: '瑞士', NO: '挪威', FI: '芬兰', DK: '丹麦',
  PL: '波兰', CZ: '捷克', UA: '乌克兰', TR: '土耳其', TH: '泰国',
  VN: '越南', MY: '马来西亚', ID: '印度尼西亚', PH: '菲律宾', NZ: '新西兰',
  AE: '阿联酋', SA: '沙特阿拉伯', IL: '以色列', EG: '埃及', ZA: '南非',
  MX: '墨西哥', AR: '阿根廷', CL: '智利', PT: '葡萄牙', IE: '爱尔兰',
  AT: '奥地利', BE: '比利时', GR: '希腊', HU: '匈牙利', RO: '罗马尼亚',
  BG: '保加利亚', KW: '科威特', QA: '卡塔尔', PK: '巴基斯坦',
  BD: '孟加拉国', LK: '斯里兰卡', NP: '尼泊尔', MM: '缅甸', KH: '柬埔寨',
  LA: '老挝', MN: '蒙古', KZ: '哈萨克斯坦', UZ: '乌兹别克斯坦',
}

/** 数据源健康状态：连续失败会被临时摘除 */
const sources = [
  { name: 'ip-api', failures: 0, cooldownUntil: 0 },
  { name: 'ipwho', failures: 0, cooldownUntil: 0 },
  { name: 'ipinfo', failures: 0, cooldownUntil: 0 },
  { name: 'geojs', failures: 0, cooldownUntil: 0 },
  { name: 'ipguide', failures: 0, cooldownUntil: 0 },
  { name: 'freeipapi', failures: 0, cooldownUntil: 0 },
  { name: 'ipbase', failures: 0, cooldownUntil: 0 },
] as const
type SourceName = typeof sources[number]['name']

const FAILURE_LIMIT = 3
const COOLDOWN_MS = 10 * 60 * 1000

function normalize(info: IpInfo): IpInfo {
  const zh = COUNTRY_ZH[info.countryCode]
  if (zh) info.country = zh
  return info
}

// ip-api.com：免费 45 次/分钟，原生支持中文，无需 key
async function fetchIpApi(ip: string): Promise<IpInfo> {
  const path = ip ? `/json/${encodeURIComponent(ip)}` : '/json'
  const res = await request(`http://ip-api.com${path}?lang=zh-CN&fields=status,message,country,countryCode,region,city,isp,org,as,lat,lon,timezone,query`, {
    headersTimeout: 8000,
    bodyTimeout: 8000,
  })
  const data = await res.body.json() as Record<string, unknown>
  if (data.status !== 'success') {
    throw new Error(typeof data.message === 'string' ? data.message : 'ip-api 查询失败')
  }
  return normalize({
    ip: String(data.query ?? ip),
    country: String(data.country ?? ''),
    countryCode: String(data.countryCode ?? ''),
    region: String(data.region ?? ''),
    city: String(data.city ?? ''),
    isp: String(data.isp ?? ''),
    org: String(data.org ?? ''),
    as: String(data.as ?? ''),
    lat: Number(data.lat ?? 0),
    lon: Number(data.lon ?? 0),
    timezone: String(data.timezone ?? ''),
  })
}

// ipwho.is：免费无 key（约 1 万次/月），字段齐全
async function fetchIpwho(ip: string): Promise<IpInfo> {
  const url = ip ? `https://ipwho.is/${encodeURIComponent(ip)}` : 'https://ipwho.is/'
  const res = await request(url, { headersTimeout: 8000, bodyTimeout: 8000 })
  const data = await res.body.json() as {
    ip: string
    success: boolean
    message?: string
    country: string
    country_code: string
    region: string
    city: string
    latitude: number
    longitude: number
    connection?: { asn?: number; org?: string; isp?: string }
    timezone?: { id?: string }
  }
  if (!data.success) {
    throw new Error(data.message ?? 'ipwho.is 查询失败')
  }
  return normalize({
    ip: data.ip,
    country: data.country,
    countryCode: data.country_code,
    region: data.region,
    city: data.city,
    isp: data.connection?.isp ?? '',
    org: data.connection?.org ?? '',
    as: data.connection?.asn ? `AS${data.connection.asn} ${data.connection.org ?? ''}`.trim() : '',
    lat: data.latitude ?? 0,
    lon: data.longitude ?? 0,
    timezone: data.timezone?.id ?? '',
  })
}

// ipinfo.io：免费无 key（约 1000 次/天）
async function fetchIpinfo(ip: string): Promise<IpInfo> {
  const url = ip ? `https://ipinfo.io/${encodeURIComponent(ip)}/json` : 'https://ipinfo.io/json'
  const res = await request(url, { headersTimeout: 8000, bodyTimeout: 8000 })
  if (res.statusCode !== 200) throw new Error(`ipinfo HTTP ${res.statusCode}`)
  const data = await res.body.json() as {
    ip: string
    city?: string
    region?: string
    country?: string
    loc?: string
    org?: string
    timezone?: string
  }
  const [lat, lon] = (data.loc ?? '0,0').split(',')
  return normalize({
    ip: data.ip,
    country: data.country ?? '',
    countryCode: data.country ?? '',
    region: data.region ?? '',
    city: data.city ?? '',
    isp: data.org ?? '',
    org: data.org ?? '',
    as: data.org ?? '',
    lat: Number(lat) || 0,
    lon: Number(lon) || 0,
    timezone: data.timezone ?? '',
  })
}

// get.geojs.io：免费无限（合理使用）
async function fetchGeojs(ip: string): Promise<IpInfo> {
  const url = ip ? `https://get.geojs.io/v1/ip/geo/${encodeURIComponent(ip)}.json` : 'https://get.geojs.io/v1/ip/geo.json'
  const res = await request(url, { headersTimeout: 8000, bodyTimeout: 8000 })
  if (res.statusCode !== 200) throw new Error(`geojs HTTP ${res.statusCode}`)
  const data = await res.body.json() as {
    ip: string
    country: string
    country_code: string
    region: string
    city: string
    latitude: string
    longitude: string
    timezone: string
    organization: string
    asn: string
  }
  return normalize({
    ip: data.ip,
    country: data.country,
    countryCode: data.country_code,
    region: data.region,
    city: data.city,
    isp: data.organization ?? '',
    org: data.organization ?? '',
    as: data.asn ? `AS${data.asn} ${data.organization ?? ''}`.trim() : '',
    lat: Number(data.latitude) || 0,
    lon: Number(data.longitude) || 0,
    timezone: data.timezone ?? '',
  })
}

// ip.guide：免费无限，返回网段 CIDR + ASN + 组织
async function fetchIpguide(ip: string): Promise<IpInfo> {
  const url = ip ? `https://ip.guide/${encodeURIComponent(ip)}` : 'https://ip.guide/'
  const res = await request(url, { headersTimeout: 8000, bodyTimeout: 8000 })
  if (res.statusCode !== 200) throw new Error(`ip.guide HTTP ${res.statusCode}`)
  const data = await res.body.json() as {
    ip: string
    network?: {
      cidr?: string
      autonomous_system?: { asn?: number; name?: string; organization?: string; country?: string }
    }
    location?: { country?: string; city?: string; region?: string; latitude?: number; longitude?: number; timezone?: string }
  }
  const loc = data.location ?? {}
  const as = data.network?.autonomous_system
  return normalize({
    ip: data.ip,
    country: as?.country ?? loc.country ?? '',
    countryCode: as?.country ?? loc.country ?? '',
    region: loc.region ?? '',
    city: loc.city ?? '',
    isp: as?.organization ?? '',
    org: as?.organization ?? '',
    as: as?.asn ? `AS${as.asn} ${as.name ?? ''}`.trim() : '',
    lat: loc.latitude ?? 0,
    lon: loc.longitude ?? 0,
    timezone: loc.timezone ?? '',
  })
}

// freeipapi.com：免费无限（60 次/分钟）
async function fetchFreeipapi(ip: string): Promise<IpInfo> {
  const url = ip ? `https://freeipapi.com/api/json/${encodeURIComponent(ip)}` : 'https://freeipapi.com/api/json'
  const res = await request(url, { headersTimeout: 8000, bodyTimeout: 8000 })
  if (res.statusCode !== 200) throw new Error(`freeipapi HTTP ${res.statusCode}`)
  const data = await res.body.json() as {
    ipAddress: string
    countryName?: string
    countryCode?: string
    regionName?: string
    cityName?: string
    latitude?: number
    longitude?: number
    timeZones?: string[]
  }
  return normalize({
    ip: data.ipAddress,
    country: data.countryName ?? '',
    countryCode: data.countryCode ?? '',
    region: data.regionName ?? '',
    city: data.cityName ?? '',
    isp: '',
    org: '',
    as: '',
    lat: data.latitude ?? 0,
    lon: data.longitude ?? 0,
    timezone: data.timeZones?.[0] ?? '',
  })
}

const IPBASE_KEY = process.env.IPBASE_API_KEY ?? ''

// api.ipbase.com：带密钥（IPBASE_API_KEY 环境变量），字段全（ASN/ISP/网段）
async function fetchIpbase(ip: string): Promise<IpInfo> {
  if (!IPBASE_KEY) throw new Error('ipbase 未配置 IPBASE_API_KEY')
  const url = ip
    ? `https://api.ipbase.com/v2/info?ip=${encodeURIComponent(ip)}&apikey=${IPBASE_KEY}`
    : `https://api.ipbase.com/v2/info?apikey=${IPBASE_KEY}`
  const res = await request(url, { headersTimeout: 8000, bodyTimeout: 8000 })
  if (res.statusCode !== 200) throw new Error(`ipbase HTTP ${res.statusCode}`)
  const body = await res.body.json() as {
    data?: {
      ip: string
      connection?: { asn?: number; organization?: string; isp?: string }
      location?: {
        latitude?: number
        longitude?: number
        country?: { code?: string; name?: string }
        region?: { name?: string }
        city?: { name?: string }
        timezone?: { id?: string }
      }
    }
  }
  const d = body.data
  if (!d) throw new Error('ipbase 返回异常')
  const loc = d.location ?? {}
  return normalize({
    ip: d.ip,
    country: loc.country?.name ?? '',
    countryCode: loc.country?.code ?? '',
    region: loc.region?.name ?? '',
    city: loc.city?.name ?? '',
    isp: d.connection?.isp ?? '',
    org: d.connection?.organization ?? '',
    as: d.connection?.asn ? `AS${d.connection.asn} ${d.connection.isp ?? d.connection.organization ?? ''}`.trim() : '',
    lat: loc.latitude ?? 0,
    lon: loc.longitude ?? 0,
    timezone: loc.timezone?.id ?? '',
  })
}

const FETCHERS: Record<SourceName, (ip: string) => Promise<IpInfo>> = {
  'ip-api': fetchIpApi,
  'ipwho': fetchIpwho,
  'ipinfo': fetchIpinfo,
  'geojs': fetchGeojs,
  'ipguide': fetchIpguide,
  'freeipapi': fetchFreeipapi,
  'ipbase': fetchIpbase,
}

/** 轮询起点，实现多源轮转负载均衡 */
let cursor = 0

async function lookup(ip: string, fresh = false): Promise<IpInfo> {
  if (!fresh) {
    const hit = cache.get(ip)
    if (hit && Date.now() - hit.at < TTL) return hit.data
  }

  const order = sources.map((_, i) => sources[(cursor + i) % sources.length])
  cursor = (cursor + 1) % sources.length

  const now = Date.now()
  const errors: string[] = []
  for (const s of order) {
    if (s.cooldownUntil > now) continue
    try {
      const data = await FETCHERS[s.name](ip)
      s.failures = 0
      cache.set(ip, { data, at: Date.now() })
      return data
    } catch (e) {
      s.failures++
      if (s.failures >= FAILURE_LIMIT) {
        s.cooldownUntil = Date.now() + COOLDOWN_MS
        s.failures = 0
      }
      errors.push(`${s.name}: ${(e as Error).message}`)
    }
  }
  throw new Error(`所有数据源均失败（${errors.join('；')}）`)
}

export async function ipRoutes(app: FastifyInstance) {
  // 查询任意 IP
  app.get<{ Querystring: { fresh?: string }; Params: { ip: string } }>('/api/ip/:ip', { preHandler: [requireAuth] }, async (req, reply) => {
    const ip = req.params.ip.trim()
    if (!IP_RE.test(ip)) {
      return reply.code(400).send({ error: 'IP 格式不合法' })
    }
    try {
      return await lookup(ip, req.query.fresh === '1')
    } catch (e) {
      return reply.code(502).send({ error: `查询失败：${(e as Error).message}` })
    }
  })

  // 查询自己的 IP
  app.get<{ Querystring: { fresh?: string } }>('/api/ip', { preHandler: [requireAuth] }, async (req, reply) => {
    const ip = req.ip
    // 私网/回环 IP 交给数据源反查出口公网 IP
    const target = !IP_RE.test(ip) || PRIVATE_RE.test(ip) ? '' : ip
    try {
      return await lookup(target, req.query.fresh === '1')
    } catch (e) {
      return reply.code(502).send({ error: `查询失败：${(e as Error).message}` })
    }
  })
}
