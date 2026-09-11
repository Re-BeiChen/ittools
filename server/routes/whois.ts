import net from 'node:net'
import type { FastifyInstance } from 'fastify'
import { requireAuth } from './auth'

const IANA_SERVER = 'whois.iana.org'
const MAX_RAW = 40_000

/** 通过 TCP 43 端口查询 whois 服务器，返回原始文本 */
function query(server: string, q: string, timeoutMs = 10_000): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection(43, server)
    let data = ''
    let done = false
    const timer = setTimeout(() => {
      if (!done) {
        done = true
        socket.destroy()
        reject(new Error(`连接 ${server} 超时`))
      }
    }, timeoutMs)

    socket.setEncoding('utf8')
    socket.on('connect', () => socket.write(`${q}\r\n`))
    socket.on('data', chunk => {
      data += chunk
      if (data.length > MAX_RAW * 2 && !done) {
        // 数据已足够大，提前断开
        done = true
        socket.destroy()
        resolve(data)
      }
    })
    socket.on('end', () => {
      if (!done) {
        done = true
        clearTimeout(timer)
        resolve(data)
      }
    })
    socket.on('error', err => {
      if (!done) {
        done = true
        clearTimeout(timer)
        reject(err)
      }
    })
  })
}

/** 从 IANA 响应中解析实际 whois 服务器地址（refer: / whois: 行） */
function extractReferral(raw: string): string | null {
  const lines = raw.split(/\r?\n/)
  for (const line of lines) {
    const m = line.match(/^\s*(?:refer|whois)\s*:\s*([^\s]+)/i)
    if (m && m[1]) return m[1]
  }
  return null
}

const INTERESTING = /registrar|creation|expiry|expiration|updated|name server|nameserver|status|registrant|organization|org-|domain|referral|dnssec/i

/** 提取 whois 文本中的关键字段（保留首次出现；Name Server 等多值字段合并保留） */
function parseFields(raw: string): Record<string, string> {
  const out: Record<string, string> = {}
  const multi = new Set(['name server'])
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z][\w .\-/]*?)\s*:\s*(.*)$/)
    if (!m) continue
    const key = m[1].trim().replace(/\s+/g, ' ')
    const val = m[2].trim()
    if (!val || val.startsWith('%') || val.startsWith('#')) continue
    if (!INTERESTING.test(key)) continue
    if (out[key] === undefined) {
      out[key] = val
    } else if (multi.has(key.toLowerCase())) {
      out[key] += '\n' + val
    }
  }
  return out
}

const DOMAIN_RE = /^[a-z0-9\u4e00-\u9fa5](?:[a-z0-9\u4e00-\u9fa5-]*[a-z0-9\u4e00-\u9fa5])?(\.[a-z0-9\u4e00-\u9fa5](?:[a-z0-9\u4e00-\u9fa5-]*[a-z0-9\u4e00-\u9fa5])?)+$/i

export async function whoisRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { domain?: string } }>(
    '/api/whois',
    { preHandler: [requireAuth] },
    async (req, reply) => {
      const domain = (req.query.domain ?? '').trim().toLowerCase()
      if (!domain) return reply.code(400).send({ error: '请提供 domain 参数' })
      if (!DOMAIN_RE.test(domain)) {
        return reply.code(400).send({ error: '域名格式不合法' })
      }

      try {
        // 1. 用 TLD 查询 IANA，定位该后缀的注册局 whois 服务器
        const tld = domain.slice(domain.lastIndexOf('.') + 1)
        const ianaRaw = await query(IANA_SERVER, tld)
        const referral = extractReferral(ianaRaw)
        if (!referral) {
          return reply.code(502).send({ error: `无法从 IANA 获取 .${tld} 的注册局信息` })
        }

        // 2. 连接注册局 whois 服务器查询完整域名信息
        let raw = ''
        try {
          raw = await query(referral, domain)
        } catch {
          raw = `[查询 ${referral} 失败，回退到 IANA 结果]\n\n${ianaRaw}`
        }
        if (raw.length > MAX_RAW) raw = raw.slice(0, MAX_RAW) + '\n... (截断)'

        return {
          domain,
          server: referral,
          fields: parseFields(raw),
          raw,
        }
      } catch (e) {
        return reply.code(502).send({ error: `Whois 查询失败：${(e as Error).message}` })
      }
    },
  )
}
