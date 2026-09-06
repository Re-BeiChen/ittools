<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check, Copy, RefreshCw } from '@lucide/vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import ToolLayout from '@/components/ToolLayout.vue'
import { copyText } from '@/lib/utils'

const length = ref<[number]>([16])
const useUpper = ref(true)
const useLower = ref(true)
const useDigits = ref(true)
const useSymbols = ref(false)
const password = ref('')
const copied = ref(false)

const pool = computed(() => {
  let s = ''
  if (useUpper.value) s += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  if (useLower.value) s += 'abcdefghijklmnopqrstuvwxyz'
  if (useDigits.value) s += '0123456789'
  if (useSymbols.value) s += '!@#$%^&*()-_=+[]{}<>?,.'
  return s
})

function generate() {
  const p = pool.value
  if (!p) {
    password.value = ''
    return
  }
  const bytes = crypto.getRandomValues(new Uint32Array(length.value[0]))
  password.value = [...bytes].map(b => p[b % p.length]).join('')
}

/** 简单强度评估 */
const strength = computed(() => {
  const poolSize = pool.value.length
  if (!poolSize || !password.value) return { label: '-', color: '' }
  const bits = Math.log2(poolSize) * password.value.length
  if (bits < 40) return { label: '弱', color: 'bg-red-500' }
  if (bits < 60) return { label: '中', color: 'bg-yellow-500' }
  if (bits < 90) return { label: '强', color: 'bg-green-500' }
  return { label: '极强', color: 'bg-emerald-600' }
})

const strengthPercent = computed(() => {
  const bits = Math.log2(pool.value.length || 2) * password.value.length
  return Math.min(100, Math.round((bits / 128) * 100))
})

async function copy() {
  if (await copyText(password.value)) {
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  }
}

generate()
</script>

<template>
  <ToolLayout>
    <div class="space-y-5">
      <div class="relative">
        <div class="rounded-xl border bg-card p-4 font-mono text-lg shadow-sm break-all">
          {{ password || '请至少选择一种字符集' }}
        </div>
        <div class="mt-3 flex items-center gap-3">
          <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div class="h-full rounded-full transition-all" :class="strength.color" :style="{ width: `${strengthPercent}%` }" />
          </div>
          <Badge variant="secondary">{{ strength.label }}</Badge>
          <Button v-if="password" size="sm" variant="outline" @click="copy">
            <Check v-if="copied" />
            <Copy v-else />
            复制
          </Button>
        </div>
      </div>

      <div class="space-y-4 rounded-xl border bg-card p-4 shadow-sm">
        <div class="flex items-center gap-4">
          <Label class="text-sm">长度</Label>
          <Slider v-model="length" class="flex-1" :min="6" :max="64" :step="1" @update:model-value="generate" />
          <span class="w-8 font-mono text-sm">{{ length[0] }}</span>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div class="flex items-center justify-between rounded-md border px-3 py-2">
            <Label for="upper" class="text-sm">大写 A-Z</Label>
            <Switch id="upper" v-model:checked="useUpper" @update:checked="generate" />
          </div>
          <div class="flex items-center justify-between rounded-md border px-3 py-2">
            <Label for="lower" class="text-sm">小写 a-z</Label>
            <Switch id="lower" v-model:checked="useLower" @update:checked="generate" />
          </div>
          <div class="flex items-center justify-between rounded-md border px-3 py-2">
            <Label for="digits" class="text-sm">数字 0-9</Label>
            <Switch id="digits" v-model:checked="useDigits" @update:checked="generate" />
          </div>
          <div class="flex items-center justify-between rounded-md border px-3 py-2">
            <Label for="symbols" class="text-sm">符号 !@#$</Label>
            <Switch id="symbols" v-model:checked="useSymbols" @update:checked="generate" />
          </div>
        </div>
        <Button class="w-full" @click="generate">
          <RefreshCw /> 重新生成
        </Button>
      </div>
    </div>
  </ToolLayout>
</template>
