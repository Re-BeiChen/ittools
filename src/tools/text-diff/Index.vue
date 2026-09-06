<script setup lang="ts">
import { computed, ref } from 'vue'
import { diffLines } from 'diff'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import ToolLayout from '@/components/ToolLayout.vue'

const left = ref('')
const right = ref('')

interface DiffRow {
  type: 'same' | 'add' | 'del'
  text: string
}

const rows = computed<DiffRow[]>(() => {
  if (!left.value && !right.value) return []
  try {
    const parts = diffLines(left.value, right.value)
    const out: DiffRow[] = []
    for (const p of parts) {
      const lines = p.value.replace(/\n$/, '').split('\n')
      for (const line of lines) {
        if (line === '' && lines.length === 1) continue
        out.push({ type: p.added ? 'add' : p.removed ? 'del' : 'same', text: line })
      }
    }
    return out
  } catch {
    return []
  }
})

const stats = computed(() => ({
  add: rows.value.filter(r => r.type === 'add').length,
  del: rows.value.filter(r => r.type === 'del').length,
}))
</script>

<template>
  <ToolLayout>
    <div class="space-y-4">
      <div class="grid gap-4 md:grid-cols-2">
        <div>
          <Label class="mb-1.5 block text-xs text-muted-foreground">原始文本</Label>
          <Textarea v-model="left" placeholder="左侧（原）" class="min-h-[200px] font-mono text-xs" />
        </div>
        <div>
          <Label class="mb-1.5 block text-xs text-muted-foreground">修改文本</Label>
          <Textarea v-model="right" placeholder="右侧（新）" class="min-h-[200px] font-mono text-xs" />
        </div>
      </div>

      <div v-if="rows.length" class="space-y-2">
        <div class="flex gap-4 text-xs text-muted-foreground">
          <span class="text-green-600 dark:text-green-400">+{{ stats.add }} 行新增</span>
          <span class="text-red-600 dark:text-red-400">-{{ stats.del }} 行删除</span>
        </div>
        <div class="overflow-hidden rounded-md border font-mono text-xs">
          <div
            v-for="(row, i) in rows"
            :key="i"
            class="flex gap-3 px-3 py-0.5 leading-6"
            :class="{
              'bg-green-500/10 text-green-700 dark:text-green-400': row.type === 'add',
              'bg-red-500/10 text-red-700 dark:text-red-400': row.type === 'del',
            }"
          >
            <span class="w-4 shrink-0 select-none text-center opacity-60">
              {{ row.type === 'add' ? '+' : row.type === 'del' ? '-' : '' }}
            </span>
            <span class="break-all whitespace-pre-wrap">{{ row.text || ' ' }}</span>
          </div>
        </div>
      </div>
      <p v-else class="py-10 text-center text-sm text-muted-foreground">（输入两段文本后显示差异）</p>
    </div>
  </ToolLayout>
</template>
