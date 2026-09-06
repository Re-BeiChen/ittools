<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ArrowLeftRight, RefreshCw } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import ToolLayout from '@/components/ToolLayout.vue'

const commonCurrencies = ['CNY', 'USD', 'EUR', 'JPY', 'GBP', 'HKD', 'KRW', 'SGD', 'AUD', 'CAD', 'CHF', 'THB', 'RUB', 'TWD']

const from = ref('USD')
const to = ref('CNY')
const amount = ref('100')

const rate = ref<number | null>(null)
const rateDate = ref('')
const loading = ref(false)
const error = ref('')

async function fetchRate() {
  loading.value = true
  error.value = ''
  try {
    const res = await fetch(`/api/rates?from=${from.value}&to=${to.value}&amount=${Number(amount.value) || 1}`)
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? '获取失败')
    rate.value = data.rate
    rateDate.value = data.date
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
}

const converted = ref<number | null>(null)

async function convert() {
  await fetchRate()
  if (rate.value !== null) {
    converted.value = rate.value * (Number(amount.value) || 0)
  }
}

function swap() {
  ;[from.value, to.value] = [to.value, from.value]
  if (converted.value !== null) convert()
}

onMounted(convert)
</script>

<template>
  <ToolLayout>
    <div class="mx-auto max-w-md space-y-5">
      <div class="space-y-3 rounded-xl border bg-card p-5 shadow-sm">
        <div class="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div class="flex-1">
            <Label class="mb-1.5 block text-xs text-muted-foreground">金额</Label>
            <Input v-model="amount" inputmode="decimal" class="font-mono" @keyup.enter="convert" />
          </div>
          <div class="flex items-end gap-2 sm:w-auto">
            <div class="flex-1 sm:w-28">
              <Label class="mb-1.5 block text-xs text-muted-foreground">从</Label>
              <Select v-model="from" @update:model-value="convert">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="c in commonCurrencies" :key="c" :value="c">{{ c }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="ghost" size="icon" class="mb-0.5 shrink-0" @click="swap">
              <ArrowLeftRight />
            </Button>
            <div class="flex-1 sm:w-28">
              <Label class="mb-1.5 block text-xs text-muted-foreground">到</Label>
              <Select v-model="to" @update:model-value="convert">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem v-for="c in commonCurrencies" :key="c" :value="c">{{ c }}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div class="rounded-lg bg-muted/50 p-4 text-center">
          <div v-if="converted !== null" class="font-mono text-3xl font-bold break-all">
            {{ converted.toLocaleString('zh-CN', { maximumFractionDigits: 4 }) }}
          </div>
          <div v-else-if="loading" class="text-sm text-muted-foreground">查询中...</div>
          <div v-else class="text-sm text-muted-foreground">点击换算</div>
          <div v-if="rate !== null" class="mt-1 text-xs text-muted-foreground">
            1 {{ from }} = {{ rate }} {{ to }}
          </div>
        </div>

        <Button class="w-full" :disabled="loading" @click="convert">
          <RefreshCw :class="{ 'animate-spin': loading }" /> 换算
        </Button>
      </div>

      <p v-if="error" class="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
        {{ error }}
      </p>
      <p v-if="rateDate" class="text-center text-xs text-muted-foreground">汇率更新时间：{{ rateDate }}</p>
      <p class="text-center text-xs text-muted-foreground">
        数据来源：<a href="https://www.exchangerate-api.com" target="_blank" rel="noopener" class="underline underline-offset-2 hover:text-foreground">ExchangeRate-API (open.er-api.com)</a> · 免费接口，数据仅供参考
      </p>
    </div>
  </ToolLayout>
</template>
