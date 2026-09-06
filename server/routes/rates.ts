import type { FastifyInstance } from 'fastify'
import { request } from 'undici'

interface RateResult {
  base: string
  date: string
  rates: Record<string, number>
}

const cache = new Map<string, { data: RateResult; at: number }>()
const TTL = 60 * 60 * 1000

async function fetchRates(base: string): Promise<RateResult> {
  const hit = cache.get(base)
  if (hit && Date.now() - hit.at < TTL) return hit.data

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
    throw new Error(data['error-type'] ?? '获取汇率失败')
  }
  const result: RateResult = {
    base: data.base_code ?? base,
    date: data.time_last_update_utc ?? '',
    rates: data.rates,
  }
  cache.set(base, { data: result, at: Date.now() })
  return result
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
