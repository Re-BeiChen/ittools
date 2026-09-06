<script setup lang="ts">
import { onUnmounted, ref } from 'vue'
import { Check, Copy, RefreshCw, ShieldEllipsis } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import ToolLayout from '@/components/ToolLayout.vue'
import { copyText } from '@/lib/utils'

const secret = ref<string>(secretFromStorage())
const secretInput = ref(secret.value)
const algorithm = ref<'SHA-1' | 'SHA-256' | 'SHA-512'>('SHA-1')
const digits = ref('6')
const period = ref('30')

const code = ref('')
const remaining = ref(30)
const copied = ref(false)
const error = ref('')

let timer: ReturnType<typeof setInterval> | null = null

// ---------- Base32 ----------
const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

function randomSecret(len = 32): string {
  const bytes = crypto.getRandomValues(new Uint8Array(len))
  return Array.from(bytes, b => B32[b & 31]).join('')
}

function b32decode(s: string): Uint8Array {
  const clean = s.toUpperCase().replace(/[\s=]/g, '')
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of clean) {
    const idx = B32.indexOf(ch)
    if (idx === -1) throw new Error(`非法 Base32 字符：${ch}`)
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return new Uint8Array(out)
}

async function hotp(hmacAlg: string, key: Uint8Array, counter: number): Promise<number> {
  const buf = new ArrayBuffer(8)
  const view = new DataView(buf)
  view.setUint32(0, Math.floor(counter / 2 ** 32))
  view.setUint32(4, counter >>> 0)
  const subtleAlg = hmacAlg === 'SHA-256' ? 'SHA-256' : hmacAlg === 'SHA-512' ? 'SHA-512' : 'SHA-1'
  const keyBuf = key.buffer.slice(key.byteOffset, key.byteOffset + key.byteLength) as ArrayBuffer
  const ck = await crypto.subtle.importKey('raw', keyBuf, { name: 'HMAC', hash: subtleAlg }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', ck, buf))
  const offset = sig[sig.length - 1] & 0x0f
  const bin = ((sig[offset] & 0x7f) << 24) | (sig[offset + 1] << 16) | (sig[offset + 2] << 8) | sig[offset + 3]
  return bin
}

async function compute() {
  error.value = ''
  let key: Uint8Array
  try {
    key = b32decode(secretInput.value)
  } catch (e) {
    error.value = (e as Error).message
    code.value = ''
    return
  }
  const t = Math.floor(Date.now() / 1000)
  const pc = Number(period.value || 30)
  const counter = Math.floor(t / pc)
  const bin = await hotp(algorithm.value, key, counter)
  const digitsN = Number(digits.value)
  const outVal = bin % 10 ** digitsN
  code.value = String(outVal).padStart(digitsN, '0')
  remaining.value = pc - (t % pc)
}

function startLoop() {
  stop()
  compute()
  timer = setInterval(compute, 1000)
}

function stop() {
  if (timer !== null) {
    clearInterval(timer)
    timer = null
  }
}

function regenerate() {
  secretInput.value = randomSecret()
  secret.value = secretInput.value
  persistSecret()
  startLoop()
}

function persistSecret() {
  try {
    localStorage.setItem('ittools:otp-secret', secretInput.value.trim())
  } catch {
    /* ignore */
  }
}

function secretFromStorage(): string {
  let s = ''
  try {
    s = localStorage.getItem('ittools:otp-secret') ?? ''
  } catch {
    /* ignore */
  }
  return s || 'JBSWY3DPEHPK3PXP'
}

function onSecretInput() {
  secret.value = secretInput.value
  persistSecret()
  startLoop()
}

async function doCopy() {
  if (await copyText(code.value)) {
    copied.value = true
    setTimeout(() => (copied.value = false), 1500)
  }
}

startLoop()
onUnmounted(stop)
</script>

<template>
  <ToolLayout>
    <div class="space-y-5">
      <div>
        <Label class="text-sm">Secret（Base32）</Label>
        <div class="mt-1.5 flex gap-2">
          <Input
            v-model="secretInput"
            class="font-mono text-xs uppercase"
            placeholder="Base32 密钥，如 JBSWY3DPEHPK3PXP"
            spellcheck="false"
            @change="onSecretInput"
          />
          <Button variant="outline" title="随机生成新的 Secret" @click="regenerate">
            <RefreshCw class="h-4 w-4" /> 随机
          </Button>
        </div>
        <p v-if="error" class="mt-1.5 text-sm text-destructive">{{ error }}</p>
      </div>

      <div class="grid grid-cols-3 gap-3">
        <div>
          <Label class="text-sm">算法</Label>
          <Select v-model="algorithm" @update:model-value="startLoop">
            <SelectTrigger class="mt-1.5"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="SHA-1">SHA-1</SelectItem>
              <SelectItem value="SHA-256">SHA-256</SelectItem>
              <SelectItem value="SHA-512">SHA-512</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label class="text-sm">验证码位数</Label>
          <Select v-model="digits" @update:model-value="startLoop">
            <SelectTrigger class="mt-1.5"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="6">6 位</SelectItem>
              <SelectItem value="8">8 位</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label class="text-sm">周期（秒）</Label>
          <Select v-model="period" @update:model-value="startLoop">
            <SelectTrigger class="mt-1.5"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30</SelectItem>
              <SelectItem value="60">60</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div class="rounded-xl border bg-card p-6 text-center shadow-sm">
        <div class="flex items-center justify-center gap-2 text-muted-foreground">
          <ShieldEllipsis class="h-5 w-5" />
          <span class="text-sm">当前验证码</span>
        </div>
        <div class="mt-3 text-5xl font-bold tracking-[0.2em] font-mono">{{ code || '······' }}</div>
        <div class="mx-auto mt-4 flex items-center gap-3">
          <div class="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <div
              class="h-full rounded-full bg-primary transition-all duration-1000 ease-linear"
              :style="{ width: `${(remaining / Number(period)) * 100}%` }"
            />
          </div>
          <span class="text-sm tabular-nums text-muted-foreground">{{ remaining }}s</span>
        </div>
        <Button size="sm" variant="outline" class="mt-4" :disabled="!code" @click="doCopy">
          <Check v-if="copied" class="h-4 w-4" />
          <Copy v-else class="h-4 w-4" />
          {{ copied ? '已复制' : '复制验证码' }}
        </Button>
      </div>

      <p class="text-xs leading-relaxed text-muted-foreground">
        <Badge variant="outline" class="mr-1 font-normal">TOTP</Badge>
        本工具在浏览器本地计算（WebCrypto 实现 RFC 6238），Secret 仅存于本机 localStorage，不会上传。适合快速核对 2FA 验证码或生成新 Secret。
      </p>
    </div>
  </ToolLayout>
</template>