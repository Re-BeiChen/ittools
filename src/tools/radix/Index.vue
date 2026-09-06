<script setup lang="ts">
import { computed, ref } from 'vue'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import ToolLayout from '@/components/ToolLayout.vue'

const bases = [
  { base: 2, label: '二进制 (BIN)' },
  { base: 8, label: '八进制 (OCT)' },
  { base: 10, label: '十进制 (DEC)' },
  { base: 16, label: '十六进制 (HEX)' },
]

const activeBase = ref(10)
const inputValue = ref('255')

const error = computed(() => {
  const s = inputValue.value.trim()
  if (!s) return ''
  const chars = '0123456789abcdefghijklmnopqrstuvwxyz'.slice(0, activeBase.value)
  if (![...s.toLowerCase()].every(c => chars.includes(c))) {
    return `不是合法的 ${activeBase} 进制数`
  }
  return ''
})

const decimal = computed(() => {
  if (!inputValue.value.trim() || error.value) return null
  const n = parseInt(inputValue.value, activeBase.value)
  return Number.isNaN(n) ? null : n
})

function fmt(n: bigint | number, base: number): string {
  const b = BigInt(n)
  if (b === 0n) return '0'
  const digits = '0123456789abcdefghijklmnopqrstuvwxyz'
  let s = ''
  let v = b
  const bigBase = BigInt(base)
  while (v > 0n) {
    s = digits[Number(v % bigBase)] + s
    v /= bigBase
  }
  return s.toUpperCase()
}
</script>

<template>
  <ToolLayout>
    <div class="space-y-4">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="b in bases"
          :key="b.base"
          class="rounded-md px-3 py-1.5 text-sm transition-colors"
          :class="activeBase === b.base ? 'bg-primary text-primary-foreground' : 'border bg-card hover:bg-accent'"
          @click="activeBase = b.base"
        >
          {{ b.label }}
        </button>
      </div>

      <div>
        <Label class="mb-1.5 block text-xs text-muted-foreground">输入（{{ activeBase }} 进制）</Label>
        <Input
          v-model="inputValue"
          :placeholder="`如 ${activeBase === 16 ? 'ff' : activeBase === 2 ? '11111111' : '255'}`"
          class="font-mono"
          :class="error && 'border-destructive'"
        />
        <p v-if="error" class="mt-1 text-xs text-destructive">{{ error }}</p>
      </div>

      <div class="space-y-2">
        <div
          v-for="b in bases.filter(x => x.base !== activeBase)"
          :key="b.base"
          class="flex items-center justify-between rounded-xl border bg-card px-4 py-3 shadow-sm"
        >
          <span class="text-xs text-muted-foreground">{{ b.label }}</span>
          <span class="break-all font-mono text-sm">{{ decimal !== null ? fmt(decimal, b.base) : '—' }}</span>
        </div>
      </div>
    </div>
  </ToolLayout>
</template>
