<script setup lang="ts">
import { computed, ref } from 'vue'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import ToolLayout from '@/components/ToolLayout.vue'

const token = ref('')

function b64urlDecode(s: string): string {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/')
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
  const bin = atob(b64 + pad)
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

const parts = computed(() => {
  const raw = token.value.trim()
  if (!raw) return null
  const segs = raw.split('.')
  if (segs.length < 2) return { error: 'JWT 至少需要 2 段（header.payload.signature）' }
  try {
    const header = JSON.parse(b64urlDecode(segs[0]))
    const payload = JSON.parse(b64urlDecode(segs[1]))
    return { header, payload, signature: segs[2] ?? '' }
  } catch {
    return { error: '解析失败：段落不是合法的 Base64URL JSON' }
  }
})

function fmtClaims(payload: Record<string, unknown>): { key: string; value: string; note: string }[] {
  const notes: Record<string, string> = {
    exp: '过期时间（Unix 秒）',
    iat: '签发时间（Unix 秒）',
    nbf: '生效时间（Unix 秒）',
    sub: '主题（用户）',
    iss: '签发者',
    aud: '受众',
    jti: 'JWT ID',
  }
  return Object.entries(payload).map(([key, value]) => {
    let v = typeof value === 'object' ? JSON.stringify(value) : String(value)
    if (['exp', 'iat', 'nbf'].includes(key) && /^\d+$/.test(v)) {
      v += `  →  ${new Date(Number(v) * 1000).toLocaleString('zh-CN')}`
    }
    return { key, value: v, note: notes[key] ?? '' }
  })
}

const expired = computed(() => {
  const p = parts.value?.payload as Record<string, unknown> | undefined
  if (p && typeof p.exp === 'number') {
    return p.exp * 1000 < Date.now()
  }
  return null
})
</script>

<template>
  <ToolLayout>
    <div class="space-y-4">
      <Textarea
        v-model="token"
        placeholder="粘贴 JWT（eyJhbGciOi... 开头）"
        class="min-h-[100px] font-mono text-xs"
      />

      <template v-if="parts?.error">
        <p class="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
          {{ parts.error }}
        </p>
      </template>

      <template v-else-if="parts">
        <div class="space-y-4">
          <div v-if="expired !== null">
            <Badge v-if="expired" variant="destructive">已过期</Badge>
            <Badge v-else class="bg-green-500/15 text-green-600 dark:text-green-400">有效期内</Badge>
          </div>

          <div>
            <div class="mb-2 text-xs font-semibold text-red-500">Header</div>
            <pre class="overflow-auto rounded-md border bg-muted/50 p-3 font-mono text-xs">{{ JSON.stringify(parts.header, null, 2) }}</pre>
          </div>

          <div>
            <div class="mb-2 text-xs font-semibold text-purple-500">Payload</div>
            <div class="overflow-hidden rounded-md border">
              <table class="w-full text-xs">
                <tbody>
                  <tr v-for="claim in fmtClaims(parts.payload as Record<string, unknown>)" :key="claim.key" class="border-b last:border-0">
                    <td class="w-24 bg-muted/50 px-3 py-2 font-mono font-medium">{{ claim.key }}</td>
                    <td class="px-3 py-2 font-mono break-all">{{ claim.value }}</td>
                    <td v-if="claim.note" class="hidden w-44 px-3 py-2 text-muted-foreground md:table-cell">{{ claim.note }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div v-if="parts.signature">
            <div class="mb-2 text-xs font-semibold text-blue-500">Signature（签名，未验证）</div>
            <pre class="overflow-auto rounded-md border bg-muted/50 p-3 font-mono text-xs break-all">{{ parts.signature }}</pre>
          </div>
        </div>
      </template>
    </div>
  </ToolLayout>
</template>
