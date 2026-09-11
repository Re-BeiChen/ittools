<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight, Clock3, Command, Lock, Search, Star, X } from '@lucide/vue'
import { Input } from '@/components/ui/input'
import { categories, tools } from '@/data/tools'
import { useFavorite } from '@/composables/useFavorite'

const router = useRouter()
const search = ref('')
const searchInput = ref<{ $el: HTMLElement } | null>(null)
const { favorites } = useFavorite()
const mounted = ref(false)
const isMobile = ref(false)

function updateIsMobile() {
  isMobile.value = window.matchMedia('(max-width: 639px)').matches
}

onMounted(() => {
  updateIsMobile()
  window.addEventListener('resize', updateIsMobile)
  requestAnimationFrame(() => (mounted.value = true))
})

onUnmounted(() => {
  window.removeEventListener('resize', updateIsMobile)
})

const totalTools = tools.length
const totalCats = categories.filter(c => c.id !== 'favorite').length

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

const favoriteTools = computed(() =>
  favorites.value
    .map(slug => tools.find(t => t.slug === slug))
    .filter((t): t is NonNullable<typeof t> => !!t),
)

function go(slug: string) {
  router.push(`/tools/${slug}`)
}

// ── 键盘导航：/ 聚焦搜索，Esc 清空 ─────────────────────────
function onKeydown(e: KeyboardEvent) {
  if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
    e.preventDefault()
    searchInput.value?.$el?.querySelector('input')?.focus()
  } else if (e.key === 'Escape' && search.value) {
    search.value = ''
  }
}
</script>

<template>
  <div class="home-page mx-auto max-w-6xl px-4 pb-20 md:px-6">
    <!-- ═══════ Hero ═══════ -->
    <header class="hero pt-10 sm:pt-14" :class="mounted && 'is-in'">
      <div class="hero-eyebrow">
        <span class="dot" />
        SELF-HOSTED · {{ totalCats }} CATEGORIES · {{ totalTools }} TOOLS
      </div>
      <h1 class="hero-title">
        开发者的<em>瑞士军刀</em>
      </h1>
      <p class="hero-sub">
        自部署的开发小工具集合 —— 编解码、生成、转换、网络诊断，一站直达。
        <span class="whitespace-nowrap">数据只存在你自己的设备上。</span>
      </p>

      <!-- 搜索 -->
      <div class="hero-search">
        <div class="relative">
          <Search class="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref="searchInput"
            v-model="search"
            :placeholder="isMobile ? '搜索工具…' : '搜索工具… 试试 base64 / 时间戳 / 汇率'"
            class="h-12 rounded-xl border-border/70 bg-card pl-11 pr-24 text-base shadow-lg shadow-black/[0.04] dark:shadow-black/20"
            @keydown="onKeydown"
          />
          <kbd class="pointer-events-none absolute right-3.5 top-1/2 hidden -translate-y-1/2 items-center gap-1 rounded-md border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium text-muted-foreground sm:flex">
            <Command class="h-3 w-3" />K
          </kbd>
        </div>
        <p v-if="search" class="mt-2.5 pl-1 text-xs text-muted-foreground">
          找到 <b class="text-foreground tabular-nums">{{ filteredTools.length }}</b> 个匹配「{{ search }}」的工具
        </p>
      </div>
    </header>

    <!-- ═══════ 收藏 ═══════ -->
    <section v-if="favoriteTools.length && !search.trim()" class="tool-section" :class="mounted && 'is-in'" style="--d: 1">
      <div class="section-head">
        <h2 class="section-title"><Star class="h-4 w-4" /> 我的收藏</h2>
      </div>
      <div class="tool-grid">
        <button v-for="t in favoriteTools" :key="t.slug" class="tool-card" @click="go(t.slug)">
          <span class="tool-icon">
            <component :is="t.icon" class="h-4.5 w-4.5" />
          </span>
          <span class="tool-body">
            <span class="tool-name">
              <span class="truncate">{{ t.name }}</span>
              <span v-if="t.backend" class="lock-badge"><Lock class="h-2.5 w-2.5" />需登录</span>
            </span>
            <span class="tool-desc">{{ t.description }}</span>
          </span>
        </button>
      </div>
    </section>

    <!-- ═══════ 分类工具 ═══════ -->
    <section v-for="(group, gi) in groups" :key="group.id" class="tool-section" :class="mounted && 'is-in'" :style="{ '--d': gi + (favoriteTools.length && !search.trim() ? 2 : 1) }">
      <div class="section-head">
        <h2 class="section-title">
          <span class="section-no">{{ String(gi + 1).padStart(2, '0') }}</span>
          {{ group.label }}
          <span class="section-count tabular-nums">{{ group.items.length }}</span>
        </h2>
      </div>
      <div class="tool-grid">
        <button v-for="t in group.items" :key="t.slug" class="tool-card" @click="go(t.slug)">
          <span class="tool-icon">
            <component :is="t.icon" class="h-4.5 w-4.5" />
          </span>
          <span class="tool-body">
            <span class="tool-name">
              <span class="truncate">{{ t.name }}</span>
              <span v-if="t.backend" class="lock-badge" title="该工具需要登录后使用"><Lock class="h-2.5 w-2.5" />需登录</span>
            </span>
            <span class="tool-desc">{{ t.description }}</span>
          </span>
          <ArrowRight class="tool-arrow h-4 w-4" />
        </button>
      </div>
    </section>

    <!-- 无结果 -->
    <div v-if="!groups.length" class="flex flex-col items-center gap-3 py-24 text-center">
      <p class="text-sm text-muted-foreground">没有找到匹配「{{ search }}」的工具</p>
      <button class="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline" @click="search = ''">
        <X class="h-3.5 w-3.5" />清空搜索
      </button>
    </div>

    <!-- ═══════ 页脚 ═══════ -->
    <footer class="mt-16 border-t pt-6">
      <p class="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center font-mono text-[11px] tracking-wide text-muted-foreground/70">
        <span class="inline-flex items-center gap-1"><Clock3 class="h-3 w-3" />自部署</span>
        <span>·</span>
        <span>数据仅存于本机 SQLite</span>
        <span>·</span>
        <span>部分查询接入外部公开数据源（已在对应页标注）</span>
      </p>
    </footer>
  </div>
