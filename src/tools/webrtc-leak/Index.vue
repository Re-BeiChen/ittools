<script setup lang="ts">
import { ref } from 'vue'
import { RadioTower, ShieldCheck, ShieldAlert } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import ToolLayout from '@/components/ToolLayout.vue'

/** 第三方 STUN 服务器（数据来源：各 STUN 服务商，仅用于建立连接收集候选地址） */
const STUN_SERVERS = [
  'stun.l.google.com:19302',
  'stun.cloudflare.com:3478',
  'global.stun.twilio.com:3478',
]

interface Candidate {
  server: string
  ip: string | null
  type: string | null
}

const candidates = ref<Candidate[]>([])
const testing = ref(false)
const done = ref(false)
const leaked = ref(false)
const leakedIps = ref<string[]>([])

function isPrivate(ip: string): boolean {
  if (ip.startsWith('0.') || ip === '::' || ip.startsWith('::1')) return true
  const parts = ip.split('.')
  if (parts.length === 4) {
    const a = Number(parts[0])
    const b = Number(parts[1])
    if (a === 10) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 192 && b === 168) return true
    if (a === 169 && b === 254) return true
    if (a === 127) return true
  }
  return /^fe[89abcdef][0-9a-f]*:/i.test(ip)
}

async function testServer(server: string): Promise<Candidate> {
  return new Promise(resolve => {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: `stun:${server}` }] })
    const ips = new Set<string>()
    let timeout: ReturnType<typeof setTimeout> | null = null

    const finish = () => {
      if (timeout) clearTimeout(timeout)
      try {
        pc.close()
      } catch { /* noop */ }
      const publicIps = [...ips].filter(i => !isPrivate(i))
      resolve({
        server,
        ip: publicIps[0] ?? null,
        type: publicIps.length ? 'public' : null,
      })
    }

    pc.onicecandidate = e => {
      if (!e.candidate) {
        finish()
        return
      }
      const parts = e.candidate.candidate.split(' ')
      if (parts[4]) ips.add(parts[4])
    }
    // 兜底：无候选事件时 8 秒后结束
    timeout = setTimeout(finish, 8000)

    pc.createDataChannel('probe')
    pc.createOffer()
      .then(offer => pc.setLocalDescription(offer))
      .catch(() => finish())
  })
}

async function run() {
  testing.value = true
  done.value = false
  leaked.value = false
  leakedIps.value = []
  candidates.value = []
  const results = await Promise.all(STUN_SERVERS.map(testServer))
  candidates.value = results

  const pub = new Set<string>()
  for (const c of results) if (c.ip) pub.add(c.ip)
  leakedIps.value = [...pub]
  leaked.value = pub.size > 0
  done.value = true
  testing.value = false
}
</script>

<template>
  <ToolLayout>
    <div class="space-y-4">
      <div class="flex items-center gap-3">
        <Button :disabled="testing" @click="run">
          <RadioTower /> {{ testing ? '检测中...' : done ? '重新检测' : '开始检测' }}
        </Button>
        <p class="text-xs text-muted-foreground">
          通过 WebRTC 连接多个 STUN 服务器，收集浏览器暴露的网络地址
        </p>
      </div>

      <div v-if="done" class="space-y-4">
        <div
          class="flex items-start gap-3 rounded-xl border p-4"
          :class="leaked ? 'border-destructive/50 bg-destructive/10' : 'border-emerald-500/40 bg-emerald-500/10'"
        >
          <component :is="leaked ? ShieldAlert : ShieldCheck" class="mt-0.5 h-5 w-5 shrink-0" :class="leaked ? 'text-destructive' : 'text-emerald-500'" />
          <div>
            <div class="text-sm font-bold" :class="leaked ? 'text-destructive' : 'text-emerald-500'">
              {{ leaked ? '检测到 WebRTC 泄漏' : '未检测到公网 IP 泄漏' }}
            </div>
            <p class="mt-1 text-xs text-muted-foreground">
              <template v-if="leaked">浏览器通过 WebRTC 暴露了以下公网地址，可能绕过代理/VPN：</template>
              <template v-else>浏览器未通过 WebRTC 暴露公网地址（本机候选地址均已被过滤或不可达）。</template>
            </p>
            <div v-if="leaked" class="mt-2 flex flex-wrap gap-1.5">
              <span v-for="ip in leakedIps" :key="ip" class="rounded-md bg-destructive/15 px-2 py-1 font-mono text-xs text-destructive">{{ ip }}</span>
            </div>
          </div>
        </div>

        <div class="overflow-hidden rounded-xl border bg-card shadow-sm">
          <div class="border-b px-4 py-2.5 text-sm font-semibold">各 STUN 服务器候选</div>
          <div class="divide-y text-sm">
            <div v-for="c in candidates" :key="c.server" class="flex items-center justify-between px-4 py-3">
              <span class="font-mono text-xs text-muted-foreground">{{ c.server }}</span>
              <span v-if="c.ip" class="font-mono text-sm text-destructive">{{ c.ip }}</span>
              <span v-else class="text-xs text-muted-foreground">未暴露公网 IP</span>
            </div>
          </div>
        </div>

        <p class="text-xs text-muted-foreground">
          STUN 服务器来源：Google / Cloudflare / Twilio。检测完成后可考虑在浏览器扩展中禁用 WebRTC 或使用过滤型代理。
        </p>
      </div>
    </div>
  </ToolLayout>
</template>
