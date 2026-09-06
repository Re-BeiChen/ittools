<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Star } from '@lucide/vue'
import { getTool } from '@/data/tools'
import { useFavorite } from '@/composables/useFavorite'

const route = useRoute()
const slug = computed(() => route.params.slug as string)
const tool = computed(() => getTool(slug.value))
const { isFavorite, toggle } = useFavorite()
</script>

<template>
  <div v-if="tool" class="mx-auto max-w-4xl px-4 pb-16 pt-4 md:px-6">
    <div class="mb-6 flex items-start justify-between">
      <div class="flex items-start gap-3">
        <span class="flex h-10 w-10 items-center justify-center rounded-xl border bg-card shadow-sm">
          <component :is="tool.icon" class="h-5 w-5" />
        </span>
        <div>
          <h1 class="text-xl font-bold tracking-tight">{{ tool.name }}</h1>
          <p class="mt-0.5 text-sm text-muted-foreground">{{ tool.description }}</p>
        </div>
      </div>
      <button
        class="rounded-md p-2 transition-colors hover:bg-accent"
        :title="isFavorite(tool.slug) ? '取消收藏' : '收藏'"
        @click="toggle(tool.slug)"
      >
        <Star
          class="h-4 w-4"
          :class="isFavorite(tool.slug) ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'"
        />
      </button>
    </div>
    <slot />
  </div>
</template>
