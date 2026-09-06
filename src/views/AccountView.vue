<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  Check,
  KeyRound,
  Loader2,
  LogIn,
  LogOut,
  MonitorSmartphone,
  Plus,
  ShieldCheck,
  Trash2,
  UserPlus,
} from '@lucide/vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/composables/useAuth'

const router = useRouter()
const { user, logout } = useAuth()

interface SessionRow {
  id: number
  device: string
  ip: string
  created_at: number
  expires_at: number
  last_used_at: number
  current: boolean
}
interface LoginRow {
  ip: string
  device: string
  success: boolean
  at: number
}
interface UserRow {
  id: number
  username: string
  role: string
  created_at: number
}

const sessions = ref<SessionRow[]>([])
const logins = ref<LoginRow[]>([])
const users = ref<UserRow[]>([])
const loading = ref(true)
const busy = ref(false)
const message = ref('')
const error = ref('')

// 是否为管理员（可管理任意角色、任免副管理员）
const isAdmin = () => user.value?.role === 'admin'
// 是否具备管理权限（admin 或 副管理员）
const canManage = () => user.value?.role === 'admin' || user.value?.role === 'sub_admin'

// 改密表单
const showChangePw = ref(false)
const currentPw = ref('')
const nextPw = ref('')

// 新建用户表单
const showAddUser = ref(false)
const newUsername = ref('')
const newPassword = ref('')
const newRole = ref('user')

function flash(msg: string) {
  message.value = msg
  error.value = ''
  setTimeout(() => (message.value = ''), 2500)
}

async function loadAll() {
  loading.value = true
  try {
    const [s, l] = await Promise.all([
      fetch('/api/auth/sessions').then(r => r.json()),
      fetch('/api/auth/logins').then(r => r.json()),
    ])
    sessions.value = s.sessions ?? []
    logins.value = l.logins ?? []
    if (canManage()) {
      const u = await fetch('/api/auth/users').then(r => r.json())
      users.value = u.users ?? []
    }
  } finally {
    loading.value = false
  }
}
onMounted(loadAll)

