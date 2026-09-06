import crypto from 'node:crypto'
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.resolve(__dirname, '../data')
fs.mkdirSync(dataDir, { recursive: true })

export const db = new Database(path.join(dataDir, 'ittools.db'))

db.pragma('journal_mode = WAL')

db.exec(`
CREATE TABLE IF NOT EXISTS pastes (
  code TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  burn INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  expires_at INTEGER
);

CREATE TABLE IF NOT EXISTS links (
  code TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  clicks INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_links_created ON links(created_at);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_hash TEXT UNIQUE NOT NULL,
  user_id INTEGER NOT NULL,
  device TEXT,
  ip TEXT,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS login_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  ip TEXT,
  device TEXT,
  success INTEGER NOT NULL,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_login_log_username ON login_log(username, at);
`)

// ---------- 密码哈希（scrypt + 随机盐） ----------

export function hashPassword(pw: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(pw, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(pw: string, stored: string): boolean {
  const [salt, hash] = stored.split(':')
  if (!salt || !hash) return false
  const test = crypto.scryptSync(pw, salt, 64)
  const orig = Buffer.from(hash, 'hex')
  return orig.length === test.length && crypto.timingSafeEqual(orig, test)
}

// ---------- 首次启动引导管理员 ----------

function readOrCreate(file: string, gen: () => string): string {
  const p = path.join(dataDir, file)
  try {
    const v = fs.readFileSync(p, 'utf8').trim()
    if (v) return v
  } catch {
    // 不存在则创建
  }
  const v = gen()
  fs.writeFileSync(p, v, { encoding: 'utf8' })
  return v
}

function seedAdmin() {
  const count = (db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }).c
  if (count > 0) return
  const pw = process.env.AUTH_PASSWORD
    || readOrCreate('auth-password', () => crypto.randomBytes(9).toString('base64url'))
  db.prepare('INSERT INTO users (username, password, role, created_at) VALUES (?, ?, ?, ?)')
    .run('admin', hashPassword(pw), 'admin', Date.now())
  console.log('[auth] 首次启动：已创建管理员账号 admin，密码见 data/auth-password（或 AUTH_PASSWORD 环境变量）')
}
seedAdmin()

/** 清理过期的 paste 与太久远的 link（保留 90 天）与过期会话 */
export function startCleanup() {
  const clean = () => {
    const now = Date.now()
    db.prepare('DELETE FROM pastes WHERE expires_at IS NOT NULL AND expires_at < ?').run(now)
    db.prepare('DELETE FROM links WHERE created_at < ?').run(now - 90 * 24 * 3600 * 1000)
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now)
    db.prepare('DELETE FROM login_log WHERE at < ?').run(now - 90 * 24 * 3600 * 1000)
  }
  clean()
  setInterval(clean, 10 * 60 * 1000).unref()
}

/** 生成随机短码（小写字母+数字，去除易混淆字符） */
export function genCode(len = 6): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  let s = ''
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  for (const b of bytes) s += alphabet[b % alphabet.length]
  return s
}
