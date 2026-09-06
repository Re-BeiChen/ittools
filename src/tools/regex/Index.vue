<script setup lang="ts">
import { computed, ref } from 'vue'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import ToolLayout from '@/components/ToolLayout.vue'

const pattern = ref('(\\w+)@(\\w+)\\.(\\w+)')
const flags = ref('g')
const testStr = ref('联系 alice@example.com 或 bob@test.org 获取更多信息')

const flagsStr = computed(() =>
  `${flags.value.includes('g') ? 'g' : ''}${flags.value.includes('i') ? 'i' : ''}${flags.value.includes('m') ? 'm' : ''}`,
)

const result = computed(() => {
  if (!pattern.value || !testStr.value) return null
  try {
    const re = new RegExp(pattern.value, flagsStr.value)
    const matches = [...testStr.value.matchAll(re)]
    return {
      matches: matches.map(m => ({
        text: m[0],
        index: m.index ?? 0,
        groups: m.slice(1),
      })),
      error: '',
    }
  } catch (e) {
    return { matches: [], error: (e as Error).message }
  }
})

/** 高亮后的 HTML */
const highlighted = computed(() => {
  const r = result.value
  if (!r || r.error || r.matches.length === 0) {
    return [{ text: testStr.value, match: false }]
  }
  const parts: { text: string; match: boolean }[] = []
  let last = 0
  for (const m of r.matches) {
    if (m.index > last) parts.push({ text: testStr.value.slice(last, m.index), match: false })
    parts.push({ text: m.text, match: true })
    last = m.index + m.text.length
  }
  if (last < testStr.value.length) parts.push({ text: testStr.value.slice(last), match: false })
  return parts
})

const flagList = ['g', 'i', 'm', 's']
</script>

<template>
  <ToolLayout>
    <div class="space-y-4">
      <div class="flex items-center gap-2">
        <span class="font-mono text-sm text-muted-foreground">/</span>
        <Input v-model="pattern" placeholder="正则表达式" class="flex-1 font-mono" />
        <span class="font-mono text-sm text-muted-foreground">/</span>
        <Input :model-value="flagsStr" class="w-16 font-mono text-center" readonly />
      </div>

      <div class="flex gap-4">
        <div v-for="f in flagList" :key="f" class="flex items-center gap-1.5">
          <Switch
            :id="`flag-${f}`"
            :checked="flags.includes(f)"
            @update:checked="(v?: boolean) => flags = v ? flags + f : flags.replace(f, '')"
          />
          <Label :for="`flag-${f}`" class="font-mono text-xs">{{ f }}</Label>
        </div>
      </div>

      <div>
        <Label class="mb-1.5 block text-xs text-muted-foreground">测试字符串</Label>
        <Textarea v-model="testStr" class="min-h-[120px] font-mono text-xs" />
      </div>

      <p v-if="result?.error" class="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
        {{ result.error }}
      </p>

      <template v-if="result && !result.error">
        <div>
          <div class="mb-2 text-xs text-muted-foreground">
            {{ result.matches.length }} 个匹配
          </div>
          <div class="rounded-md border bg-muted/50 p-3 font-mono text-xs leading-6 break-all">
            <template v-for="(part, i) in highlighted" :key="i">
              <mark v-if="part.match" class="rounded bg-yellow-300/60 px-0.5 text-inherit dark:bg-yellow-500/40">{{ part.text }}</mark>
              <template v-else>{{ part.text }}</template>
            </template>
          </div>
        </div>

        <div v-if="result.matches.length">
          <div class="mb-2 text-xs text-muted-foreground">捕获组</div>
          <div class="overflow-hidden rounded-md border">
            <table class="w-full text-xs">
              <tbody>
                <tr v-for="(m, i) in result.matches" :key="i" class="border-b last:border-0">
                  <td class="w-10 bg-muted/50 px-2 py-1.5 font-mono">#{{ i }}</td>
                  <td class="px-2 py-1.5 font-mono break-all">{{ m.text }}</td>
                  <td v-if="m.groups.length" class="px-2 py-1.5 font-mono text-muted-foreground break-all">
                    {{ m.groups.map((g, j) => `$${j + 1}=${g}`).join('  ') }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>
    </div>
  </ToolLayout>
</template>