async function revoke(id: number) {
  busy.value = true
  try {
    const res = await fetch(`/api/auth/sessions/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error((await res.json()).error ?? '操作失败')
    sessions.value = sessions.value.filter(s => s.id !== id)
    flash('已下线该设备')
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}

async function revokeOthers() {
  busy.value = true
  try {
    const res = await fetch('/api/auth/logout-all', { method: 'POST' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? '操作失败')
    flash(`已下线其他 ${data.revoked} 台设备`)
    await loadAll()
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}

async function changePassword() {
  if (!currentPw.value || nextPw.value.length < 6) {
    error.value = '新密码至少 6 位'
    return
  }
  busy.value = true
  try {
    const res = await fetch('/api/auth/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current: currentPw.value, next: nextPw.value }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? '修改失败')
    showChangePw.value = false
    currentPw.value = ''
    nextPw.value = ''
    flash('密码已修改，其他设备已被下线')
    await loadAll()
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}

async function addUser() {
  if (!newUsername.value.trim() || newPassword.value.length < 6) {
    error.value = '用户名必填，密码至少 6 位'
    return
  }
  busy.value = true
  try {
    const res = await fetch('/api/auth/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: newUsername.value.trim(), password: newPassword.value, role: isAdmin() ? newRole.value : 'user' }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? '创建失败')
    users.value.push(data.user)
    showAddUser.value = false
    newUsername.value = ''
    newPassword.value = ''
    flash(`已创建用户 ${data.user.username}`)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}

async function deleteUser(id: number, username: string) {
  if (!window.confirm(`确定删除用户 ${username}？其所有会话将被吊销`)) return
  busy.value = true
  try {
    const res = await fetch(`/api/auth/users/${id}`, { method: 'DELETE' })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? '删除失败')
    users.value = users.value.filter(u => u.id !== id)
    flash(`已删除用户 ${username}`)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}

/** 修改角色（任免副管理员/管理员）：仅 admin */
async function changeRole(id: number, role: string) {
  busy.value = true
  try {
    const res = await fetch(`/api/auth/users/${id}/role`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? '修改失败')
    const u = users.value.find(x => x.id === id)
    if (u) u.role = role
    const label = role === 'admin' ? '管理员' : role === 'sub_admin' ? '副管理员' : '普通用户'
    flash(`已将 ${u?.username} 设为${label}`)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    busy.value = false
  }
}

async function doLogout() {
  await logout()
  router.push('/login')
}

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleString('zh-CN', { hour12: false })
}

function fmtRelative(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return '刚刚'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} 小时前`
  return `${Math.floor(diff / 86400_000)} 天前`
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 pb-16 pt-4 md:px-6">
    <!-- 头部 -->
    <div class="mb-8 flex flex-wrap items-center justify-between gap-4">
      <div class="flex items-center gap-4">
        <span class="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-lg font-bold text-white shadow-md">
          {{ user?.username?.[0]?.toUpperCase() ?? '?' }}
        </span>
        <div>
          <h1 class="flex items-center gap-2 text-xl font-bold tracking-tight">
            {{ user?.username }}
            <Badge v-if="user?.role === 'admin'" class="bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
              <ShieldCheck class="mr-1 h-3 w-3" /> 管理员
            </Badge>
            <Badge v-else-if="user?.role === 'sub_admin'" class="bg-amber-500/15 text-amber-600 dark:text-amber-400">
              <ShieldCheck class="mr-1 h-3 w-3" /> 副管理员
            </Badge>
          </h1>
          <p class="mt-0.5 text-sm text-muted-foreground">账户与登录设备管理</p>
        </div>
      </div>
      <Button variant="outline" @click="doLogout">
        <LogOut class="h-4 w-4" /> 退出登录
      </Button>
    </div>

    <div v-if="message" class="mb-4 rounded-md border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-600 dark:text-green-400">
      {{ message }}
    </div>
    <div v-if="error" class="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
      {{ error }}
    </div>

    <div v-if="loading" class="flex h-40 items-center justify-center text-muted-foreground">
      <Loader2 class="mr-2 h-4 w-4 animate-spin" /> 加载中...
    </div>

    <div v-else class="space-y-6">
      <!-- 登录设备 -->
      <section class="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
          <h2 class="flex items-center gap-2 text-sm font-semibold">
            <MonitorSmartphone class="h-4 w-4" /> 登录设备
            <span class="text-xs font-normal text-muted-foreground">{{ sessions.length }} 个活跃会话</span>
          </h2>
          <Button v-if="sessions.length > 1" variant="outline" size="sm" :disabled="busy" @click="revokeOthers">
            <LogOut class="h-3.5 w-3.5" /> 下线其他设备
          </Button>
        </div>
        <div class="divide-y">
          <div v-for="s in sessions" :key="s.id" class="flex items-center gap-3 px-4 py-3">
            <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-xs">
              {{ s.device.split(' · ')[0]?.slice(0, 2) }}
            </span>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 text-sm font-medium">
                {{ s.device }}
                <Badge v-if="s.current" variant="secondary" class="bg-green-500/15 text-green-600 dark:text-green-400">当前</Badge>
              </div>
              <div class="mt-0.5 text-xs text-muted-foreground">
                {{ s.ip }} · 上次活跃 {{ fmtRelative(s.last_used_at) }} · 过期于 {{ fmtTime(s.expires_at) }}
              </div>
            </div>
            <Button v-if="!s.current" variant="ghost" size="icon" class="h-8 w-8 text-muted-foreground hover:text-destructive" title="下线此设备" :disabled="busy" @click="revoke(s.id)">
              <Trash2 class="h-4 w-4" />
            </Button>
          </div>
        </div>
      </section>

      <!-- 最近登录 -->
      <section class="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div class="border-b px-4 py-3">
          <h2 class="flex items-center gap-2 text-sm font-semibold">
            <LogIn class="h-4 w-4" /> 最近登录记录
          </h2>
        </div>
        <div class="divide-y">
          <div v-for="(l, i) in logins" :key="i" class="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <span class="text-muted-foreground">{{ fmtTime(l.at) }}</span>
            <span class="flex items-center gap-2 text-xs">
              <span class="font-mono">{{ l.ip }}</span>
              <span class="text-muted-foreground">{{ l.device }}</span>
              <Badge v-if="l.success" variant="secondary" class="bg-green-500/15 text-green-600 dark:text-green-400">成功</Badge>
              <Badge v-else variant="secondary" class="bg-red-500/15 text-red-600 dark:text-red-400">失败</Badge>
            </span>
          </div>
          <p v-if="logins.length === 0" class="px-4 py-4 text-center text-xs text-muted-foreground">暂无记录</p>
        </div>
      </section>

      <!-- 修改密码 -->
      <section class="rounded-xl border bg-card shadow-sm">
        <div class="flex items-center justify-between border-b px-4 py-3">
          <h2 class="flex items-center gap-2 text-sm font-semibold">
            <KeyRound class="h-4 w-4" /> 修改密码
          </h2>
          <Button v-if="!showChangePw" variant="outline" size="sm" @click="showChangePw = true">修改</Button>
        </div>
        <div v-if="showChangePw" class="space-y-3 p-4">
          <div class="space-y-1.5">
            <Label class="text-xs">当前密码</Label>
            <Input v-model="currentPw" type="password" autocomplete="current-password" />
          </div>
          <div class="space-y-1.5">
            <Label class="text-xs">新密码（至少 6 位）</Label>
            <Input v-model="nextPw" type="password" autocomplete="new-password" />
          </div>
          <div class="flex gap-2">
            <Button size="sm" :disabled="busy" @click="changePassword">
              <Check class="h-3.5 w-3.5" /> 确认修改
            </Button>
            <Button size="sm" variant="ghost" @click="showChangePw = false">取消</Button>
          </div>
          <p class="text-xs text-muted-foreground">修改成功后，其他设备将被强制下线</p>
        </div>
      </section>

      <!-- 用户管理（管理员 / 副管理员） -->
      <section v-if="canManage()" class="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div class="flex items-center justify-between border-b px-4 py-3">
          <h2 class="flex items-center gap-2 text-sm font-semibold">
            <UserPlus class="h-4 w-4" /> 用户管理
            <span class="text-xs font-normal text-muted-foreground">{{ users.length }} 个账号</span>
          </h2>
          <Button v-if="!showAddUser" variant="outline" size="sm" @click="showAddUser = true">
            <Plus class="h-3.5 w-3.5" /> 添加用户
          </Button>
        </div>

        <div v-if="showAddUser" class="space-y-3 border-b p-4">
          <div class="grid gap-3 md:grid-cols-3">
            <div class="space-y-1.5">
              <Label class="text-xs">用户名</Label>
              <Input v-model="newUsername" placeholder="字母/数字/下划线" />
            </div>
            <div class="space-y-1.5">
              <Label class="text-xs">初始密码（至少 6 位）</Label>
              <Input v-model="newPassword" type="password" placeholder="••••••" />
            </div>
            <div v-if="isAdmin()" class="space-y-1.5">
              <Label class="text-xs">角色</Label>
              <select
                v-model="newRole"
                class="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="user">普通用户</option>
                <option value="sub_admin">副管理员</option>
                <option value="admin">管理员</option>
              </select>
            </div>
          </div>
          <div class="flex gap-2">
            <Button size="sm" :disabled="busy" @click="addUser">
              <Check class="h-3.5 w-3.5" /> 创建
            </Button>
            <Button size="sm" variant="ghost" @click="showAddUser = false">取消</Button>
          </div>
        </div>

        <div class="divide-y">
          <div v-for="u in users" :key="u.id" class="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 text-sm">
            <div class="flex items-center gap-2">
              <span class="font-medium">{{ u.username }}</span>
              <Badge v-if="u.role === 'admin'" variant="secondary">管理员</Badge>
              <Badge v-else-if="u.role === 'sub_admin'" class="bg-amber-500/15 text-amber-600 dark:text-amber-400">副管理员</Badge>
              <span class="text-xs text-muted-foreground">创建于 {{ fmtTime(u.created_at) }}</span>
            </div>
            <div class="flex items-center gap-1.5">
              <!-- admin 可任免副管理员/管理员 -->
              <select
                v-if="isAdmin() && u.username !== user?.username"
                :value="u.role"
                class="h-8 rounded-md border border-input bg-transparent px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                :disabled="busy"
                @change="changeRole(u.id, ($event.target as HTMLSelectElement).value)"
              >
                <option value="user">普通用户</option>
                <option value="sub_admin">设为副管理员</option>
                <option value="admin">设为管理员</option>
              </select>
              <Button
                v-if="u.username !== user?.username && (isAdmin() || u.role === 'user')"
                variant="ghost" size="icon" class="h-8 w-8 text-muted-foreground hover:text-destructive"
                title="删除用户" :disabled="busy"
                @click="deleteUser(u.id, u.username)"
              >
                <Trash2 class="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        <p v-if="!isAdmin()" class="border-t px-4 py-3 text-xs text-muted-foreground">
          副管理员只能管理普通用户；创建用户固定为普通用户，无权限任命管理角色。
        </p>
      </section>
    </div>
  </div>
</template>
