<script setup lang="ts">
import { computed } from 'vue'
import { Moon, Sun } from '@lucide/vue'
import { useRoute } from 'vue-router'
import { Button } from '@/components/ui/button'
import AppSidebar from '@/components/AppSidebar.vue'
import { useTheme } from '@/composables/useTheme'
import { useSidebar } from '@/composables/useSidebar'

const route = useRoute()
const { isDark, toggle } = useTheme()
const { open, close } = useSidebar()

// 登录页等全屏页面（meta.bare）不渲染侧栏外壳
const bare = computed(() => !!route.meta.bare)
</script>

<template>
  <RouterView v-if="bare" />

  <div v-else class="flex h-screen overflow-hidden bg-background dark:bg-transparent">
    <!-- 移动端遮罩 -->
    <Transition name="fade">
      <div
        v-if="open"
        class="fixed inset-0 z-40 bg-black/50 md:hidden"
        @click="close()"
      />
    </Transition>

    <AppSidebar />

    <main class="flex-1 overflow-y-auto">
      <!-- 移动端顶栏 -->
      <div class="flex items-center justify-between px-4 pt-3 md:hidden">
        <Button variant="ghost" size="icon" aria-label="打开菜单" @click="open = true">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </Button>
        <span class="text-sm font-semibold">IT Tools</span>
        <Button variant="ghost" size="icon" aria-label="切换主题" @click="toggle">
          <Sun v-if="isDark" />
          <Moon v-else />
        </Button>
      </div>
      <!-- 桌面端主题切换 -->
      <div class="hidden justify-end px-6 pt-4 md:flex">
        <Button variant="ghost" size="icon" @click="toggle">
          <Sun v-if="isDark" />
          <Moon v-else />
        </Button>
      </div>

      <RouterView v-slot="{ Component }">
        <Transition name="fade" mode="out-in">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>
  </div>
</template>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
