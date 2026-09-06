import type { FastifyInstance } from 'fastify'
import { requireAuth } from './auth'
import { db, genCode } from '../db'

const URL_RE = /^https?:\/\/.+/i

export async function shortenRoutes(app: FastifyInstance) {
  // 创建短链（需登录）
  app.post('/api/shorten', {
    preHandler: [requireAuth],
    schema: {
      body: {
        type: 'object',
        required: ['url'],
        properties: {
          url: { type: 'string' },
        },
      },
    },
  }, async (req, reply) => {
    const { url } = req.body as { url: string }
    if (!URL_RE.test(url) || url.length > 2048) {
      return reply.code(400).send({ error: 'URL 不合法（需 http(s):// 开头）' })
    }
    // 相同 URL 直接复用已有短码
    const existing = db.prepare('SELECT code FROM links WHERE url = ? ORDER BY created_at DESC LIMIT 1')
      .get(url) as { code: string } | undefined
    const code = existing?.code ?? genCode(6)
    if (!existing) {
      db.prepare('INSERT INTO links (code, url, clicks, created_at) VALUES (?, ?, 0, ?)')
        .run(code, url, Date.now())
    }
    return { code, url: `/s/${code}`, target: url }
  })

  // 短链跳转
  app.get('/s/:code', async (req, reply) => {
    const { code } = req.params as { code: string }
    const row = db.prepare('SELECT url FROM links WHERE code = ?').get(code) as { url: string } | undefined
    if (!row) {
      return reply.code(404).send({ error: '短链不存在' })
    }
    db.prepare('UPDATE links SET clicks = clicks + 1 WHERE code = ?').run(code)
    return reply.redirect(row.url, 302)
  })

  // 短链统计
  app.get('/api/stats/:code', async (req, reply) => {
    const { code } = req.params as { code: string }
    const row = db.prepare('SELECT code, url, clicks, created_at FROM links WHERE code = ?').get(code) as {
      code: string
      url: string
      clicks: number
      created_at: number
    } | undefined
    if (!row) {
      return reply.code(404).send({ error: '短链不存在' })
    }
    return row
  })
}
