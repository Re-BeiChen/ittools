import type { FastifyInstance } from 'fastify'
import { request } from 'undici'

interface RateResult {
  base: string
  date: string
  rates: Record<string, number>
}

const cache = new Map<string, { data: RateResult; at: number }>()
const TTL = 60 * 60 * 1000

/** 数据源健康状态：连续失败会被临时摘除 */
const sources = [
  { name: 'er-api', failures: 0, cooldownUntil: 0 },
  { name: 'frankfurter', failures: 0, cooldownUntil: 0 },
  { name: 'jsdelivr', failures: 0, cooldownUntil: 0 },
  { name: 'pages', failures: 0, cooldownUntil: 0 },
] as const
type SourceName = typeof sources[number]['name']

const FAILURE_LIMIT = 3
const COOLDOWN_MS = 10 * 60 * 1000

function source(name: SourceName) {
  return sources.find(s => s.name === name)!
}

async function fetchErApi(base: string): Promise<RateResult> {
  const res = await request(`https://open.er-api.com/v6/latest/${encodeURIComponent(base)}`, {
    headersTimeout: 10000,
    bodyTimeout: 10000,
  })
  const data = await res.body.json() as {
    result: string
    base_code?: string
    time_last_update_utc?: string
    rates?: Record<string, number>
    'error-type'?: string
  }
  if (data.result !== 'success' || !data.rates) {
    throw new Error(data['error-type'] ?? 'er-api 返回异常')
  }
  return { base: data.base_code ?? base, date: data.time_last_update_utc ?? '', rates: data.rates }
}

async function fetchFrankfurter(base: string): Promise<RateResult> {
  const res = await request(
    `https://api.frankfurter.dev/v1/latest?base=${encodeURIComponent(base)}`,
    { headersTimeout: 10000, bodyTimeout: 10000 },
  )
  if (res.statusCode !== 200) throw new Error(`frankfurter HTTP ${res.statusCode}`)
  const data = await res.body.json() as {
    base: string
    date: string
    rates: Record<string, number>
  }
  if (!data.rates || !Object.keys(data.rates).length) throw new Error('frankfurter 返回异常')
  return { base: data.base, date: data.date, rates: data.rates }
}

/** currency-api（含加密货币），usd.json 形式，需换算成任意 base */
async function fetchCurrencyApi(base: string, host: 'jsdelivr' | 'pages'): Promise<RateResult> {
  const url = host === 'jsdelivr'
    ? 'https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/usd.json'
    : 'https://latest.currency-api.pages.dev/v1/currencies/usd.json'
  const res = await request(url, { headersTimeout: 10000, bodyTimeout: 10000 })
  if (res.statusCode !== 200) throw new Error(`currency-api(${host}) HTTP ${res.statusCode}`)
  const data = await res.body.json() as { date: string; usd: Record<string, number> }
  const usd = data.usd
  if (!usd) throw new Error('currency-api 返回异常')
  const lower = base.toLowerCase()
  if (base === 'USD') {
    return { base, date: data.date, rates: usd }
  }
  const baseRate = usd[lower]
  if (!baseRate) throw new Error(`currency-api 不支持 ${base}`)
  // 以 USD 为锚点换算：1 unit(base) = x unit(other)
  const rates: Record<string, number> = {}
  for (const [code, v] of Object.entries(usd)) {
    rates[code.toUpperCase()] = v / baseRate
  }
  return { base, date: data.date, rates }
}

const FETCHERS: Record<SourceName, (base: string) => Promise<RateResult>> = {
  'er-api': fetchErApi,
  'frankfurter': fetchFrankfurter,
  'jsdelivr': b => fetchCurrencyApi(b, 'jsdelivr'),
  'pages': b => fetchCurrencyApi(b, 'pages'),
}

/** 轮询起点，实现多源轮转负载均衡 */
let cursor = 0

async function fetchRates(base: string): Promise<RateResult> {
  const hit = cache.get(base)
  if (hit && Date.now() - hit.at < TTL) return hit.data

  // 可用源 = 不在冷却期的源；按轮询起点依次尝试
  const order = sources.map((_, i) => sources[(cursor + i) % sources.length])
  cursor = (cursor + 1) % sources.length

  const now = Date.now()
  const errors: string[] = []
  for (const s of order) {
    if (s.cooldownUntil > now) continue
    try {
      const data = await FETCHERS[s.name](base)
      s.failures = 0
      cache.set(base, { data, at: Date.now() })
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

export async function ratesRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { base?: string; from?: string; to?: string; amount?: string } }>('/api/rates', async (req, reply) => {
    const from = (req.query.from ?? req.query.base ?? 'USD').toUpperCase()
    const to = req.query.to?.toUpperCase()
    const amount = Number(req.query.amount ?? '1')

    try {
      const data = await fetchRates(from)
      if (!to) {
        return data
      }
      const rate = data.rates[to]
      if (rate === undefined) {
        return reply.code(400).send({ error: `不支持的货币：${to}` })
      }
      return {
        from,
        to,
        rate,
        amount: Number.isFinite(amount) ? amount : 1,
        converted: rate * (Number.isFinite(amount) ? amount : 1),
        date: data.date,
      }
    } catch (e) {
      return reply.code(502).send({ error: `获取失败：${(e as Error).message}` })
    }
  })
}
