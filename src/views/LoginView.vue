<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { AlertCircle, Check, Eye, EyeOff, Home, Loader2, Lock, Moon, Sun, User } from '@lucide/vue'
import { useAuth } from '@/composables/useAuth'
import { useTheme } from '@/composables/useTheme'

const route = useRoute()
const router = useRouter()
const { login } = useAuth()
const { isDark, toggle } = useTheme()

const username = ref('')
const password = ref('')
const remember = ref(false)
const showPassword = ref(false)
const loading = ref(false)
const error = ref('')
const shake = ref(0)

onMounted(() => {
  if (typeof route.query.error === 'string') {
    error.value = route.query.error
    shake.value++
  }
})

async function submit() {
  if (loading.value) return
  if (!username.value.trim() || !password.value) {
    error.value = '请输入用户名和密码'
    shake.value++
    return
  }
  loading.value = true
  error.value = ''
  try {
    await login(username.value.trim(), password.value, remember.value)
    const next = route.query.next
    router.push(typeof next === 'string' && next.startsWith('/') ? next : '/')
  } catch (e) {
    error.value = (e as Error).message
    shake.value++
  } finally {
    loading.value = false
  }
}

// ============ 琉璃方格背景（Canvas 自绘，含鼠标互动，随主题切换） ============

const canvas = ref<HTMLCanvasElement | null>(null)
const card = ref<HTMLElement | null>(null)

interface Cell {
  pts: [number, number][]
  color: [number, number, number]
}

const PALETTE: [number, number, number][] = [
  [16, 185, 129],  // 翡翠
  [20, 184, 166],  // 青碧
  [245, 158, 11],  // 琥珀金
  [202, 138, 4],   // 暗金
  [244, 63, 94],   // 玫瑰
  [251, 146, 60],  // 橙
  [163, 230, 53],  // 嫩绿
  [34, 211, 238],  // 湖蓝
  [148, 163, 184], // 青灰
  [139, 92, 246],  // 紫罗兰（少量）
]

let cells: Cell[] = []
const mouse = reactive({ x: -9999, y: -9999 })
let rafId = 0
let pending = false

function makeCells(w: number, h: number) {
  const col = Math.max(8, Math.round(w / 88))
  const row = Math.max(6, Math.round(h / 88))
  const cw = w / col
  const ch = h / row
  cells = []
  for (let r = 0; r < row; r++) {
    for (let c = 0; c < col; c++) {
      const x = c * cw
      const y = r * ch
      const j = (a: number, b: number) => a + (Math.random() * 2 - 1) * b * 0.32
      cells.push({
        pts: [
          [j(x, cw), j(y, ch)],
          [j(x + cw, cw), j(y, ch)],
          [j(x + cw, cw), j(y + ch, ch)],
          [j(x, cw), j(y + ch, ch)],
        ],
        color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
      })
    }
  }
}

