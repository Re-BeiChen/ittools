import { Resolver } from 'node:dns/promises'
import type { FastifyInstance } from 'fastify'
import { requireAuth } from './auth'

/** 多通道公共 DNS 服务器（数据来源为各公共 DNS 服务商） */
const CHANNELS = [
  { name: 'Cloudflare (1.1.1.1)', server: '1.1.1.1' },
  { name: 'Google (8.8.8.8)', server: '8.8.8.8' },
  { name: '阿里云 (223.5.5.5)', server: '223.5.5.5' },
]

const RECORD_TYPES = ['A', 'AAAA', 'CNAME', 'MX', 'NS', 'TXT', 'SOA'] as const
type RecordType = (typeof RECORD_TYPES)[number]

const NAME_RE = /^[a-z0-9\u4e00-\u9fa5](?:[a-z0-9\u4e00-\u9fa5-]*[a-z0-9\u4e00-\u9fa5])?(\.[a-z0-9\u4e00-\u9fa5](?:[a-z0-9\u4e00-\u9fa5-]*[a-z0-9\u4e00-\u9fa5])?)+$/i

interface ChannelResult {
  channel: string
  server: string
  ok: boolean
  timeMs: number
  answers: string[]
  error?: string
}

async function resolveChannel(
  channel: (typeof CHANNELS)[number],
  name: string,
  type: RecordType,
): Promise<ChannelResult> {
  const resolver = new Resolver()
  resolver.setServers([channel.server])
  const start = Date.now()
  try {
    const answers = (await Promise.race([
      resolver.resolve(name, type) as Promise<unknown>,
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          resolver.cancel()
          reject(new Error('查询超时'))
        }, 8000)
      }),
    ])) as unknown[]
    const timeMs = Date.now() - start
    const formatted = answers.map((a: unknown) => {
      if (typeof a === 'string') return a
      const o = a as Record<string, unknown>
      if (type === 'MX' && o.exchange) return `${o.priority} ${o.exchange}`
      if (type === 'SOA' && o.nsname) {
        return `ns=${o.nsname} mbox=${o.hostmaster} serial=${o.serial} refresh=${o.refresh}`
      }
      return Object.values(o).join(' ')
    })
    return { channel: channel.name, server: channel.server, ok: true, timeMs, answers: formatted }
  } catch (e) {
    const err = e as Error & { code?: string }
    return {
      channel: channel.name,
      server: channel.server,
      ok: false,
      timeMs: Date.now() - start,
      answers: [],
      error: err.code === 'ENOTFOUND' ? '无此记录' : err.message,
    }
  }
}

export async function dnsRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { name?: string; type?: string } }>(
    '/api/dns',
    { preHandler: [requireAuth] },
    async (req, reply) => {
      const name = (req.query.name ?? '').trim().toLowerCase()
      const type = (req.query.type ?? 'A').toUpperCase() as RecordType
      if (!name) return reply.code(400).send({ error: '请提供 name 参数' })
      if (!NAME_RE.test(name)) return reply.code(400).send({ error: '域名格式不合法' })
      if (!RECORD_TYPES.includes(type)) {
        return reply.code(400).send({ error: `仅支持记录类型：${RECORD_TYPES.join(' / ')}` })
      }

      const results = await Promise.all(
        CHANNELS.map(ch => resolveChannel(ch, name, type)),
      )
      return { name, type, channels: results }
    },
  )
}
