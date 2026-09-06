<script setup lang="ts">
import { computed, ref } from 'vue'
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

interface UnitDef {
  id: string
  label: string
  /** 换算到基准单位的系数（温度类无此字段） */
  factor?: number
}

interface CategoryDef {
  id: string
  label: string
  units: UnitDef[]
}

const categories: CategoryDef[] = [
  {
    id: 'length',
    label: '长度（基准：米）',
    units: [
      { id: 'mm', label: '毫米 mm', factor: 0.001 },
      { id: 'cm', label: '厘米 cm', factor: 0.01 },
      { id: 'm', label: '米 m', factor: 1 },
      { id: 'km', label: '千米 km', factor: 1000 },
      { id: 'in', label: '英寸 in', factor: 0.0254 },
      { id: 'ft', label: '英尺 ft', factor: 0.3048 },
      { id: 'mi', label: '英里 mi', factor: 1609.344 },
    ],
  },
  {
    id: 'weight',
    label: '重量（基准：千克）',
    units: [
      { id: 'mg', label: '毫克 mg', factor: 0.000001 },
      { id: 'g', label: '克 g', factor: 0.001 },
      { id: 'kg', label: '千克 kg', factor: 1 },
      { id: 't', label: '吨 t', factor: 1000 },
      { id: 'oz', label: '盎司 oz', factor: 0.028349523125 },
      { id: 'lb', label: '磅 lb', factor: 0.45359237 },
    ],
  },
  {
    id: 'data',
    label: '数据存储（基准：字节）',
    units: [
      { id: 'b', label: '字节 B', factor: 1 },
      { id: 'kb', label: 'KB (1024)', factor: 1024 },
      { id: 'mb', label: 'MB', factor: 1024 ** 2 },
      { id: 'gb', label: 'GB', factor: 1024 ** 3 },
      { id: 'tb', label: 'TB', factor: 1024 ** 4 },
    ],
  },
  {
    id: 'temp',
    label: '温度（特殊换算）',
    units: [
      { id: 'c', label: '摄氏度 °C' },
      { id: 'f', label: '华氏度 °F' },
      { id: 'k', label: '开尔文 K' },
    ],
  },
]

const catId = ref('length')
const fromUnit = ref('m')
const toUnit = ref('ft')
const value = ref('1')

const cat = computed(() => categories.find(c => c.id === catId.value)!)

const results = computed(() => {
  const v = Number(value.value)
  if (!Number.isFinite(v)) return []
  const uFrom = cat.value.units.find(u => u.id === fromUnit.value)
  const uTo = cat.value.units.find(u => u.id === toUnit.value)
  if (!uFrom || !uTo) return []

  let out: number
  if (cat.value.id === 'temp') {
    // 先转摄氏度
    const c = fromUnit.value === 'c' ? v : fromUnit.value === 'f' ? (v - 32) * 5 / 9 : v - 273.15
    out = toUnit.value === 'c' ? c : toUnit.value === 'f' ? c * 9 / 5 + 32 : c + 273.15
  } else {
    out = (v * uFrom.factor!) / uTo.factor!
  }
  return [
    { unit: uTo, value: out },
  ]
})

function fmt(n: number): string {
  if (Math.abs(n) >= 1e12 || (Math.abs(n) < 1e-6 && n !== 0)) return n.toExponential(6)
  const s = n.toFixed(8).replace(/0+$/, '').replace(/\.$/, '')
  return s === '-0' ? '0' : s
}

function switchCat(id: string) {
  catId.value = id
  const units = categories.find(c => c.id === id)!.units
  fromUnit.value = units[Math.min(2, units.length - 1)].id
  toUnit.value = units[Math.min(3, units.length - 1)].id === fromUnit.value
    ? units[0].id
    : units[Math.min(3, units.length - 1)].id
}
</script>

<template>
  <ToolLayout>
    <div class="space-y-5">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="c in categories"
          :key="c.id"
          class="rounded-md px-3 py-1.5 text-sm transition-colors"
          :class="catId === c.id ? 'bg-primary text-primary-foreground' : 'border bg-card hover:bg-accent'"
          @click="switchCat(c.id)"
        >
          {{ c.label.split('（')[0] }}
        </button>
      </div>

      <div class="grid items-end gap-3 rounded-xl border bg-card p-5 shadow-sm md:grid-cols-[1fr_auto_1fr]">
        <div class="space-y-2">
          <Label class="text-xs text-muted-foreground">数值</Label>
          <Input v-model="value" type="text" inputmode="decimal" class="font-mono" />
          <Select v-model="fromUnit">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="u in cat.units" :key="u.id" :value="u.id">{{ u.label }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="hidden pb-2 text-center text-xl text-muted-foreground md:block">→</div>
        <div class="space-y-2">
          <Label class="text-xs text-muted-foreground">结果</Label>
          <div class="flex h-9 items-center rounded-md border bg-muted/50 px-3 font-mono text-sm">
            {{ results.length ? fmt(results[0].value) : '—' }}
          </div>
          <Select v-model="toUnit">
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="u in cat.units" :key="u.id" :value="u.id">{{ u.label }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <!-- 全单位对照 -->
      <div v-if="results.length">
        <div class="mb-2 text-xs text-muted-foreground">全部单位对照</div>
        <div class="overflow-hidden rounded-md border">
          <table class="w-full text-xs">
            <tbody>
              <tr
                v-for="u in cat.units.filter(u => u.id !== fromUnit)"
                :key="u.id"
                class="border-b last:border-0"
              >
                <td class="w-32 bg-muted/50 px-3 py-1.5">{{ u.label }}</td>
                <td class="px-3 py-1.5 font-mono">
                  {{ fmt(cat.id === 'temp'
                    ? (() => {
                        const v = Number(value) || 0
                        const c = fromUnit === 'c' ? v : fromUnit === 'f' ? (v - 32) * 5 / 9 : v - 273.15
                        return u.id === 'c' ? c : u.id === 'f' ? c * 9 / 5 + 32 : c + 273.15
                      })()
                    : (Number(value) || 0) * ((cat.units.find(x => x.id === fromUnit)?.factor ?? 1) / (u.factor ?? 1))) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </ToolLayout>
</template>
