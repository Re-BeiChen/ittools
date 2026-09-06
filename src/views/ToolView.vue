<script setup lang="ts">
import { computed, defineAsyncComponent, shallowRef, watch } from 'vue'
import { useRoute } from 'vue-router'
import { getTool } from '@/data/tools'

const route = useRoute()
const slug = computed(() => route.params.slug as string)
const tool = computed(() => getTool(slug.value))

// 每个工具组件位于 src/tools/<slug>/Index.vue
const modules = import.meta.glob('@/tools/*/Index.vue') as Record<string, () => Promise<unknown>>

const current = shallowRef<unknown>(null)

watch(
  () => slug.value,
  (s) => {
    const loader = modules[`/src/tools/${s}/Index.vue`]
    current.value = loader ? defineAsyncComponent(loader as never) : null
  },
  { immediate: true },
)
</script>

<template>
  <div v-if="!tool" class="flex h-64 items-center justify-center text-muted-foreground">
    工具不存在
  </div>
  <component :is="current" v-else-if="current" />
  <div v-else class="flex h-64 items-center justify-center text-muted-foreground">
    加载中...
  </div>
</template>
