<script setup lang="ts">
import { computed, ref } from 'vue'
import { marked } from 'marked'
import ToolLayout from '@/components/ToolLayout.vue'
import { Textarea } from '@/components/ui/textarea'

const source = ref(`# Markdown 预览

支持 **粗体**、*斜体*、~~删除线~~、\`行内代码\`

## 列表

- 项目一
- 项目二
  - 嵌套项

## 代码块

\`\`\`ts
function hello(name: string): string {
  return \`Hello, \${name}!\`
}
\`\`\`

## 表格

| 工具 | 类型 |
|------|------|
| JSON 格式化 | 前端 |
| IP 归属地 | 后端 |

> 引用：简单即美。

[链接](https://chat.279178.xyz)`)

const rendered = computed(() => {
  try {
    return marked.parse(source.value, { async: false }) as string
  } catch {
    return '<p>渲染出错</p>'
  }
})
</script>

<template>
  <ToolLayout>
    <div class="grid gap-4 md:grid-cols-2">
      <div>
        <Textarea v-model="source" class="h-[60vh] font-mono text-xs" />
      </div>
      <div class="h-[60vh] overflow-auto rounded-md border bg-card p-4">
        <div class="markdown-body prose prose-sm dark:prose-invert max-w-none" v-html="rendered" />
      </div>
    </div>
  </ToolLayout>
</template>
