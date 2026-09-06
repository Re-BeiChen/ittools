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

async function lookup(ip: string): Promise<IpInfo> {
  const hit = cache.get(ip)
  if (hit && Date.now() - hit.at < TTL) return hit.data

  // ip-api.com 免费接口（无需 key），中文返回
  const res = await request(`http://ip-api.com/json/${encodeURIComponent(ip)}?lang=zh-CN&fields=status,message,country,countryCode,region,city,isp,org,as,lat,lon,timezone,query`, {
    headersTimeout: 8000,
    bodyTimeout: 8000,
  })
  const data = await res.body.json() as Record<string, unknown>
  if (data.status !== 'success') {
    throw new Error(typeof data.message === 'string' ? data.message : '查询失败')
  }
  const info: IpInfo = {
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
  }
  cache.set(ip, { data: info, at: Date.now() })
  return info
}

export async function ipRoutes(app: FastifyInstance) {
  // 查询任意 IP
  app.get<{ Params: { ip: string } }>('/api/ip/:ip', { preHandler: [requireAuth] }, async (req, reply) => {
    const ip = req.params.ip.trim()
    if (!IP_RE.test(ip)) {
      return reply.code(400).send({ error: 'IP 格式不合法' })
    }
    try {
      return await lookup(ip)
    } catch (e) {
      return reply.code(502).send({ error: `查询失败：${(e as Error).message}` })
    }
  })

  // 查询自己的 IP
  app.get('/api/ip', { preHandler: [requireAuth] }, async (req, reply) => {
    const ip = req.ip
    if (!IP_RE.test(ip)) {
      // 本地/代理场景可能拿不到公网 IP，直接返回纯 IP 信息
      return { ip, note: '未能识别为公网 IP' }
    }
    try {
      return await lookup(ip)
    } catch (e) {
      return reply.code(502).send({ error: `查询失败：${(e as Error).message}` })
    }
  })
}
