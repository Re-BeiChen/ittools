<script setup lang="ts">
import { computed, ref } from 'vue'
import { Search } from '@lucide/vue'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import ToolLayout from '@/components/ToolLayout.vue'

interface HttpStatus {
  code: number
  label: string
  desc: string
  group: '1xx' | '2xx' | '3xx' | '4xx' | '5xx'
}

const STATUSES: HttpStatus[] = [
  { code: 100, label: 'Continue', desc: '服务器已收到请求头，客户端应继续发送请求体。', group: '1xx' },
  { code: 101, label: 'Switching Protocols', desc: '服务器同意客户端请求切换协议（如 WebSocket 升级）。', group: '1xx' },
  { code: 102, label: 'Processing', desc: '服务器收到请求但尚未完成处理（WebDAV）。', group: '1xx' },
  { code: 103, label: 'Early Hints', desc: '提前返回某些响应头，加速预加载。', group: '1xx' },
  { code: 200, label: 'OK', desc: '请求成功，响应体包含请求所需资源。', group: '2xx' },
  { code: 201, label: 'Created', desc: '请求成功且创建了新资源（常用 POST）。', group: '2xx' },
  { code: 202, label: 'Accepted', desc: '请求已接受，但处理可能尚未完成。', group: '2xx' },
  { code: 204, label: 'No Content', desc: '请求成功，但响应体为空。', group: '2xx' },
  { code: 206, label: 'Partial Content', desc: '返回部分内容，常用于断点续传 / Range 请求。', group: '2xx' },
  { code: 301, label: 'Moved Permanently', desc: '资源已永久移动到新 URL，浏览器会更新书签。', group: '3xx' },
  { code: 302, label: 'Found', desc: '临时重定向到新 URL。', group: '3xx' },
  { code: 304, label: 'Not Modified', desc: '资源未修改，可直接使用本地缓存。', group: '3xx' },
  { code: 307, label: 'Temporary Redirect', desc: '临时重定向，保留原始方法与请求体。', group: '3xx' },
  { code: 308, label: 'Permanent Redirect', desc: '永久重定向，保留原始方法与请求体。', group: '3xx' },
  { code: 400, label: 'Bad Request', desc: '请求语法有误，服务器无法理解。', group: '4xx' },
  { code: 401, label: 'Unauthorized', desc: '未认证，需要提供有效的身份凭证。', group: '4xx' },
  { code: 403, label: 'Forbidden', desc: '已认证但无权访问该资源。', group: '4xx' },
  { code: 404, label: 'Not Found', desc: '请求的资源不存在。', group: '4xx' },
  { code: 405, label: 'Method Not Allowed', desc: '请求方法不被该资源支持（如对只读接口用 POST）。', group: '4xx' },
  { code: 409, label: 'Conflict', desc: '请求与服务器当前状态冲突。', group: '4xx' },
  { code: 410, label: 'Gone', desc: '资源已永久删除（区别于 404）。', group: '4xx' },
  { code: 413, label: 'Payload Too Large', desc: '请求体过大，服务器拒绝处理。', group: '4xx' },
  { code: 415, label: 'Unsupported Media Type', desc: '请求体的媒体类型不受支持。', group: '4xx' },
  { code: 422, label: 'Unprocessable Entity', desc: '语法正确但语义错误，无法处理（常用于参数校验失败）。', group: '4xx' },
  { code: 429, label: 'Too Many Requests', desc: '请求过于频繁，超出速率限制。', group: '4xx' },
  { code: 500, label: 'Internal Server Error', desc: '服务器内部错误，未指明具体原因。', group: '5xx' },
  { code: 501, label: 'Not Implemented', desc: '服务器不支持该请求方法。', group: '5xx' },
  { code: 502, label: 'Bad Gateway', desc: '网关或代理从上游收到无效响应。', group: '5xx' },
  { code: 503, label: 'Service Unavailable', desc: '服务暂不可用（过载或维护中）。', group: '5xx' },
  { code: 504, label: 'Gateway Timeout', desc: '网关或代理等待上游响应超时。', group: '5xx' },
]

const GROUP_INFO: Record<HttpStatus['group'], { label: string; badge: string }> = {
  '1xx': { label: '信息响应', badge: 'bg-sky-500/15 text-sky-600 dark:text-sky-400' },
  '2xx': { label: '成功', badge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
  '3xx': { label: '重定向', badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-400' },
  '4xx': { label: '客户端错误', badge: 'bg-orange-500/15 text-orange-600 dark:text-orange-400' },
  '5xx': { label: '服务器错误', badge: 'bg-rose-500/15 text-rose-600 dark:text-rose-400' },
}

const groupOrder: HttpStatus['group'][] = ['1xx', '2xx', '3xx', '4xx', '5xx']

const query = ref('')
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return STATUSES
  return STATUSES.filter(
    s =>
      String(s.code).includes(q) ||
      s.label.toLowerCase().includes(q) ||
      s.desc.toLowerCase().includes(q) ||
      GROUP_INFO[s.group].label.includes(q),
  )
})

const grouped = computed(() =>
  groupOrder
    .map(g => ({ group: g, items: filtered.value.filter(s => s.group === g) }))
    .filter(g => g.items.length > 0),
)
</script>

<template>
  <ToolLayout>
    <div class="space-y-4">
      <div class="relative max-w-md">
        <Search class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input v-model="query" class="pl-9" placeholder="搜索状态码或名称，如 404 / not found / 服务器错误" />
      </div>

      <div v-for="g in grouped" :key="g.group" class="space-y-2">
        <div class="flex items-center gap-2">
          <h3 class="text-sm font-semibold">{{ g.group }} {{ GROUP_INFO[g.group].label }}</h3>
          <Badge class="text-[10px] font-normal" :class="GROUP_INFO[g.group].badge">{{ g.items.length }}</Badge>
        </div>
        <div class="grid gap-2 md:grid-cols-2">
          <div
            v-for="s in g.items"
            :key="s.code"
            class="flex items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/40"
          >
            <span class="w-10 shrink-0 font-mono text-lg font-bold tabular-nums">{{ s.code }}</span>
            <div class="min-w-0">
              <p class="truncate text-sm font-medium">{{ s.label }}</p>
              <p class="mt-0.5 text-xs leading-relaxed text-muted-foreground">{{ s.desc }}</p>
            </div>
          </div>
        </div>
      </div>

      <p v-if="filtered.length === 0" class="py-8 text-center text-sm text-muted-foreground">没有匹配的状态码</p>
    </div>
  </ToolLayout>
</template>