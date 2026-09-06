<script setup lang="ts">
import { ref } from 'vue'
import { Check, Copy, RefreshCw } from '@lucide/vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import ToolLayout from '@/components/ToolLayout.vue'
import { copyText } from '@/lib/utils'

const count = ref<[number]>([5])
const uuids = ref<string[]>([])
const copiedIdx = ref(-1)

function uuidV4(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

function generate() {
  uuids.value = Array.from({ length: count.value[0] }, uuidV4)
}

async function copyOne(i: number) {
  if (await copyText(uuids.value[i])) {
    copiedIdx.value = i
    setTimeout(() => (copiedIdx.value = -1), 1500)
  }
}

generate()
</script>

<template>
  <ToolLayout>
    <div class="space-y-4">
      <div class="flex flex-wrap items-center gap-4">
        <div class="flex items-center gap-3">
          <Label class="whitespace-nowrap text-sm">数量</Label>
          <Slider v-model="count" class="w-40" :min="1" :max="50" :step="1" />
          <Badge variant="secondary" class="font-mono">{{ count[0] }}</Badge>
        </div>
        <Button @click="generate">
          <RefreshCw /> 重新生成
        </Button>
      </div>

      <div class="space-y-1.5">
        <div
          v-for="(u, i) in uuids"
          :key="u"
          class="group flex items-center justify-between gap-2 rounded-md border bg-card px-3 py-2 font-mono text-xs"
        >
          <span>{{ u }}</span>
          <Button size="icon" variant="ghost" class="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100" @click="copyOne(i)">
            <Check v-if="copiedIdx === i" />
            <Copy v-else />
          </Button>
        </div>
      </div>
    </div>
  </ToolLayout>
</template>
