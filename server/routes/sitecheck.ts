import tls from 'node:tls'
import type { FastifyInstance } from 'fastify'
import { request } from 'undici'
import { requireAuth } from './auth'

interface SiteCheckResult {
  url: string
  finalUrl: string
  statusCode: number
  responseTimeMs: number
  tls: null | {
    subject: string
    issuer: string
    validFrom: string
    validTo: string
    daysRemaining: number
    protocol: string
    san: string[]
  }
}

const HOST_RE = /^[a-zA-Z0-9.-]+(:\d{1,5})?$/

function checkCert(host: string, port: number): Promise<SiteCheckResult['tls']> {
  return new Promise((resolve) => {
    const socket = tls.connect(
      { host, port, servername: host, timeout: 8000, rejectUnauthorized: false },
      () => {
        const cert = socket.getPeerCertificate()
        let tlsInfo: SiteCheckResult['tls'] = null
        if (cert && cert.raw) {
          const validTo = new Date(cert.valid_to)
          tlsInfo = {
            subject: cert.subject?.CN ?? '',
            issuer: cert.issuer?.O ?? cert.issuer?.CN ?? '',
            validFrom: cert.valid_from,
            validTo: cert.valid_to,
            daysRemaining: Math.ceil((validTo.getTime() - Date.now()) / 86400000),
            protocol: socket.getProtocol() ?? '',
            san: (cert.subjectaltname ?? '').split(', ').map(s => s.replace(/^DNS:/, '')),
          }
        }
        socket.destroy()
        resolve(tlsInfo)
      },
    )
    socket.on('error', () => resolve(null))
    socket.on('timeout', () => {
      socket.destroy()
      resolve(null)
    })
  })
}

export async function siteCheckRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { url?: string } }>('/api/site-check', { preHandler: [requireAuth] }, async (req, reply) => {
    const raw = (req.query.url ?? '').trim()
    if (!raw) {
      return reply.code(400).send({ error: '请提供 url 参数' })
    }

    let url: URL
    try {
      url = new URL(raw.includes('://') ? raw : `https://${raw}`)
    } catch {
      return reply.code(400).send({ error: 'URL 不合法' })
    }
    if (!/^https?:$/.test(url.protocol)) {
      return reply.code(400).send({ error: '仅支持 http/https' })
    }

    const result: SiteCheckResult = {
      url: url.toString(),
      finalUrl: url.toString(),
      statusCode: 0,
      responseTimeMs: 0,
      tls: null,
    }

    // HTTP 请求（手动跟随重定向，最多 3 层）
    try {
      const start = Date.now()
      let current = url.toString()
      let statusCode = 0
      let finalUrl = current
      for (let i = 0; i < 4; i++) {
        const res = await request(current, {
          method: 'GET',
          headersTimeout: 10000,
          bodyTimeout: 10000,
          headers: { 'user-agent': 'Mozilla/5.0 (compatible; ITTools-SiteCheck/1.0)' },
        })
        await res.body.dump()
        statusCode = res.statusCode
        finalUrl = current
        const loc = res.headers['location']
        const location = Array.isArray(loc) ? loc[0] : loc
        if (res.statusCode >= 300 && res.statusCode < 400 && location) {
          current = new URL(location, current).toString()
          continue
        }
        break
      }
      result.responseTimeMs = Date.now() - start
      result.statusCode = statusCode
      result.finalUrl = finalUrl
    } catch (e) {
      return reply.code(502).send({
        error: `请求失败：${(e as Error).message}`,
        url: url.toString(),
      })
    }

    // HTTPS 附加证书检测
    if (url.protocol === 'https:' && HOST_RE.test(url.hostname)) {
      result.tls = await checkCert(url.hostname, Number(url.port) || 443)
    }

    return result
  })
}
