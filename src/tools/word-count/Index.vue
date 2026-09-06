<script setup lang="ts">
import { computed, ref } from 'vue'
import ToolLayout from '@/components/ToolLayout.vue'
import { Textarea } from '@/components/ui/textarea'

const text = ref('')

const stats = computed(() => {
  const s = text.value
  const cjk = (s.match(/[\u4e00-\u9fff]/g) ?? []).length
  return {
    chars: s.length,
    charsNoSpace: s.replace(/\s/g, '').length,
    // 中文按字计数，其余按空白分词
    words: cjk + (s.replace(/[\u4e00-\u9fff]/g, ' ').match(/\S+/g) ?? []).length,
    lines: s ? s.split('\n').length : 0,
    sentences: (s.match(/[.!?。！？…]+/g) ?? []).length,
    paragraphs: s.split(/\n\s*\n/).filter(p => p.trim()).length,
    bytes: new TextEncoder().encode(s).length,
  }
})

const items: { key: keyof typeof stats.value, label: string }[] = [
  { key: 'chars', label: '字符数' },
  { key: 'charsNoSpace', label: '字符数（不含空格）' },
  { key: 'words', label: '词数（中文按字）' },
  { key: 'lines', label: '行数' },
  { key: 'sentences', label: '句子数' },
  { key: 'paragraphs', label: '段落数' },
  { key: 'bytes', label: '字节数（UTF-8）' },
]
</script>

<template>
  <ToolLayout>
    <div class="space-y-4">
      <Textarea
        v-model="text"
        placeholder="输入或粘贴文本，实时统计"
        class="min-h-[240px]"
      />
      <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div v-for="item in items" :key="item.key" class="rounded-xl border bg-card p-4 text-center shadow-sm">
          <div class="font-mono text-2xl font-bold">{{ stats[item.key].toLocaleString() }}</div>
          <div class="mt-1 text-xs text-muted-foreground">{{ item.label }}</div>
        </div>
      </div>
    </div>
  </ToolLayout>
</template>
