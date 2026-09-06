<script setup lang="ts">
import { TabsContent, type TabsContentProps } from 'reka-ui'
import type { HTMLAttributes } from 'vue'
import { cn } from '@/lib/utils'

const props = defineProps<TabsContentProps & { class?: HTMLAttributes['class'] }>()
</script>

<template>
  <TabsContent
    v-bind="props"
    :class="cn(
      'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
      props.class,
    )"
  >
    <slot />
  </TabsContent>
</template>
