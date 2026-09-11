<script setup lang="ts">
import { computed, ref } from 'vue'
import { Marked, type Tokens } from 'marked'
import hljs from 'highlight.js/lib/common'
import ToolLayout from '@/components/ToolLayout.vue'
import { Textarea } from '@/components/ui/textarea'

// GFM + 单换行转 <br>；代码块走 highlight.js（common 语言集，随本工具路由分包加载）
const md = new Marked({
  gfm: true,
  breaks: true,
  renderer: {
    code({ text, lang }: Tokens.Code) {
      const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext'
      const highlighted = hljs.highlight(text, { language, ignoreIllegals: true }).value
      return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`
    },
  },
})

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
    return md.parse(source.value, { async: false }) as string
  } catch {
    return '<p>渲染出错</p>'
  }
})
</script>

<template>
  <ToolLayout>
    <div class="grid gap-4 md:grid-cols-2">
      <section class="flex min-w-0 flex-col gap-2">
        <div class="flex items-center justify-between px-0.5 text-xs text-muted-foreground">
          <span>Markdown 源码</span>
          <span>{{ source.length }} 字符</span>
        </div>
        <Textarea v-model="source" class="h-[60vh] font-mono text-xs" />
      </section>
      <section class="flex min-w-0 flex-col gap-2">
        <div class="px-0.5 text-xs text-muted-foreground">预览</div>
        <div class="h-[60vh] overflow-auto rounded-md border bg-card p-6">
          <div class="md-preview" v-html="rendered" />
        </div>
      </section>
    </div>
  </ToolLayout>
</template>

<style>
/* ============ Markdown 预览排版 ============
 * 项目未安装 @tailwindcss/typography，prose 类无效，
 * 这里基于设计变量手写完整排版（浅色/深色自适应）。
 */
.md-preview {
  font-size: 0.9rem;
  line-height: 1.8;
  color: var(--color-foreground);
  overflow-wrap: break-word;
}
.md-preview > :first-child {
  margin-top: 0;
}
.md-preview > :last-child {
  margin-bottom: 0;
}

/* 标题 */
.md-preview h1,
.md-preview h2,
.md-preview h3,
.md-preview h4,
.md-preview h5,
.md-preview h6 {
  font-weight: 700;
  line-height: 1.35;
  margin: 1.4em 0 0.6em;
}
.md-preview h1 {
  font-size: 1.7em;
  padding-bottom: 0.3em;
  border-bottom: 1px solid var(--color-border);
}
.md-preview h2 {
  font-size: 1.4em;
  padding-bottom: 0.3em;
  border-bottom: 1px solid var(--color-border);
}
.md-preview h3 {
  font-size: 1.2em;
}
.md-preview h4 {
  font-size: 1.05em;
}
.md-preview h5 {
  font-size: 0.95em;
}
.md-preview h6 {
  font-size: 0.9em;
  color: var(--color-muted-foreground);
}

/* 段落 / 行内元素 */
.md-preview p {
  margin: 0.7em 0;
}
.md-preview a {
  color: oklch(0.55 0.16 255);
  text-decoration: none;
}
.md-preview a:hover {
  text-decoration: underline;
}
.md-preview del {
  color: var(--color-muted-foreground);
}
.md-preview img {
  max-width: 100%;
  border-radius: 0.5rem;
}
.md-preview kbd {
  font-family: var(--font-mono);
  font-size: 0.8em;
  padding: 0.1em 0.45em;
  background: var(--color-muted);
  border: 1px solid var(--color-border);
  border-bottom-width: 2px;
  border-radius: 0.375rem;
}

/* 列表 */
.md-preview ul,
.md-preview ol {
  margin: 0.7em 0;
  padding-left: 1.5em;
}
.md-preview ul {
  list-style: disc;
}
.md-preview ol {
  list-style: decimal;
}
.md-preview li {
  margin: 0.3em 0;
}
.md-preview li::marker {
  color: var(--color-muted-foreground);
}
.md-preview li > ul,
.md-preview li > ol {
  margin: 0.3em 0;
}
.md-preview ul ul {
  list-style: circle;
}
.md-preview ul ul ul {
  list-style: square;
}

/* 任务列表（GFM checkbox） */
.md-preview li:has(> input[type='checkbox']) {
  list-style: none;
  margin-left: -1.4em;
}
.md-preview input[type='checkbox'] {
  margin-right: 0.45em;
  accent-color: oklch(0.55 0.16 255);
}

/* 行内代码 */
.md-preview code {
  font-family: var(--font-mono);
  font-size: 0.86em;
  padding: 0.12em 0.35em;
  background: var(--color-muted);
  border: 1px solid var(--color-border);
  border-radius: 0.375rem;
}

/* 代码块 */
.md-preview pre {
  margin: 1em 0;
  padding: 0.9rem 1rem;
  overflow-x: auto;
  font-size: 0.8125rem;
  line-height: 1.7;
  background: oklch(0.968 0.002 260);
  border: 1px solid var(--color-border);
  border-radius: 0.5rem;
}
.md-preview pre code {
  padding: 0;
  background: transparent;
  border: none;
  font-size: inherit;
}
.dark .md-preview pre {
  background: oklch(0.17 0.025 255);
}

/* 表格 */
.md-preview table {
  display: block;
  width: max-content;
  max-width: 100%;
  overflow-x: auto;
  border-collapse: collapse;
  margin: 1em 0;
  font-size: 0.92em;
}
.md-preview th,
.md-preview td {
  padding: 0.45em 0.9em;
  border: 1px solid var(--color-border);
  text-align: left;
}
.md-preview thead th {
  font-weight: 600;
  background: var(--color-muted);
}
.md-preview tbody tr:nth-child(even) {
  background: color-mix(in oklab, var(--color-muted) 45%, transparent);
}

/* 引用 / 分隔线 */
.md-preview blockquote {
  margin: 1em 0;
  padding: 0.1em 1em;
  border-left: 3px solid var(--color-border);
  color: var(--color-muted-foreground);
}
.md-preview blockquote > :first-child {
  margin-top: 0.5em;
}
.md-preview blockquote > :last-child {
  margin-bottom: 0.5em;
}
.md-preview hr {
  margin: 1.6em 0;
  border: 0;
  border-top: 1px solid var(--color-border);
}

/* 深色模式链接 / 复选框提亮 */
.dark .md-preview a {
  color: oklch(0.72 0.13 250);
}
.dark .md-preview input[type='checkbox'] {
  accent-color: oklch(0.62 0.16 255);
}

/* ============ highlight.js 配色（GitHub 风格） ============ */
/* 浅色 */
.md-preview .hljs-comment,
.md-preview .hljs-quote {
  color: #6a737d;
  font-style: italic;
}
.md-preview .hljs-keyword,
.md-preview .hljs-selector-tag,
.md-preview .hljs-literal,
.md-preview .hljs-doctag,
.md-preview .hljs-template-tag,
.md-preview .hljs-variable.language_ {
  color: #cf222e;
}
.md-preview .hljs-title,
.md-preview .hljs-title.class_,
.md-preview .hljs-title.function_,
.md-preview .hljs-section,
.md-preview .hljs-name {
  color: #8250df;
}
.md-preview .hljs-attr,
.md-preview .hljs-attribute,
.md-preview .hljs-number,
.md-preview .hljs-symbol,
.md-preview .hljs-meta,
.md-preview .hljs-variable,
.md-preview .hljs-template-variable,
.md-preview .hljs-operator,
.md-preview .hljs-selector-attr,
.md-preview .hljs-selector-class,
.md-preview .hljs-selector-id,
.md-preview .hljs-selector-pseudo {
  color: #0550ae;
}
.md-preview .hljs-string,
.md-preview .hljs-regexp,
.md-preview .hljs-link {
  color: #0a3069;
}
.md-preview .hljs-built_in,
.md-preview .hljs-type {
  color: #953800;
}
.md-preview .hljs-addition {
  color: #116329;
  background-color: #dafbe1;
}
.md-preview .hljs-deletion {
  color: #82071e;
  background-color: #ffebe9;
}

/* 深色（github-dark） */
.dark .md-preview .hljs-comment,
.dark .md-preview .hljs-quote {
  color: #8b949e;
}
.dark .md-preview .hljs-keyword,
.dark .md-preview .hljs-selector-tag,
.dark .md-preview .hljs-literal,
.dark .md-preview .hljs-doctag,
.dark .md-preview .hljs-template-tag,
.dark .md-preview .hljs-variable.language_ {
  color: #ff7b72;
}
.dark .md-preview .hljs-title,
.dark .md-preview .hljs-title.class_,
.dark .md-preview .hljs-title.function_,
.dark .md-preview .hljs-section,
.dark .md-preview .hljs-name {
  color: #d2a8ff;
}
.dark .md-preview .hljs-attr,
.dark .md-preview .hljs-attribute,
.dark .md-preview .hljs-number,
.dark .md-preview .hljs-symbol,
.dark .md-preview .hljs-meta,
.dark .md-preview .hljs-variable,
.dark .md-preview .hljs-template-variable,
.dark .md-preview .hljs-operator,
.dark .md-preview .hljs-selector-attr,
.dark .md-preview .hljs-selector-class,
.dark .md-preview .hljs-selector-id,
.dark .md-preview .hljs-selector-pseudo {
  color: #79c0ff;
}
.dark .md-preview .hljs-string,
.dark .md-preview .hljs-regexp,
.dark .md-preview .hljs-link {
  color: #a5d6ff;
}
.dark .md-preview .hljs-built_in,
.dark .md-preview .hljs-type {
  color: #ffa657;
}
.dark .md-preview .hljs-addition {
  color: #7ee787;
  background-color: rgb(46 160 67 / 0.15);
}
.dark .md-preview .hljs-deletion {
  color: #ffa198;
  background-color: rgb(248 81 73 / 0.15);
}
</style>