function draw() {
  const cv = canvas.value
  if (!cv) return
  const ctx = cv.getContext('2d')
  if (!ctx) return
  const dpr = window.devicePixelRatio || 1
  const w = cv.clientWidth
  const h = cv.clientHeight
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
    cv.width = Math.round(w * dpr)
    cv.height = Math.round(h * dpr)
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, w, h)

  const dark = isDark.value
  // 浅色：暖白纸感；深色：炭黑琉璃
  ctx.fillStyle = dark ? '#0b0d11' : '#f6f5f1'
  ctx.fillRect(0, 0, w, h)

  const R = 170
  for (const cell of cells) {
    const cx = (cell.pts[0][0] + cell.pts[2][0]) / 2
    const cy = (cell.pts[0][1] + cell.pts[2][1]) / 2
    const d = Math.hypot(mouse.x - cx, mouse.y - cy)
    const g = Math.max(0, 1 - d / R)
    const [r, g2, b] = cell.color

    ctx.beginPath()
    ctx.moveTo(cell.pts[0][0], cell.pts[0][1])
    for (let i = 1; i < 4; i++) ctx.lineTo(cell.pts[i][0], cell.pts[i][1])
    ctx.closePath()

    // 底色：深色下玻璃偏暗、悬停提亮；浅色下仅为极淡色块、悬停微加深
    const alpha = dark ? 0.10 + 0.32 * g : 0.05 + 0.09 * g
    ctx.fillStyle = `rgba(${r},${g2},${b},${alpha})`
    ctx.fill()

    // 描边：靠近鼠标时亮起
    const edge = dark
      ? `rgba(255,255,255,${g > 0.04 ? 0.12 + 0.40 * g : 0.05})`
      : `rgba(15,23,42,${g > 0.04 ? 0.09 + 0.20 * g : 0.04})`
    ctx.strokeStyle = edge
    ctx.lineWidth = 1
    ctx.stroke()

    // 琉璃斜向反光（仅深色下可见）
    if (dark && g > 0.04) {
      const lg = ctx.createLinearGradient(
        cell.pts[0][0], cell.pts[0][1],
        cell.pts[2][0], cell.pts[2][1],
      )
      lg.addColorStop(0, `rgba(255,255,255,${0.20 * g})`)
      lg.addColorStop(0.45, 'rgba(255,255,255,0)')
      lg.addColorStop(0.55, 'rgba(255,255,255,0)')
      lg.addColorStop(1, `rgba(255,255,255,${0.08 * g})`)
      ctx.fillStyle = lg
      ctx.fill()
    }
  }

  // 指针处光晕（暗色暖光 / 浅色柔和金）
  if (mouse.x > -1000) {
    const grd = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, R * 1.5)
    grd.addColorStop(0, dark ? 'rgba(255, 241, 209, 0.16)' : 'rgba(217, 119, 6, 0.08)')
    grd.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = grd
    ctx.fillRect(0, 0, w, h)
  }
}

function scheduleDraw() {
  if (pending) return
  pending = true
  rafId = requestAnimationFrame(() => {
    pending = false
    draw()
  })
}

function onPointerMove(e: PointerEvent) {
  mouse.x = e.clientX
  mouse.y = e.clientY
  scheduleDraw()
}

function onPointerLeave() {
  mouse.x = -9999
  mouse.y = -9999
  scheduleDraw()
}

function onResize() {
  const cv = canvas.value
  if (!cv) return
  makeCells(cv.clientWidth, cv.clientHeight)
  draw()
}

// 主题切换时重绘背景
watch(isDark, () => draw())

// ============ 登录卡琉璃倾斜互动 ============

function onCardMove(e: PointerEvent) {
  const el = card.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const px = (e.clientX - rect.left) / rect.width - 0.5
  const py = (e.clientY - rect.top) / rect.height - 0.5
  el.style.transform = `perspective(900px) rotateX(${(-py * 4).toFixed(2)}deg) rotateY(${(px * 4).toFixed(2)}deg) translateY(-3px)`
  const sp = el.querySelector<HTMLElement>('.card-spot')
  if (sp) {
    const c = isDark.value ? '255,255,255' : '120,113,108'
    sp.style.background = `radial-gradient(240px circle at ${((px + 0.5) * 100).toFixed(1)}% ${((py + 0.5) * 100).toFixed(1)}%, rgba(${c},${isDark.value ? 0.10 : 0.06}), transparent 68%)`
  }
}

function onCardLeave() {
  const el = card.value
  if (!el) return
  el.style.transform = ''
  const sp = el.querySelector<HTMLElement>('.card-spot')
  if (sp) sp.style.background = ''
}

onMounted(() => {
  onResize()
  window.addEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  cancelAnimationFrame(rafId)
})
</script>

