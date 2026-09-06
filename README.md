# IT Tools 开发者工具箱

一个自部署的开发者在线工具箱，包含 JSON 处理、编解码、时间/生成器、哈希、文本、转换器与 Web/后端等 30 余个工具。前后端一体，开箱即用。

## 特性

- **30 个工具**：编解码、JSON、时间戳、UUID/密码/二维码生成、OTP、哈希、文本、进制/单位/颜色/CSV 转换、HTTP 状态码速查等
- **可用的后端工具**：文本分享、短链接、IP 归属地、网站检测、汇率换算（需登录）
- **完整的账号体系**：`admin`（超管）→ `sub_admin`（副管理员）→ `user` 三角色
- **安全登录**：scrypt 加盐哈希、服务端会话 + HttpOnly Cookie（防 XSS / CSRF）、登录限速、登录日志
- **深色 / 浅色主题**，移动端自适应响应式布局
- **纯本地存储**：数据全部保存在本机 SQLite，不依赖外部服务
- 各工具均标注外部数据源与「仅本机处理 / 不上传」提示

## 技术栈

- **前端**：Vue 3 + TypeScript + Vite + Vue Router + Tailwind CSS v4 + shadcn-vue / reka-ui + Lucide 图标
- **后端**：Fastify 5 + better-sqlite3（SQLite）
- 单进程同时托管 API 与前端静态资源，部署一台机器即可运行

## 快速开始

环境要求：Node.js ≥ 20。

```bash
# 安装依赖
npm install        # 或 pnpm install / yarn

# 开发模式（后端热重载 + Vite HMR，默认 0.0.0.0:3000）
npm run dev

# 生产模式（需先构建前端）
npm run build
npm start
```

启动后在浏览器访问 <http://127.0.0.1:3000>（局域网内其它设备可用 `http://<本机IP>:3000` 访问）。

## 默认账号

首次启动自动创建管理员账号：

| 用户名 | 密码 |
|--------|------|
| `admin` | 见 `data/auth-password` 文件；或用环境变量 `AUTH_PASSWORD` 自定义 |

登录后建议到「账户页 → 修改密码」更换密码。

## 角色权限

| 能力 | admin | 副管理员 | user |
|------|:---:|:---:|:---:|
| 查看用户列表 | 全部 | 仅普通用户 | - |
| 创建普通用户 | ✓ | ✓ | - |
| 创建 / 任免副管理员 | ✓ | ✗ | - |
| 删除用户 | 除自己外任意 | 仅普通用户 | - |
| 使用后端工具 | ✓ | ✓ | ✓ |
| 修改密码 / 会话管理 | ✓ | ✓ | ✓ |

## 目录结构

```
├── src/                        # 前端
│   ├── tools/<slug>/Index.vue  # 每个工具一个组件（自动按 slug 加载）
│   ├── views/                  # 页面（首页、工具页、登录、账户）
│   ├── data/tools.ts           # 工具注册表（元数据、分类、图标）
│   └── ...
├── server/                     # 后端
│   ├── index.ts                # Fastify 入口（静态托管 + 路由注册）
│   ├── db.ts                   # SQLite 初始化 / 默认账号
│   └── routes/                 # auth / paste / shorten / ip / sitecheck / rates
└── data/                       # SQLite 数据库与运行时密钥（勿提交到仓库）
```

### 添加一个工具

1. 创建 `src/tools/<slug>/Index.vue`（组件可用任意现有工具为模板）
2. 在 `src/data/tools.ts` 中注册 `ToolMeta`（slug、名称、描述、图标、分类）
3. 若需要后端能力，在 `server/routes/` 新增路由并在 `server/index.ts` 注册，同时给工具标记 `backend: true`（未登录访问会自动跳转登录页）

新工具会被 `import.meta.glob` 自动加载，无需改路由。

## 环境变量

| 变量 | 说明 | 默认 |
|------|------|------|
| `PORT` | 监听端口 | `3000` |
| `HOST` | 监听地址 | `0.0.0.0` |
| `AUTH_PASSWORD` | 首次启动时 admin 的密码（仅创建账号时生效） | 随机生成，写入 `data/auth-password` |

## 外部数据源

以下工具在查询时会调用外部免费接口，均已标注在对应工具页：

- **IP 归属地**：ip-api.com
- **汇率换算**：ExchangeRate-API
- **网站检测**：对目标站点做 TLS / HTTP 探测

其余工具（编解码、哈希、JSON、生成器等）全部在浏览器本地执行，数据不离开你的设备。

## 安全说明

- 密码使用 `scrypt + 随机盐` 存储，不保存明文
- 登录会话使用服务端记录 + `HttpOnly` / `SameSite=Lax` Cookie
- 登录接口限速：15 分钟内失败 5 次将锁定 10 分钟
- 所有后端工具接口均需登录后访问

> 本项目为自部署、内网 / 个人使用的工具箱。如需暴露到公网，请务必置于 HTTPS 反代（如 Caddy / Nginx）之后。

## License

MIT