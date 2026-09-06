<script setup lang="ts">
import { SelectValue, useForwardProps, type SelectValueProps } from 'reka-ui'

const props = defineProps<SelectValueProps>()
const forwardedProps = useForwardProps(props)
</script>

<template>
  <SelectValue v-bind="forwardedProps">
    <slot />
  </SelectValue>
</template>