<template>
  <div
    class="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f6f5f1] px-4 text-stone-800 transition-colors dark:bg-[#0b0d11] dark:text-white"
    @pointermove="onPointerMove"
    @pointerleave="onPointerLeave"
  >
    <!-- 琉璃方格背景 -->
    <canvas ref="canvas" class="absolute inset-0 h-full w-full" />

    <!-- 深色遮罩：保证前景可读性 -->
    <template v-if="isDark">
      <div class="pointer-events-none absolute inset-0 bg-black/45" />
      <div
        class="pointer-events-none absolute inset-0"
        style="background: radial-gradient(ellipse at center, rgba(5,6,10,0.10) 0%, rgba(5,6,10,0.62) 72%, rgba(5,6,10,0.85) 100%);"
      />
      <div
        class="pointer-events-none absolute inset-0"
        style="background: linear-gradient(to top, rgba(5,6,10,0.9) 0%, transparent 28%), linear-gradient(to bottom, rgba(5,6,10,0.55) 0%, transparent 18%);"
      />
    </template>
    <!-- 浅色遮罩（纸感，几乎无遮） -->
    <template v-else>
      <div class="pointer-events-none absolute inset-0 bg-white/5" />
      <div
        class="pointer-events-none absolute inset-0"
        style="background: radial-gradient(ellipse at center, rgba(255,255,255,0) 0%, rgba(226,230,235,0.35) 78%, rgba(205,210,216,0.5) 100%);"
      />
    </template>

    <!-- 返回主页 -->
    <button
      class="absolute left-4 top-4 z-10 flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-stone-500 transition-colors hover:bg-black/5 hover:text-stone-800 dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
      aria-label="返回主页"
      title="返回主页"
      @click="router.push('/')"
    >
      <Home class="h-5 w-5" />
      <span class="text-sm">主页</span>
    </button>

    <!-- 主题切换 -->
    <button
      class="absolute right-4 top-4 z-10 rounded-lg p-2 text-stone-500 transition-colors hover:bg-black/5 hover:text-stone-800 dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white"
      aria-label="切换主题"
      @click="toggle"
    >
      <Sun v-if="isDark" class="h-5 w-5" />
      <Moon v-else class="h-5 w-5" />
    </button>

    <!-- 登录卡片（覆盖于背景之上） -->
    <div class="relative z-10 w-full max-w-sm" style="perspective: 900px;">
      <div
        ref="card"
        class="card-enter relative rounded-2xl border border-stone-200/80 bg-white/85 p-8 shadow-xl shadow-stone-300/50 backdrop-blur-xl transition-transform duration-200 ease-out will-change-transform dark:border-white/15 dark:bg-white/[0.07] dark:shadow-black/60"
        @pointermove="onCardMove"
        @pointerleave="onCardLeave"
      >
        <!-- 琉璃反光：顶部高光 + 跟随指针的光斑 -->
        <div class="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-stone-300/60 to-transparent dark:via-white/40" />
        <div class="pointer-events-none absolute inset-x-6 top-6 h-10 rounded-full bg-stone-200/40 blur-2xl dark:bg-white/5" />
        <div class="card-spot pointer-events-none absolute inset-0 rounded-2xl" />

        <!-- Logo -->
        <div class="relative mb-8 flex flex-col items-center gap-3">
          <span class="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-400 text-lg font-bold text-stone-800 shadow-lg shadow-amber-500/30 ring-1 ring-stone-300 dark:ring-white/20">
            IT
          </span>
          <div class="text-center">
            <h1 class="text-xl font-semibold tracking-tight">欢迎回来</h1>
            <p class="mt-1 text-xs text-stone-500 dark:text-white/50">登录 IT Tools 以使用需要后端支持的工具</p>
          </div>
        </div>

        <form class="relative space-y-4" @submit.prevent="submit">
          <!-- 用户名 -->
          <div class="space-y-1.5">
            <label for="username" class="text-xs font-medium text-stone-600 dark:text-white/70">用户名</label>
            <div class="group relative">
              <User class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400 transition-colors group-focus-within:text-amber-600 dark:text-white/35 dark:group-focus-within:text-amber-300" />
              <input
                id="username"
                v-model="username"
                type="text"
                autocomplete="username"
                placeholder="admin"
                class="w-full rounded-lg border border-stone-200 bg-stone-50 py-2.5 pl-10 pr-3 text-sm text-stone-800 placeholder:text-stone-400 transition-all focus:border-amber-500/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/25 dark:focus:border-amber-400/60 dark:focus:bg-white/[0.08] dark:focus:ring-amber-500/30"
              >
            </div>
          </div>

          <!-- 密码 -->
          <div class="space-y-1.5">
            <label for="password" class="text-xs font-medium text-stone-600 dark:text-white/70">密码</label>
            <div class="group relative">
              <Lock class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400 transition-colors group-focus-within:text-amber-600 dark:text-white/35 dark:group-focus-within:text-amber-300" />
              <input
                id="password"
                v-model="password"
                :type="showPassword ? 'text' : 'password'"
                autocomplete="current-password"
                placeholder="••••••••"
                class="w-full rounded-lg border border-stone-200 bg-stone-50 py-2.5 pl-10 pr-10 text-sm text-stone-800 placeholder:text-stone-400 transition-all focus:border-amber-500/70 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/30 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/25 dark:focus:border-amber-400/60 dark:focus:bg-white/[0.08] dark:focus:ring-amber-500/30"
              >
              <button
                type="button"
                class="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-stone-400 transition-colors hover:text-slate-700 dark:text-white/35 dark:hover:text-white/80"
                :aria-label="showPassword ? '隐藏密码' : '显示密码'"
                @click="showPassword = !showPassword"
              >
                <Eye v-if="showPassword" class="h-4 w-4" />
                <EyeOff v-else class="h-4 w-4" />
              </button>
            </div>
          </div>

          <!-- 记住我 -->
          <div class="flex items-center justify-between pt-1">
            <button
              type="button"
              class="flex items-center gap-2 text-xs text-stone-600 transition-colors hover:text-stone-800 dark:text-white/60 dark:hover:text-white"
              @click="remember = !remember"
            >
              <span
                class="flex h-4 w-4 items-center justify-center rounded border transition-all"
                :class="remember
                  ? 'border-amber-500 bg-amber-500 text-stone-800 dark:border-amber-400 dark:bg-amber-500'
                  : 'border-stone-300 bg-transparent text-transparent hover:border-stone-500 dark:border-white/25 dark:hover:border-white/50'"
              >
                <Check class="h-3 w-3" />
              </span>
              记住我
              <span class="text-stone-400 dark:text-white/30">（30 天）</span>
            </button>
            <span class="text-[11px] text-stone-400 dark:text-white/30">默认保持 7 天</span>
          </div>

          <!-- 错误提示 -->
          <Transition name="shake">
            <p
              v-if="error"
              :key="shake"
              class="flex items-center gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2.5 text-xs text-red-600 dark:border-red-400/30 dark:bg-red-500/10 dark:text-red-300"
            >
              <AlertCircle class="h-3.5 w-3.5 shrink-0" /> {{ error }}
            </p>
          </Transition>

          <!-- 提交 -->
          <button
            type="submit"
            :disabled="loading"
            class="btn-grad relative flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-stone-800 transition-all hover:shadow-lg hover:shadow-amber-500/30 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Loader2 v-if="loading" class="h-4 w-4 animate-spin" />
            {{ loading ? '正在验证...' : '登 录' }}
          </button>
        </form>
      </div>

      <p class="mt-6 text-center text-[11px] text-stone-400 dark:text-white/25">
        自部署服务 · 数据仅保存在本机 SQLite · 会话通过 HttpOnly Cookie 保护
      </p>
    </div>
  </div>
</template>

<style scoped>
.card-enter {
  /* 用 backwards：动画结束后不持有末帧，避免覆盖 JS 的倾斜 transform */
  animation: card-enter 0.5s cubic-bezier(0.16, 1, 0.3, 1) backwards;
}
@keyframes card-enter {
  from { opacity: 0; transform: translateY(18px) scale(0.97); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

/* 琥珀金渐变按钮（高级黑金质感，避开蓝紫 AI 色） */
.btn-grad {
  background: linear-gradient(135deg, #f59e0b, #fbbf24 55%, #fcd34d);
}
.btn-grad:hover:not(:disabled) {
  filter: brightness(1.06);
}
.btn-grad:active:not(:disabled) {
  filter: brightness(0.95);
}

/* 错误提示抖动 */
.shake-enter-active {
  animation: shake 0.4s ease;
}
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-7px); }
  40% { transform: translateX(7px); }
  60% { transform: translateX(-5px); }
  80% { transform: translateX(5px); }
}

@media (prefers-reduced-motion: reduce) {
  .card-enter {
    animation: none;
  }
}
</style>
