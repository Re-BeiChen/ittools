import { computed, ref } from 'vue'

export interface AuthUser {
  username: string
  role: string
}

const user = ref<AuthUser | null>(null)
const sessionExpiresAt = ref<number | null>(null)

// 清理 v1 遗留的 localStorage token（现改用 HttpOnly Cookie）
localStorage.removeItem('ittools_token')

/** 启动时探测一次登录态（HttpOnly Cookie 无法由 JS 读取，须问服务端） */
const ready: Promise<void> = fetch('/api/auth/me')
  .then(async (res) => {
    const data = await res.json() as { user: AuthUser | null; session?: { expiresAt: number } }
    user.value = data.user
    sessionExpiresAt.value = data.session?.expiresAt ?? null
  })
  .catch(() => {
    // 网络异常时不改动状态
  })

export function useAuth() {
  const loggedIn = computed(() => !!user.value)

  async function login(username: string, password: string, remember = false): Promise<boolean> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, remember }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? '登录失败')
    user.value = data.user
    sessionExpiresAt.value = data.expiresAt
    return true
  }

  async function logout() {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // 忽略网络错误，本地状态照常清空
    }
    user.value = null
    sessionExpiresAt.value = null
  }

  /** 带登录态的 fetch（Cookie 自动携带）；401 时清理状态并跳转登录页 */
  async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
    const res = await fetch(input, init)
    if (res.status === 401) {
      user.value = null
      sessionExpiresAt.value = null
      if (!location.pathname.startsWith('/login')) {
        location.href = `/login?next=${encodeURIComponent(location.pathname + location.search)}`
      }
    }
    return res
  }

  return { user, loggedIn, sessionExpiresAt, ready, login, logout, authFetch }
}
