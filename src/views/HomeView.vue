<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Search, Server, Sparkles, Star, Wrench } from '@lucide/vue'
import { Input } from '@/components/ui/input'
import { categories, tools } from '@/data/tools'
import { useFavorite } from '@/composables/useFavorite'

const router = useRouter()
const search = ref('')
const { favorites } = useFavorite()

const totalTools = tools.length
const totalCats = categories.filter(c => c.id !== 'favorite').length
const backendTools = tools.filter(t => t.backend).length

const filteredTools = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return tools
  return tools.filter(
    t => t.name.toLowerCase().includes(q)
      || t.description.toLowerCase().includes(q)
      || t.slug.includes(q),
  )
})

const groups = computed(() =>
  categories
    .filter(c => c.id !== 'favorite')
    .map(c => ({ ...c, items: filteredTools.value.filter(t => t.category === c.id) }))
    .filter(g => g.items.length > 0),
)

// 精选：每分类取第一个工具 + 后端工具，凑成一个「快速开始」横条
const quickStart = computed(() => {
  const seen = new Set<string>()
  const picked: typeof tools = []
  for (const t of tools) {
    if (t.backend) { picked.push(t); seen.add(t.slug) }
  }
  for (const g of groups.value) {
    for (const t of g.items) {
      if (picked.length >= 8) break
      if (!seen.has(t.slug)) { picked.push(t); seen.add(t.slug) }
    }
  }
  return picked.slice(0, 8)
})

function go(slug: string) {
  router.push(`/tools/${slug}`)
}
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 pb-16 md:px-6">
    <!-- Hero -->
    <section class="relative mt-2 overflow-hidden rounded-3xl border bg-gradient-to-br from-amber-50 via-card to-orange-50 px-6 py-10 text-center sm:py-14 dark:from-amber-500/10 dark:via-transparent dark:to-orange-500/10 dark:border-white/10">
      <!-- 装饰光斑 -->
      <div class="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-amber-400/20 blur-3xl dark:bg-amber-500/20" />
      <div class="pointer-events-none absolute -bottom-20 right-0 h-64 w-64 rounded-full bg-orange-400/15 blur-3xl dark:bg-orange-500/15" />

      <div class="relative">
        <span class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-yellow-400 text-white shadow-lg shadow-amber-500/30">
          <Wrench class="h-7 w-7" stroke-width="2.2" />
        </span>
        <h1 class="mt-4 flex items-center justify-center gap-2 text-3xl font-bold tracking-tight sm:text-4xl">
          IT Tools
          <span class="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">开发者工具箱</span>
        </h1>
        <p class="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
          一个自部署、可随写随用的开发小工具集合。编解码、生成器、转换器与 Web 后端工具一应俱全，数据仅保存在你自己的设备上。
        </p>

        <!-- 统计 -->
        <div class="mx-auto mt-6 flex max-w-md items-center justify-center gap-6 divide-x divide-border text-center">
          <div class="px-4">
            <div class="text-2xl font-bold tabular-nums">{{ totalTools }}</div>
            <div class="mt-0.5 text-xs text-muted-foreground">个工具</div>
          </div>
          <div class="px-4">
            <div class="text-2xl font-bold tabular-nums">{{ totalCats }}</div>
            <div class="mt-0.5 text-xs text-muted-foreground">个分类</div>
          </div>
          <div class="px-4">
            <div class="text-2xl font-bold tabular-nums">{{ backendTools }}</div>
            <div class="mt-0.5 text-xs text-muted-foreground">个后端工具</div>
          </div>
        </div>

        <!-- 搜索 -->
        <div class="relative mx-auto mt-6 max-w-md">
          <Search class="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input v-model="search" placeholder="搜索工具，如 base64 / 时间戳 / 汇率..." class="h-11 rounded-xl pl-10 shadow-sm" />
        </div>
      </div>
    </section>

    <!-- 快速开始 -->
    <section class="mt-8">
      <h2 class="mb-3 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
        <Sparkles class="h-4 w-4" /> 快速开始
      </h2>
      <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
        <button
          v-for="tool in quickStart"
          :key="tool.slug"
          class="group flex items-center gap-3 rounded-2xl border bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
          @click="go(tool.slug)"
        >
          <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground">
            <component :is="tool.icon" class="h-5 w-5" />
          </span>
          <span class="min-w-0">
            <span class="flex items-center gap-1 text-sm font-medium">
              <span class="truncate">{{ tool.name }}</span>
              <Server v-if="tool.backend" class="h-3.5 w-3.5 shrink-0 text-primary" />
            </span>
            <span class="mt-0.5 block truncate text-xs text-muted-foreground">{{ tool.description }}</span>
          </span>
        </button>
      </div>
    </section>

    <!-- 收藏 -->
    <section v-if="favorites.length && !search.trim()" class="mt-8">
      <h2 class="mb-3 flex items-center gap-1.5 text-sm font-semibold text-muted-foreground">
        <Star class="h-4 w-4" /> 收藏
      </h2>
      <div class="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <button
          v-for="slug in favorites"
          :key="slug"
          class="group flex items-start gap-3 rounded-2xl border bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          @click="go(slug)"
        >
          <component
            :is="tools.find(t => t.slug === slug)?.icon"
            class="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
          />
          <div class="min-w-0">
            <div class="truncate text-sm font-medium">{{ tools.find(t => t.slug === slug)?.name }}</div>
            <div class="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
              {{ tools.find(t => t.slug === slug)?.description }}
            </div>
          </div>
        </button>
      </div>
    </section>

    <!-- 分类 -->
    <section v-for="group in groups" :key="group.id" class="mt-8">
      <h2 class="mb-3 text-sm font-semibold text-muted-foreground">{{ group.label }}</h2>
      <div class="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        <button
          v-for="tool in group.items"
          :key="tool.slug"
          class="group flex items-start gap-3 rounded-2xl border bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          @click="go(tool.slug)"
        >
          <span class="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
            <component :is="tool.icon" class="h-4 w-4" />
          </span>
          <div class="min-w-0">
            <div class="flex items-center gap-1 text-sm font-medium">
              <span class="truncate">{{ tool.name }}</span>
              <Server v-if="tool.backend" class="h-3.5 w-3.5 shrink-0 text-primary" />
            </div>
            <div class="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{{ tool.description }}</div>
          </div>
        </button>
      </div>
    </section>

    <p v-if="groups.length === 0" class="py-20 text-center text-sm text-muted-foreground">
      没有找到匹配的工具
    </p>

    <!-- 页脚说明 -->
    <footer class="mt-12 border-t pt-6 text-center text-xs text-muted-foreground">
      自部署 · 数据仅保存在本机 SQLite · 部分查询工具接入外部公开数据源（已在对应页标注）
    </footer>
  </div>
</template>