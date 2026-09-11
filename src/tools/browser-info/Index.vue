<script setup lang="ts">
import { computed, ref } from 'vue'
import { MonitorSmartphone, ScanFace, ShieldAlert } from '@lucide/vue'
import { Button } from '@/components/ui/button'
import ToolLayout from '@/components/ToolLayout.vue'

interface InfoRow {
  label: string
  value: string
}

const nav = navigator as Navigator & {
  deviceMemory?: number
  userAgentData?: { platform?: string; mobile?: boolean }
  connection?: { downlink?: number; rtt?: number; effectiveType?: string }
}

function collect(): InfoRow[] {
  const rows: InfoRow[] = []
  rows.push({ label: 'User Agent', value: nav.userAgent })
  rows.push({ label: '平台', value: `${nav.platform}${nav.userAgentData?.platform ? ` (${nav.userAgentData.platform})` : ''}` })
  rows.push({ label: '语言', value: nav.language })
  rows.push({ label: '语言列表', value: nav.languages.join(', ') })
  rows.push({ label: '在线状态', value: nav.onLine ? '在线' : '离线' })
  rows.push({ label: '逻辑核心数', value: String(nav.hardwareConcurrency ?? '未知') })
  if (nav.deviceMemory) rows.push({ label: '内存 (GB)', value: String(nav.deviceMemory) })
  rows.push({ label: 'Cookie 可用', value: nav.cookieEnabled ? '是' : '否' })
  rows.push({ label: '屏幕分辨率', value: `${screen.width} × ${screen.height}` })
  rows.push({ label: '可用区域', value: `${screen.availWidth} × ${screen.availHeight}` })
  rows.push({ label: '色彩深度', value: `${screen.colorDepth} bit` })
  rows.push({ label: '设备像素比', value: String(window.devicePixelRatio) })
  rows.push({
    label: '时区',
    value: (() => {
      try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone
      } catch {
        return '未知'
      }
    })(),
  })
  rows.push({ label: 'UTC 偏移', value: `${-new Date().getTimezoneOffset() / 60} 小时` })
  rows.push({ label: '链接速度 (估算)', value: `downlink ${nav.connection?.downlink ?? '未知'} Mbps, rtt ${nav.connection?.rtt ?? '未知'}ms` })
  rows.push({ label: '触屏支持', value: 'ontouchstart' in window ? '是' : '否' })
  rows.push({
    label: '本地存储',
    value: (() => {
      try {
        localStorage.setItem('__probe', '1')
        localStorage.removeItem('__probe')
        return '可用'
      } catch {
        return '不可用（可能被禁用）'
      }
    })(),
  })
  rows.push({ label: 'WebGL 渲染器', value: getWebgl() })
  return rows
}

function getWebgl(): string {
  try {
    const canvas = document.createElement('canvas')
    const gl = (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')) as WebGLRenderingContext | null
    if (!gl) return '不支持'
    const info = gl.getExtension('WEBGL_debug_renderer_info')
    const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER))
    const vendor = info ? String(gl.getParameter(info.UNMASKED_VENDOR_WEBGL)) : String(gl.getParameter(gl.VENDOR))
    return `${vendor} / ${renderer}`
  } catch {
    return '获取失败'
  }
}

const rows = ref<InfoRow[]>([])
const collected = computed(() => rows.value.length > 0)

function run() {
  rows.value = collect()
}
</script>

<template>
  <ToolLayout>
    <div class="space-y-4">
      <div class="flex flex-wrap items-center gap-3">
        <Button @click="run">
          <ScanFace /> {{ collected ? '重新检测' : '开始检测' }}
        </Button>
        <p class="text-xs text-muted-foreground">所有信息均在本地浏览器读取，不上传任何数据</p>
      </div>

      <div v-if="collected" class="overflow-hidden rounded-xl border bg-card shadow-sm">
        <div class="flex items-center gap-2 border-b px-4 py-2.5 text-sm font-semibold">
          <MonitorSmartphone class="h-4 w-4 text-primary" /> 浏览器指纹信息
        </div>
        <table class="w-full text-sm">
          <tbody>
            <tr v-for="r in rows" :key="r.label" class="border-b last:border-0">
              <td class="w-40 bg-muted/50 px-4 py-2 text-xs text-muted-foreground">{{ r.label }}</td>
              <td class="px-4 py-2 break-all text-xs">{{ r.value || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="collected" class="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-600 dark:text-amber-400">
        <ShieldAlert class="mt-0.5 h-4 w-4 shrink-0" />
        <span>以上信息组合可用于识别设备。WebGL 渲染器、语言与时区是最具区分度的特征，仅使用代理或 VPN 无法完全隐藏。</span>
      </div>
    </div>
  </ToolLayout>
</template>
