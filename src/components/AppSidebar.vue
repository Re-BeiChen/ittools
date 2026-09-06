<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ArrowLeft, LogIn, LogOut, Search, X } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { categories, tools } from '@/data/tools'
import { useSidebar } from '@/composables/useSidebar'
import { useAuth } from '@/composables/useAuth'

const route = useRoute()
const router = useRouter()
const search = ref('')
const { open, close } = useSidebar()
const { user, logout } = useAuth()

const activeSlug = computed(() => route.params.slug as string)

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return tools
  return tools.filter(t => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q))
})

function go(slug: string) {
  search.value = ''
  router.push(`/tools/${slug}`)
  close()
}

function goHome() {
  close()
}

async function doLogout() {
  close()
  await logout()
  router.push('/login')
}
</script>

<template>
  <!-- 移动端：抽屉；桌面端：固定侧栏 -->
  <aside
    class="fixed inset-y-0 left-0 z-50 flex h-full w-64 shrink-0 flex-col border-r bg-card transition-transform duration-200 md:static md:translate-x-0"
    :class="open ? 'translate-x-0' : '-translate-x-full'"
  >
    <RouterLink to="/" class="flex items-center gap-2 px-4 py-4 font-semibold" @click="goHome">
      <span class="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-sm text-primary-foreground">
        IT
      </span>
      IT Tools
      <Button variant="ghost" size="icon" class="ml-auto h-7 w-7 md:hidden" aria-label="关闭菜单" @click.prevent="close">
        <X />
      </Button>
    </RouterLink>

    <div class="px-3 pb-2">
      <div class="relative">
        <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input v-model="search" placeholder="搜索工具..." class="h-8 pl-8 text-xs" />
      </div>
    </div>

    <nav class="sidebar-scroll flex-1 overflow-y-auto overscroll-contain px-2 pb-4">
      <RouterLink
        to="/"
        class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        :class="route.path === '/' && 'bg-accent text-accent-foreground'"
        @click="goHome"
      >
        <ArrowLeft class="h-4 w-4" /> 全部工具
      </RouterLink>

      <template v-if="search.trim()">
        <button
          v-for="t in filtered"
          :key="t.slug"
          class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          :class="activeSlug === t.slug && 'bg-accent text-accent-foreground'"
          @click="go(t.slug)"
        >
          <component :is="t.icon" class="h-4 w-4" /> {{ t.name }}
        </button>
      </template>

      <template v-else>
        <div v-for="cat in categories.filter(c => c.id !== 'favorite')" :key="cat.id" class="mt-2">
          <div class="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/60">
            {{ cat.label }}
          </div>
          <button
            v-for="t in tools.filter(x => x.category === cat.id)"
            :key="t.slug"
            class="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            :class="activeSlug === t.slug && 'bg-accent text-accent-foreground'"
            @click="go(t.slug)"
          >
            <component :is="t.icon" class="h-4 w-4" /> {{ t.name }}
          </button>
        </div>
      </template>
    </nav>

    <!-- 登录状态 -->
    <div class="border-t px-3 py-3">
      <div v-if="user" class="flex items-center gap-2 rounded-md bg-muted/60 p-1.5">
        <RouterLink
          to="/account"
          class="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-sm transition-colors hover:bg-accent"
          :class="route.path === '/account' ? 'text-accent-foreground' : 'text-foreground'"
          title="账户与登录设备"
          @click="close"
        >
          <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-[10px] font-bold text-white">
            {{ user.username[0].toUpperCase() }}
          </span>
          <span class="truncate text-xs font-medium">{{ user.username }}</span>
        </RouterLink>
        <Button variant="ghost" size="icon" class="h-7 w-7 shrink-0" aria-label="退出登录" @click="doLogout">
          <LogOut class="h-4 w-4" />
        </Button>
      </div>
      <RouterLink
        v-else
        to="/login"
        class="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        @click="close"
      >
        <LogIn class="h-4 w-4" /> 登录
      </RouterLink>
    </div>
  </aside>
</template>

<style scoped>
/* 侧栏滚动条：细窄、半透明、随深浅主题变色，而非浏览器默认样式 */
.sidebar-scroll {
  scrollbar-width: thin;
  scrollbar-color: var(--border) transparent;
}
.sidebar-scroll::-webkit-scrollbar {
  width: 6px;
}
.sidebar-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.sidebar-scroll::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 9999px;
}
.sidebar-scroll::-webkit-scrollbar-thumb:hover {
  background: var(--muted-foreground);
}
</style>
