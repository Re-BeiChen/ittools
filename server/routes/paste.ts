import type { FastifyInstance } from 'fastify'
import { requireAuth } from './auth'
import { db, genCode } from '../db'

const MAX_CONTENT = 512 * 1024 // 512KB

export async function pasteRoutes(app: FastifyInstance) {
  // 创建 paste（需登录）
  app.post('/api/paste', {
    preHandler: [requireAuth],
    schema: {
      body: {
        type: 'object',
        required: ['content'],
        properties: {
          content: { type: 'string' },
          // 过期秒数；0 = 永久
          expiresIn: { type: 'integer' },
          burn: { type: 'boolean' },
        },
      },
    },
  }, async (req, reply) => {
    const { content, expiresIn = 0, burn = false } = req.body as {
      content: string
      expiresIn?: number
      burn?: boolean
    }
    if (!content.trim()) {
      return reply.code(400).send({ error: '内容不能为空' })
    }
    if (content.length > MAX_CONTENT) {
      return reply.code(400).send({ error: '内容超过 512KB 限制' })
    }
    const code = genCode(6)
    const now = Date.now()
    const expiresAt = expiresIn > 0 ? now + expiresIn * 1000 : null
    db.prepare('INSERT INTO pastes (code, content, burn, created_at, expires_at) VALUES (?, ?, ?, ?, ?)')
      .run(code, content, burn ? 1 : 0, now, expiresAt)
    return { code, url: `/p/${code}`, expiresAt }
  })

  // 读取 paste
  app.get('/api/paste/:code', async (req, reply) => {
    const { code } = req.params as { code: string }
    const row = db.prepare('SELECT * FROM pastes WHERE code = ?').get(code) as {
      content: string
      burn: number
      created_at: number
      expires_at: number | null
    } | undefined

    if (!row) {
      return reply.code(404).send({ error: '不存在或已过期' })
    }
    if (row.expires_at !== null && row.expires_at < Date.now()) {
      db.prepare('DELETE FROM pastes WHERE code = ?').run(code)
      return reply.code(404).send({ error: '不存在或已过期' })
    }
    // 阅后即焚：读取后立即删除
    if (row.burn) {
      db.prepare('DELETE FROM pastes WHERE code = ?').run(code)
    }
    return {
      code,
      content: row.content,
      burn: !!row.burn,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    }
  })
}
