<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check, Copy, Send } from '@lucide/vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import ToolLayout from '@/components/ToolLayout.vue'
import { useAuth } from '@/composables/useAuth'
import { copyText } from '@/lib/utils'

const { authFetch } = useAuth()

const content = ref('')
const expiresIn = ref('86400')
const burn = ref(false)

const sharing = ref(false)
const error = ref('')
const created = ref<{ code: string; url: string; expiresAt: number | null } | null>(null)
const copied = ref(false)

const expireOptions = [
  { value: '3600', label: '1 小时' },
  { value: '86400', label: '1 天' },
  { value: '604800', label: '7 天' },
  { value: '2592000', label: '30 天' },
  { value: '0', label: '永久' },
]

const origin = computed(() => window.location.origin)
const shareUrl = computed(() => (created.value ? `${origin.value}${created.value.url}` : ''))

async function create() {
  if (!content.value.trim()) {
    error.value = '请输入内容'
    return
  }
  sharing.value = true
  error.value = ''
  created.value = null
  try {
    const res = await authFetch('/api/paste', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: content.value,
        expiresIn: Number(expiresIn.value),
        burn: burn.value,
      }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? '创建失败')
    created.value = data
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    sharing.value = false
  }
}

async function copy() {
  if (await copyText(shareUrl.value)) {
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  }
}
</script>

<template>
  <ToolLayout>
    <div class="space-y-4">
      <Textarea
        v-model="content"
        placeholder="粘贴要分享的文本/代码/配置...（最大 512KB）"
        class="min-h-[200px] font-mono text-xs"
      />

      <div class="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4 shadow-sm">
        <div class="flex items-center gap-2">
          <Label class="text-sm">有效期</Label>
          <Select v-model="expiresIn">
            <SelectTrigger class="w-28"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem v-for="o in expireOptions" :key="o.value" :value="o.value">{{ o.label }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="flex items-center gap-2">
          <Switch id="burn" v-model="burn" />
          <Label for="burn" class="text-sm">阅后即焚</Label>
        </div>
        <Button class="ml-auto" :disabled="sharing" @click="create">
          <Send /> {{ sharing ? '创建中...' : '生成分享链接' }}
        </Button>
      </div>

      <p v-if="error" class="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
        {{ error }}
      </p>

      <div v-if="created" class="space-y-3 rounded-xl border bg-card p-4 shadow-sm">
        <div class="flex items-center gap-2">
          <Badge variant="secondary" class="font-mono">#{{ created.code }}</Badge>
          <Badge v-if="burn" class="bg-yellow-500/15 text-yellow-600 dark:text-yellow-400">阅后即焚</Badge>
        </div>
        <div class="flex items-center gap-2">
          <code class="flex-1 break-all rounded-md bg-muted px-3 py-2 font-mono text-sm">{{ shareUrl }}</code>
          <Button size="sm" variant="outline" @click="copy">
            <Check v-if="copied" />
            <Copy v-else />
          </Button>
        </div>
        <p class="text-xs text-muted-foreground">
          {{ burn ? '对方打开一次后内容将自动删除' : '链接在有效期内可反复访问' }}
        </p>
      </div>
    </div>
  </ToolLayout>
</template>
