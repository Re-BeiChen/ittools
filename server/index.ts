import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Fastify from 'fastify'
import { startCleanup } from './db'
import { authRoutes } from './routes/auth'
import { ipRoutes } from './routes/ip'
import { pasteRoutes } from './routes/paste'
import { ratesRoutes } from './routes/rates'
import { shortenRoutes } from './routes/shorten'
import { siteCheckRoutes } from './routes/sitecheck'
import { whoisRoutes } from './routes/whois'
import { dnsRoutes } from './routes/dns'

// 加载 .env 中的环境变量（API 密钥等），已存在的环境变量优先
const envPath = path.resolve(process.cwd(), '.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
}

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT ?? 3000)
const HOST = process.env.HOST ?? '0.0.0.0'

const app = Fastify({
  logger: true,
  trustProxy: true,
})

app.addHook('onRequest', async (_req, reply) => {
  reply.header('x-content-type-options', 'nosniff')
})

await app.register(authRoutes)
await app.register(pasteRoutes)
await app.register(shortenRoutes)
await app.register(ipRoutes)
await app.register(siteCheckRoutes)
await app.register(ratesRoutes)
await app.register(whoisRoutes)
await app.register(dnsRoutes)

// paste 短码页面（前端渲染）
app.setNotFoundHandler(async (req, reply) => {
  const distIndex = path.resolve(__dirname, '../dist/index.html')
  if (req.method === 'GET' && !req.url.startsWith('/api/') && fs.existsSync(distIndex)) {
    return reply.type('text/html').send(fs.readFileSync(distIndex))
  }
  return reply.code(404).send({ error: 'Not Found' })
})

// 生产模式托管前端静态文件
const distDir = path.resolve(__dirname, '../dist')
if (fs.existsSync(distDir)) {
  await app.register(import('@fastify/static'), {
    root: distDir,
    prefix: '/',
  })
}

startCleanup()

app.listen({ port: PORT, host: HOST }, (err) => {
  if (err) {
    app.log.error(err)
    process.exit(1)
  }
})
