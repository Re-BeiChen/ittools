<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Check, Copy } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import ToolLayout from '@/components/ToolLayout.vue'
import { copyText } from '@/lib/utils'

const hex = ref('#3b82f6')
const r = ref(59)
const g = ref(130)
const b = ref(246)
const h = ref(217)
const s = ref(91)
const l = ref(60)
const copiedField = ref('')

const hexError = computed(() => /^#[0-9a-fA-F]{6}$/.test(hex.value) ? '' : '格式：#RRGGBB')

function hexToRgb(s: string) {
  const n = parseInt(s.slice(1), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function rgbToHsl(rV: number, gV: number, bV: number) {
  const rr = rV / 255, gg = gV / 255, bb = bV / 255
  const max = Math.max(rr, gg, bb), min = Math.min(rr, gg, bb)
  const lV = (max + min) / 2
  let hV = 0, sV = 0
  if (max !== min) {
    const d = max - min
    sV = lV > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === rr) hV = ((gg - bb) / d + (gg < bb ? 6 : 0)) / 6
    else if (max === gg) hV = ((bb - rr) / d + 2) / 6
    else hV = ((rr - gg) / d + 4) / 6
  }
  return { h: Math.round(hV * 360), s: Math.round(sV * 100), l: Math.round(lV * 100) }
}

function hslToRgb(hV: number, sV: number, lV: number) {
  const sn = sV / 100, ln = lV / 100
  const k = (n: number) => (n + hV / 30) % 12
  const a = sn * Math.min(ln, 1 - ln)
  const f = (n: number) => ln - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return {
    r: Math.round(f(0) * 255),
    g: Math.round(f(8) * 255),
    b: Math.round(f(4) * 255),
  }
}

function rgbToHex(rV: number, gV: number, bV: number) {
  return `#${[rV, gV, bV].map(v => v.toString(16).padStart(2, '0')).join('')}`
}

// hex 输入驱动
watch(hex, (v) => {
  if (/^#[0-9a-fA-F]{6}$/.test(v)) {
    const { r: rr, g: gg, b: bb } = hexToRgb(v)
    r.value = rr; g.value = gg; b.value = bb
    const hsl = rgbToHsl(rr, gg, bb)
    h.value = hsl.h; s.value = hsl.s; l.value = hsl.l
  }
})

// RGB 滑条驱动
watch([r, g, b], ([rr, gg, bb]) => {
  const newHex = rgbToHex(rr, gg, bb)
  if (newHex !== hex.value.toLowerCase()) {
    hex.value = newHex
    const hsl = rgbToHsl(rr, gg, bb)
    h.value = hsl.h; s.value = hsl.s; l.value = hsl.l
  }
})

// HSL 驱动
watch([h, s, l], ([hh, ss, ll]) => {
  const { r: rr, g: gg, b: bb } = hslToRgb(hh, ss, ll)
  const newHex = rgbToHex(rr, gg, bb)
  if (newHex !== hex.value.toLowerCase()) {
    hex.value = newHex
    if (rr !== r.value) r.value = rr
    if (gg !== g.value) g.value = gg
    if (bb !== b.value) b.value = bb
  }
})

const outputs = computed(() => [
  { label: 'HEX', value: hex.value },
  { label: 'RGB', value: `rgb(${r.value}, ${g.value}, ${b.value})` },
  { label: 'HSL', value: `hsl(${h.value}, ${s.value}%, ${l.value}%)` },
])

async function copyOne(label: string, value: string) {
  if (await copyText(value)) {
    copiedField.value = label
    setTimeout(() => (copiedField.value = ''), 1500)
  }
}
</script>

<template>
  <ToolLayout>
    <div class="grid gap-6 md:grid-cols-2">
      <div class="space-y-5">
        <div
          class="flex h-32 items-center justify-center rounded-xl border shadow-inner"
          :style="{ backgroundColor: hexError ? '#8884' : hex }"
        >
          <span class="rounded-full bg-black/40 px-4 py-1 font-mono text-sm text-white backdrop-blur">
            {{ hexError ? '无效颜色' : hex }}
          </span>
        </div>

        <div>
          <Label class="mb-1.5 block text-xs text-muted-foreground">HEX</Label>
          <div class="flex gap-2">
            <Input v-model="hex" class="font-mono" :class="hexError && 'border-destructive'" />
            <input
              type="color"
              :value="hexError ? '#000000' : hex"
              class="h-9 w-12 cursor-pointer rounded-md border"
              @input="hex = ($event.target as HTMLInputElement).value"
            >
          </div>
          <p v-if="hexError" class="mt-1 text-xs text-destructive">{{ hexError }}</p>
        </div>

        <div>
          <Label class="mb-2 block text-xs text-muted-foreground">RGB</Label>
          <div v-for="(ch, i) in ['R', 'G', 'B']" :key="ch" class="mb-2 flex items-center gap-3">
            <span class="w-4 font-mono text-xs">{{ ch }}</span>
            <Slider
              :model-value="[([r, g, b] as const)[i]]"
              class="flex-1"
              :min="0"
              :max="255"
              :step="1"
              @update:model-value="(v?: number[]) => { const nv = v ?? [0]; if (i === 0) r = nv[0]; else if (i === 1) g = nv[0]; else b = nv[0] }"
            />
            <span class="w-8 font-mono text-xs">{{ ([r, g, b] as const)[i] }}</span>
          </div>
        </div>
      </div>

      <div class="space-y-4">
        <div v-for="o in outputs" :key="o.label" class="flex items-center justify-between rounded-xl border bg-card p-3 shadow-sm">
          <div>
            <div class="text-xs text-muted-foreground">{{ o.label }}</div>
            <div class="font-mono text-sm">{{ o.value }}</div>
          </div>
          <Button size="sm" variant="outline" @click="copyOne(o.label, o.value)">
            <Check v-if="copiedField === o.label" />
            <Copy v-else />
          </Button>
        </div>

        <div>
          <div class="mb-2 text-xs text-muted-foreground">明暗色阶</div>
          <div class="grid grid-cols-11 gap-0.5 overflow-hidden rounded-md border">
            <div
              v-for="i in 11"
              :key="i"
              class="h-10 cursor-pointer transition-transform hover:scale-105"
              :style="{ backgroundColor: rgbToHex(...(() => {
                const { r: rr, g: gg, b: bb } = hslToRgb(h, s, 95 - (i - 1) * 9)
                return [rr, gg, bb] as const
              })()) }"
              :title="`L ${95 - (i - 1) * 9}%`"
              @click="l = 95 - (i - 1) * 9"
            />
          </div>
        </div>
      </div>
    </div>
  </ToolLayout>
</template>
