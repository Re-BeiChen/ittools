<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { Check, Copy } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import ToolLayout from '@/components/ToolLayout.vue'
import { copyText } from '@/lib/utils'

const now = ref(new Date())
let timer: ReturnType<typeof setInterval>

onMounted(() => {
  timer = setInterval(() => (now.value = new Date()), 1000)
})
onUnmounted(() => clearInterval(timer))

// 时间戳 → 日期
const tsInput = ref('')
const tsUnit = ref<'auto' | 's' | 'ms'>('auto')
const tsError = ref('')

const tsResult = computed(() => {
  const raw = tsInput.value.trim()
  if (!raw) return null
  if (!/^\d+$/.test(raw)) {
    tsError.value = '请输入纯数字时间戳'
    return null
  }
  tsError.value = ''
  const num = Number(raw)
  let ms: number
  if (tsUnit.value === 's') ms = num * 1000
  else if (tsUnit.value === 'ms') ms = num
  else ms = raw.length <= 11 ? num * 1000 : num // auto：10 位按秒

  const d = new Date(ms)
  if (Number.isNaN(d.getTime())) {
    tsError.value = '时间戳超出范围'
    return null
  }
  return {
    local: d.toLocaleString('zh-CN', { hour12: false }),
    utc: d.toISOString(),
    unix_s: Math.floor(ms / 1000),
    unix_ms: ms,
  }
})

// 日期 → 时间戳
const dateInput = ref('')
const dateError = ref('')

const dateResult = computed(() => {
  const raw = dateInput.value.trim()
  if (!raw) return null
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) {
    dateError.value = '日期格式无效（试试 2026-09-03 12:00:00）'
    return null
  }
  dateError.value = ''
  return {
    unix_s: Math.floor(d.getTime() / 1000),
    unix_ms: d.getTime(),
    iso: d.toISOString(),
  }
})

async function copyVal(v: string | number) {
  await copyText(String(v))
}
</script>

<template>
  <ToolLayout>
    <div class="space-y-6">
      <!-- 实时时间 -->
      <div class="rounded-xl border bg-card p-4 shadow-sm">
        <div class="text-xs text-muted-foreground">当前时间</div>
        <div class="mt-1 font-mono text-2xl font-bold">{{ now.toLocaleString('zh-CN', { hour12: false }) }}</div>
        <div class="mt-2 flex gap-4 font-mono text-xs text-muted-foreground">
          <span>秒: {{ Math.floor(now.getTime() / 1000) }}</span>
          <span>毫秒: {{ now.getTime() }}</span>
        </div>
      </div>

      <Tabs default-value="ts2date">
        <TabsList>
          <TabsTrigger value="ts2date">时间戳 → 日期</TabsTrigger>
          <TabsTrigger value="date2ts">日期 → 时间戳</TabsTrigger>
        </TabsList>

        <TabsContent value="ts2date" class="space-y-3">
          <div class="flex gap-2">
            <Input v-model="tsInput" placeholder="输入时间戳，如 1788438537" class="font-mono" @input="tsError = ''" />
            <select
              v-model="tsUnit"
              class="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="auto">自动</option>
              <option value="s">秒</option>
              <option value="ms">毫秒</option>
            </select>
          </div>
          <p v-if="tsError" class="text-xs text-destructive">{{ tsError }}</p>
          <div v-if="tsResult" class="space-y-2 rounded-md border bg-muted/50 p-3 font-mono text-sm">
            <div v-for="(v, k) in tsResult" :key="k" class="flex items-center justify-between gap-2">
              <span class="text-xs text-muted-foreground">{{ { local: '本地时间', utc: 'UTC', unix_s: 'Unix 秒', unix_ms: 'Unix 毫秒' }[k] }}</span>
              <span class="flex items-center gap-1">
                {{ v }}
                <Button size="icon" variant="ghost" class="h-6 w-6" @click="copyVal(v)">
                  <Check v-if="false" />
                  <Copy v-else />
                </Button>
              </span>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="date2ts" class="space-y-3">
          <div>
            <Label class="mb-1.5 block text-xs text-muted-foreground">日期（支持 2026-09-03、2026-09-03 12:00:00 等）</Label>
            <Input v-model="dateInput" placeholder="2026-09-03 12:00:00" class="font-mono" />
          </div>
          <p v-if="dateError" class="text-xs text-destructive">{{ dateError }}</p>
          <div v-if="dateResult" class="space-y-2 rounded-md border bg-muted/50 p-3 font-mono text-sm">
            <div v-for="(v, k) in dateResult" :key="k" class="flex items-center justify-between gap-2">
              <span class="text-xs text-muted-foreground">{{ { unix_s: 'Unix 秒', unix_ms: 'Unix 毫秒', iso: 'ISO 8601' }[k] }}</span>
              <span class="flex items-center gap-1">
                {{ v }}
                <Button size="icon" variant="ghost" class="h-6 w-6" @click="copyVal(v)">
                  <Check v-if="false" />
                  <Copy v-else />
                </Button>
              </span>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  </ToolLayout>
</template>
