import { createRouter, createWebHistory } from 'vue-router'
import { getTool } from '@/data/tools'
import { useAuth } from '@/composables/useAuth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/views/HomeView.vue'),
    },
    {
      path: '/tools/:slug',
      name: 'tool',
      component: () => import('@/views/ToolView.vue'),
    },
    {
      path: '/p/:code',
      name: 'paste-view',
      component: () => import('@/views/PasteView.vue'),
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { bare: true },
    },
    {
      path: '/account',
      name: 'account',
      component: () => import('@/views/AccountView.vue'),
    },
  ],
})

const { user } = useAuth()

router.beforeEach(async (to) => {
  // 等待启动时的登录态探测完成，避免刷新后误判
  const { ready } = useAuth()
  await ready

  // 已登录访问登录页 → 回首页（或回跳 next）
  if (to.name === 'login' && user.value) {
    const next = to.query.next
    return typeof next === 'string' && next.startsWith('/') ? next : '/'
  }

  // 需要后端的工具：未登录 → 跳登录页并记录来源
  if (to.name === 'tool') {
    const tool = getTool(String(to.params.slug))
    if (tool?.backend && !user.value) {
      return { name: 'login', query: { next: to.fullPath } }
    }
  }

  if (to.name === 'account' && !user.value) {
    return { name: 'login', query: { next: to.fullPath } }
  }
})

export default router
