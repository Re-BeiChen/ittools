import crypto from 'node:crypto'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { db, hashPassword, verifyPassword } from '../db'

const COOKIE = 'ittools_session'
const DAY = 24 * 3600 * 1000
const REMEMBER_TTL = 30 * DAY
const DEFAULT_TTL = 7 * DAY

// ---------- Cookie 解析 ----------

function getCookie(req: FastifyRequest, name: string): string | undefined {
  const header = req.headers.cookie
  if (!header) return
  for (const part of header.split(';')) {
    const idx = part.indexOf('=')
    if (idx === -1) continue
    if (part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim())
    }
  }
  return undefined
}

function setSessionCookie(reply: FastifyReply, token: string, ttlMs: number) {
  reply.header('set-cookie',
    `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(ttlMs / 1000)}`)
}

function clearSessionCookie(reply: FastifyReply) {
  reply.header('set-cookie', `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
}

// ---------- User-Agent 解析为可读设备名 ----------

function parseDevice(ua: string | undefined): string {
  if (!ua) return '未知设备'
  const os = /Windows/.test(ua) ? 'Windows'
    : /Mac OS X/.test(ua) ? 'macOS'
    : /Android/.test(ua) ? 'Android'
    : /iPhone|iPad/.test(ua) ? 'iOS'
    : /Linux/.test(ua) ? 'Linux'
    : '未知系统'
  const browser = /Edg\//.test(ua) ? 'Edge'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Safari\//.test(ua) && !/Chrome/.test(ua) ? 'Safari'
    : /curl/i.test(ua) ? 'curl'
    : '浏览器'
  return `${browser} · ${os}`
}

// ---------- 会话 ----------

function sha256(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex')
}

export interface AuthContext {
  user: { id: number; username: string; role: string }
  session: { id: number; expiresAt: number }
}

/** 从 Cookie 解析当前会话（过期自动清除；last_used_at 节流 60s 更新一次） */
export function getAuth(req: FastifyRequest): AuthContext | null {
  const token = getCookie(req, COOKIE)
  if (!token) return null
  const row = db.prepare(`
    SELECT s.id AS sid, s.expires_at AS exp, s.last_used_at AS lu,
           u.id AS uid, u.username, u.role
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?
  `).get(sha256(token)) as {
    sid: number; exp: number; lu: number; uid: number; username: string; role: string
  } | undefined
  if (!row) return null
  const now = Date.now()
  if (row.exp < now) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(row.sid)
    return null
  }
  if (now - row.lu > 60_000) {
    db.prepare('UPDATE sessions SET last_used_at = ? WHERE id = ?').run(now, row.sid)
  }
  return {
    user: { id: row.uid, username: row.username, role: row.role },
    session: { id: row.sid, expiresAt: row.exp },
  }
}

/** 登录态校验：写入/查询类接口的 preHandler */
export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  if (!getAuth(req)) {
    return reply.code(401).send({ error: '请先登录' })
  }
}

/** 管理员校验（需 admin，用于角色任免等高级操作） */
export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  const auth = getAuth(req)
  if (!auth) return reply.code(401).send({ error: '请先登录' })
  if (auth.user.role !== 'admin') return reply.code(403).send({ error: '需要管理员权限' })
}

/** 副管理员及以上校验：admin 或 sub_admin */
async function requireModerator(req: FastifyRequest, reply: FastifyReply) {
  const auth = getAuth(req)
  if (!auth) return reply.code(401).send({ error: '请先登录' })
  if (auth.user.role !== 'admin' && auth.user.role !== 'sub_admin') {
    return reply.code(403).send({ error: '需要管理权限' })
  }
}

function createSession(userId: number, req: FastifyRequest, remember: boolean) {
  const token = crypto.randomBytes(32).toString('hex')
  const now = Date.now()
  const ttl = remember ? REMEMBER_TTL : DEFAULT_TTL
  const info = db.prepare(`
    INSERT INTO sessions (token_hash, user_id, device, ip, created_at, expires_at, last_used_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(sha256(token), userId, parseDevice(req.headers['user-agent']), req.ip, now, now + ttl, now)
  return { token, id: Number(info.lastInsertRowid), expiresAt: now + ttl }
}

// ---------- 登录限速（15 分钟窗口内失败 5 次，锁定 10 分钟） ----------

const WINDOW = 15 * 60 * 1000
const MAX_FAILS = 5
const LOCK_MS = 10 * 60 * 1000
const attempts = new Map<string, number[]>()

function lockRemain(key: string): number {
  const arr = (attempts.get(key) ?? []).filter(t => Date.now() - t < WINDOW)
  if (arr.length >= MAX_FAILS) {
    const until = arr[arr.length - 1] + LOCK_MS
    if (Date.now() < until) return until - Date.now()
  }
  return 0
}

function recordFail(key: string) {
  const arr = (attempts.get(key) ?? []).filter(t => Date.now() - t < WINDOW)
  arr.push(Date.now())
  attempts.set(key, arr)
}

function logLogin(username: string, req: FastifyRequest, success: boolean) {
  db.prepare('INSERT INTO login_log (username, ip, device, success, at) VALUES (?, ?, ?, ?, ?)')
    .run(username, req.ip, parseDevice(req.headers['user-agent']), success ? 1 : 0, Date.now())
}

// ---------- 路由 ----------

export async function authRoutes(app: FastifyInstance) {
  app.post<{ Body: { username?: string; password?: string; remember?: boolean } }>('/api/auth/login', {
    schema: {
      body: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string', minLength: 1, maxLength: 64 },
          password: { type: 'string', minLength: 1, maxLength: 128 },
          remember: { type: 'boolean' },
        },
      },
    },
  }, async (req, reply) => {
    const { username, password, remember = false } = req.body
    const key = `${req.ip}|${username}`

    const locked = lockRemain(key)
    if (locked > 0) {
      return reply.code(429).send({
        error: `尝试次数过多，请 ${Math.ceil(locked / 60000)} 分钟后再试`,
      })
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as {
      id: number; username: string; password: string; role: string
    } | undefined
    const ok = !!user && verifyPassword(password, user.password)
    logLogin(username, req, ok)

    if (!ok) {
      recordFail(key)
      return reply.code(401).send({ error: '用户名或密码错误' })
    }

    attempts.delete(key)
    const { token, expiresAt } = createSession(user.id, req, remember)
    setSessionCookie(reply, token, expiresAt - Date.now())
    return { user: { username: user.username, role: user.role }, expiresAt }
  })

  // 当前登录态（前端启动时探测）
  app.get('/api/auth/me', async (req) => {
    const auth = getAuth(req)
    if (!auth) return { user: null }
    return { user: auth.user, session: auth.session }
  })

  app.post('/api/auth/logout', async (req, reply) => {
    const auth = getAuth(req)
    if (auth) {
      db.prepare('DELETE FROM sessions WHERE id = ?').run(auth.session.id)
    }
    clearSessionCookie(reply)
    return { ok: true }
  })

  // 会话列表（登录设备管理）
  app.get('/api/auth/sessions', { preHandler: [requireAuth] }, async (req) => {
    const auth = getAuth(req)!
    const rows = db.prepare(`
      SELECT id, device, ip, created_at, expires_at, last_used_at
      FROM sessions WHERE user_id = ? AND expires_at > ?
      ORDER BY last_used_at DESC
    `).all(auth.user.id, Date.now()) as {
      id: number; device: string; ip: string
      created_at: number; expires_at: number; last_used_at: number
    }[]
    return {
      sessions: rows.map(r => ({ ...r, current: r.id === auth.session.id })),
    }
  })

  // 下线指定会话
  app.delete<{ Params: { id: string } }>('/api/auth/sessions/:id', { preHandler: [requireAuth] }, async (req, reply) => {
    const auth = getAuth(req)!
    const id = Number(req.params.id)
    if (!Number.isInteger(id)) {
      return reply.code(400).send({ error: '参数不合法' })
    }
    const info = db.prepare('DELETE FROM sessions WHERE id = ? AND user_id = ?').run(id, auth.user.id)
    if (info.changes === 0) {
      return reply.code(404).send({ error: '会话不存在' })
    }
    return { ok: true }
  })

  // 下线除当前外的所有设备
  app.post('/api/auth/logout-all', { preHandler: [requireAuth] }, async (req) => {
    const auth = getAuth(req)!
    const info = db.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?')
      .run(auth.user.id, auth.session.id)
    return { ok: true, revoked: info.changes }
  })

  // 最近登录记录
  app.get('/api/auth/logins', { preHandler: [requireAuth] }, async (req) => {
    const auth = getAuth(req)!
    const rows = db.prepare(`
      SELECT ip, device, success, at FROM login_log
      WHERE username = ? ORDER BY at DESC LIMIT 10
    `).all(auth.user.username) as { ip: string; device: string; success: number; at: number }[]
    return { logins: rows.map(r => ({ ...r, success: !!r.success })) }
  })

  // ---------- 用户管理（副管理员及以上） ----------

  // 用户列表：admin 看全部；副管理员只看普通用户
  app.get('/api/auth/users', { preHandler: [requireModerator] }, async (req) => {
    const auth = getAuth(req)!
    let rows
    if (auth.user.role === 'admin') {
      rows = db.prepare('SELECT id, username, role, created_at FROM users ORDER BY id').all()
    } else {
      rows = db.prepare('SELECT id, username, role, created_at FROM users WHERE role = ? ORDER BY id')
        .all('user')
    }
    return { users: rows }
  })

  // 创建用户：admin 可创建 user/sub_admin；副管理员只能创建 user
  app.post<{ Body: { username?: string; password?: string; role?: string } }>('/api/auth/users', {
    preHandler: [requireModerator],
    schema: {
      body: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string', minLength: 2, maxLength: 32 },
          password: { type: 'string', minLength: 6, maxLength: 128 },
          role: { type: 'string', enum: ['user', 'sub_admin', 'admin'] },
        },
      },
    },
  }, async (req, reply) => {
    const auth = getAuth(req)!
    const { username, password, role = 'user' } = req.body
    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      return reply.code(400).send({ error: '用户名仅限字母、数字、下划线和短横线' })
    }
    // 副管理员无权创建管理员或副管理员
    if (auth.user.role !== 'admin' && (role === 'admin' || role === 'sub_admin')) {
      return reply.code(403).send({ error: '无权创建管理角色账号' })
    }
    const exists = db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)
    if (exists) {
      return reply.code(409).send({ error: '用户名已存在' })
    }
    const info = db.prepare('INSERT INTO users (username, password, role, created_at) VALUES (?, ?, ?, ?)')
      .run(username, hashPassword(password), role, Date.now())
    const user = db.prepare('SELECT id, username, role, created_at FROM users WHERE id = ?')
      .get(Number(info.lastInsertRowid))
    return reply.code(201).send({ user })
  })

  // 删除用户：admin 可删除除自己外任意账号；副管理员只能删普通用户
  app.delete<{ Params: { id: string } }>('/api/auth/users/:id', { preHandler: [requireModerator] }, async (req, reply) => {
    const auth = getAuth(req)!
    const id = Number(req.params.id)
    if (!Number.isInteger(id)) {
      return reply.code(400).send({ error: '参数不合法' })
    }
    if (id === auth.user.id) {
      return reply.code(400).send({ error: '不能删除当前登录的账号' })
    }
    const target = db.prepare('SELECT role FROM users WHERE id = ?').get(id) as { role: string } | undefined
    if (!target) {
      return reply.code(404).send({ error: '用户不存在' })
    }
    if (auth.user.role !== 'admin' && target.role !== 'user') {
      return reply.code(403).send({ error: '无权删除该角色账号' })
    }
    db.prepare('DELETE FROM users WHERE id = ?').run(id)
    db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id)
    return { ok: true }
  })

  // 修改角色（任免副管理员/管理员）：仅 admin
  app.patch<{ Params: { id: string }, Body: { role?: string } }>('/api/auth/users/:id/role', {
    preHandler: [requireAdmin],
    schema: {
      body: {
        type: 'object',
        required: ['role'],
        properties: { role: { type: 'string', enum: ['user', 'sub_admin', 'admin'] } },
      },
    },
  }, async (req, reply) => {
    const auth = getAuth(req)!
    const id = Number(req.params.id)
    const role = req.body.role!
    if (!Number.isInteger(id)) {
      return reply.code(400).send({ error: '参数不合法' })
    }
    if (id === auth.user.id) {
      return reply.code(400).send({ error: '不能修改自己的角色' })
    }
    // 不改变目标的已有角色（仅支持 admin→sub_admin→user 单向调整，避免同级混用）
    const info = db.prepare('UPDATE users SET role = ? WHERE id = ? AND role != ?').run(role, id, role)
    if (info.changes === 0) {
      const exists = db.prepare('SELECT id FROM users WHERE id = ?').get(id)
      if (!exists) return reply.code(404).send({ error: '用户不存在' })
      return reply.code(200).send({ ok: true, changed: false }) // 已是目标角色
    }
    return { ok: true, changed: true }
  })

  // 修改自己的密码
  app.post<{ Body: { current?: string; next?: string } }>('/api/auth/password', {
    preHandler: [requireAuth],
    schema: {
      body: {
        type: 'object',
        required: ['current', 'next'],
        properties: {
          current: { type: 'string', minLength: 1 },
          next: { type: 'string', minLength: 6, maxLength: 128 },
        },
      },
    },
  }, async (req, reply) => {
    const auth = getAuth(req)!
    const { current, next } = req.body
    const user = db.prepare('SELECT password FROM users WHERE id = ?').get(auth.user.id) as { password: string }
    if (!verifyPassword(current, user.password)) {
      return reply.code(401).send({ error: '当前密码错误' })
    }
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashPassword(next), auth.user.id)
    // 改密后吊销其他设备
    db.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?').run(auth.user.id, auth.session.id)
    return { ok: true }
  })
}
