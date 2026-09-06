<script setup lang="ts">
import { TooltipRoot, type TooltipRootEmits, type TooltipRootProps } from 'reka-ui'

const props = defineProps<TooltipRootProps>()
const emits = defineEmits<TooltipRootEmits>()
</script>

<template>
  <TooltipRoot
    v-bind="props"
    @update:open="emits('update:open', $event)"
  >
    <slot />
  </TooltipRoot>
</template>