</template>

<style scoped>
/* ── Hero ─────────────────────────────────────────────── */
.hero {
  max-width: 720px;
  margin: 0 auto;
  text-align: center;
}
.hero-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.14em;
  color: var(--muted-foreground);
}
.hero-eyebrow .dot {
  width: 6px;
  height: 6px;
  border-radius: 9999px;
  background: oklch(0.72 0.17 155);
  box-shadow: 0 0 0 3px oklch(0.72 0.17 155 / 0.18);
}
.hero-title {
  margin-top: 1rem;
  font-size: clamp(2rem, 5vw, 3.25rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.12;
}
.hero-title em {
  font-style: normal;
  position: relative;
  color: var(--primary);
  /* 下划手绘感：底部实线 + 轻微偏移 */
  text-decoration: underline;
  text-decoration-thickness: 3px;
  text-underline-offset: 6px;
  text-decoration-color: var(--primary);
}
:root.dark .hero-title em { color: var(--primary); }
.hero-sub {
  margin: 1.25rem auto 0;
  max-width: 34rem;
  color: var(--muted-foreground);
  font-size: 0.95rem;
  line-height: 1.7;
}
.hero-search { margin-top: 2rem; }

/* ── 分节 ─────────────────────────────────────────────── */
.tool-section { margin-top: 2.75rem; }
.section-head {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  margin-bottom: 0.875rem;
}
.section-title {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--foreground);
}
.section-no {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 11px;
  font-weight: 600;
  color: var(--muted-foreground);
  opacity: 0.7;
  padding-top: 2px;
}
.section-count {
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 11px;
  color: var(--muted-foreground);
  background: var(--muted);
  border-radius: 9999px;
  padding: 1px 8px;
}

/* ── 工具网格与卡片 ───────────────────────────────────── */
.tool-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.75rem;
}
@media (min-width: 640px) {
  .tool-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (min-width: 768px) {
  .tool-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}

.tool-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.875rem;
  width: 100%;
  padding: 0.875rem 1rem;
  text-align: left;
  border-radius: 0.875rem;
  border: 1px solid var(--border);
  background: var(--card);
  transition: border-color 0.18s ease, transform 0.18s ease, box-shadow 0.18s ease;
  cursor: pointer;
}
.tool-card:hover {
  border-color: var(--primary);
  transform: translateY(-2px);
  box-shadow: 0 8px 24px -8px oklch(0 0 0 / 0.14);
}
:root.dark .tool-card:hover {
  box-shadow: 0 8px 24px -8px oklch(0 0 0 / 0.5);
}

.tool-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2.5rem;
  height: 2.5rem;
  flex-shrink: 0;
  border-radius: 0.625rem;
  background: var(--muted);
  color: var(--muted-foreground);
  transition: background 0.18s ease, color 0.18s ease;
}
.tool-card:hover .tool-icon {
  background: var(--primary);
  color: var(--primary-foreground);
}

.tool-body {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}
.tool-name {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--foreground);
  min-width: 0;
}
.tool-name > span:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tool-desc {
  font-size: 0.75rem;
  line-height: 1.4;
  color: var(--muted-foreground);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
}
.tool-arrow {
  flex-shrink: 0;
  opacity: 0;
  transform: translateX(-4px);
  transition: opacity 0.18s ease, transform 0.18s ease;
  color: var(--muted-foreground);
}
.tool-card:hover .tool-arrow {
  opacity: 1;
  transform: translateX(0);
}

.lock-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.1875rem;
  flex-shrink: 0;
  padding: 1px 5px;
  border-radius: 5px;
  font-size: 10px;
  font-weight: 500;
  color: oklch(0.7 0.14 70);
  background: oklch(0.7 0.14 70 / 0.14);
}
:root.dark .lock-badge {
  color: oklch(0.78 0.14 75);
}

/* ── 入场动画：交错淡入上移 ───────────────────────────── */
.hero,
.tool-section {
  opacity: 0;
  transform: translateY(14px);
  transition: opacity 0.5s cubic-bezier(0.22, 1, 0.36, 1), transform 0.5s cubic-bezier(0.22, 1, 0.36, 1);
}
.is-in.hero,
.is-in.tool-section {
  opacity: 1;
  transform: none;
}
.is-in.tool-section { transition-delay: calc(var(--d, 0) * 60ms); }

/* 减少动效偏好 */
@media (prefers-reduced-motion: reduce) {
  .hero, .tool-section { transition: none; opacity: 1; transform: none; }
  .tool-card, .tool-icon, .tool-arrow { transition: none; }
}
</style>
