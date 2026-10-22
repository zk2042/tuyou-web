//+ SSE（Server-Sent Events）连接工具
//+ 基于 fetch + ReadableStream 实现，支持自定义 Authorization header
//+ （原生 EventSource 不支持自定义 header，后端要求 Authorization Bearer token）
//+
//+ 设计要点：
//+   1. 连接地址：/api/v1/messages/stream
//+   2. Token 传递：Authorization: Bearer <token> 请求头
//+   3. 自动重连：指数退避（1s → 2s → 4s → ... → 30s 上限）
//+   4. 消息解析：按 SSE 协议解析 event:/data: 行，支持多行 data
//+   5. 心跳处理：: 开头的注释行，忽略
//+   6. 重连成功回调：仅断线重连成功后触发（首次连接不触发），用于刷新未读数
//+   7. Mock 模式降级：用 setTimeout 模拟推送，避免真实连接
//+
//+ 数据格式（对齐接口文档）：
//+   普通消息：event:like/follow/comment/collect/signup/...
//+             data:{"content":"消息正文","senderId":123}
//+   回复评论：event:comment-reply
//+             data:{"replyId":456,"replyToId":123,"content":"回复内容","senderId":789}
//+   未读数：event:unread
//+           data:{"total":5,"interactions":4,"system":1}
//+   心跳：:ping（注释行，忽略）
import { getToken } from './token'
import { refreshAccessToken, handleUnauthorized } from './request'

export type SSEEventHandler = (event: string, data: Record<string, any>) => void
export type SSEReconnectHandler = () => void

//+ 全局状态
let abortController: AbortController | null = null
let isConnecting = false
let isConnected = false
let reconnectTimer: ReturnType<typeof setTimeout> | null = null
let reconnectDelay = 1000
const MAX_RECONNECT_DELAY = 30000
let eventHandlers: Set<SSEEventHandler> = new Set()
let reconnectHandlers: Set<SSEReconnectHandler> = new Set()
let currentToken: string | null = null
//+ 是否曾经成功连接过（用于区分"首次连接"与"断线重连"）
//+ 首次连接成功时不触发 reconnect 回调，避免与 app 启动/页面挂载重复请求未读数
let hasConnectedBefore = false
//+ 访问令牌过期后已连续刷新重连的次数，避免异常情况下无限循环
let authRefreshCount = 0

//+ Mock 模式下用 setTimeout 模拟 SSE 推送
let mockTimer: ReturnType<typeof setTimeout> | null = null
const isMock = process.env.TARO_APP_USE_MOCK === 'true'

//+ 获取 SSE 连接地址
function getStreamUrl(): string {
  const base = process.env.TARO_APP_API_BASE || 'http://localhost:84/api/v1'
  const cleanBase = base.replace(/\/api\/v1$/, '')
  return `${cleanBase}/api/v1/messages/stream`
}

//+ 解析一条完整的 SSE 消息（按空行分隔的块）
//+ 格式：event:xxx\ndata:{json}\n\n
//+ 容错：
//+   1. 归一化 \r\n 为 \n
//+   2. 每行 trim 前后空白（处理后端偶发的前导/尾随空格）
//+   3. 注释行同时支持半角冒号 :ping 和全角冒号 ：ping
function parseSSEChunk(chunk: string): { event: string; data: Record<string, any> } | null {
  //+ 归一化 Windows 换行
  const normalized = chunk.replace(/\r\n/g, '\n')
  const lines = normalized.split('\n')
  let event = 'message'
  const dataLines: string[] = []

  for (const rawLine of lines) {
    //+ trim 前后空白（处理后端可能的前导空格）
    const line = rawLine.trim()
    if (line.length === 0) continue

    //+ 忽略注释行（心跳 :ping / ：ping 都算）
    if (line.startsWith(':') || line.startsWith('：')) continue

    if (line.startsWith('event:')) {
      event = line.slice(6).trim()
    } else if (line.startsWith('data:')) {
      //+ data: 后面的内容（前缀已去掉，line 已整体 trim，再去开头可选空格）
      dataLines.push(line.slice(5).replace(/^\s/, ''))
    }
    //+ 其他不符合 SSE 协议的字段直接忽略
  }

  if (dataLines.length === 0) return null

  try {
    const dataStr = dataLines.join('\n')
    const data = JSON.parse(dataStr)
    console.log('[SSE] 解析成功:', { event, data })
    return { event, data }
  } catch (err) {
    console.warn('[SSE] data JSON 解析失败:', dataLines, err)
    return null
  }
}

//+ ==================== Mock 模式：模拟 SSE 推送 ====================
const MOCK_EVENTS = [
  { event: 'like', data: { content: '赞了你的笔记《千岛湖环线骑行攻略》', senderId: 101 } },
  { event: 'follow', data: { content: '关注了你', senderId: 102 } },
  { event: 'comment', data: { content: '你的《雨崩村徒步》收到了一条新评论：风景太美了', senderId: 103 } },
  { event: 'collect', data: { content: '收藏了你的攻略《青海湖自驾三日游》', senderId: 104 } },
  { event: 'comment-reply', data: { replyId: 501, replyToId: 123, content: '回复了你：谢谢分享', senderId: 105 } },
  { event: 'signup', data: { content: '你报名的活动《四姑娘山大峰攀登》将于 2026-08-20 开始', senderId: null } },
  { event: 'signup-success', data: { content: '你已成功报名活动《四姑娘山大峰攀登》', senderId: null } },
  { event: 'activity-start', data: { content: '活动《四姑娘山大峰攀登》2026-08-20 开始', senderId: null } },
  { event: 'content-deleted', data: { content: '你的笔记《已删除的笔记》已被删除', senderId: null } },
  { event: 'content-offline', data: { content: '你的攻略《违规攻略》已被下架', senderId: null } },
] as const

function startMockSSE(): void {
  if (mockTimer) return

  //+ 立即标记连接成功
  isConnecting = false
  isConnected = true
  reconnectDelay = 1000
  //+ 首次连接不触发 reconnect 回调，只有断线重连后才触发
  if (hasConnectedBefore) {
    reconnectHandlers.forEach(handler => {
      try {
        handler()
      } catch (e) {
        console.error('[SSE-Mock] reconnect handler error:', e)
      }
    })
  }
  hasConnectedBefore = true

  //+ 推送一次：先消息事件，300ms 后 unread 事件（对齐推送顺序）
  const pushOnce = () => {
    const randomEvent = MOCK_EVENTS[Math.floor(Math.random() * MOCK_EVENTS.length)]
    console.log('[SSE-Mock] 推送消息事件:', randomEvent.event)
    eventHandlers.forEach(handler => {
      try {
        handler(randomEvent.event, { ...randomEvent.data })
      } catch (e) {
        console.error('[SSE-Mock] handler error:', e)
      }
    })
    setTimeout(() => {
      const mockUnread = {
        total: Math.floor(Math.random() * 10) + 1,
        interactions: Math.floor(Math.random() * 7) + 1,
        system: Math.floor(Math.random() * 3) + 1,
      }
      console.log('[SSE-Mock] 推送 unread 事件:', mockUnread)
      eventHandlers.forEach(handler => {
        try {
          handler('unread', mockUnread)
        } catch (e) {
          console.error('[SSE-Mock] unread handler error:', e)
        }
      })
    }, 300)
  }

  //+ 10 秒后首次推送，之后每 20-40 秒随机推送
  const scheduleNext = () => {
    const delay = 20000 + Math.random() * 20000
    mockTimer = setTimeout(() => {
      pushOnce()
      scheduleNext()
    }, delay)
  }

  setTimeout(() => {
    pushOnce()
    scheduleNext()
  }, 10000)
}

function stopMockSSE(): void {
  if (mockTimer) {
    clearTimeout(mockTimer)
    mockTimer = null
  }
  isConnected = false
}

//+ ==================== 真实模式：fetch + ReadableStream ====================
//+ 用 fetch 建立 SSE 连接，支持 Authorization header
//+ 通过 ReadableStream 读取响应体，按空行分割消息块
async function connectRealSSE(token: string): Promise<void> {
  abortController = new AbortController()
  const url = getStreamUrl()

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream',
        'Authorization': `Bearer ${token}`,
        'Cache-Control': 'no-cache',
      },
      signal: abortController.signal,
    })

    //+ 访问令牌过期：刷新令牌后立即用新令牌重连（最多连续 2 次，避免异常循环）
    if (response.status === 401) {
      if (authRefreshCount >= 2) {
        handleUnauthorized()
        disconnectSSE()
        return
      }
      authRefreshCount += 1
      const newToken = await refreshAccessToken()
      if (!newToken) {
        handleUnauthorized()
        disconnectSSE()
        return
      }
      reconnectWithToken(newToken)
      return
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    if (!response.body) {
      throw new Error('响应体为空')
    }

    console.log('[SSE] 连接成功')
    isConnecting = false
    isConnected = true
    reconnectDelay = 1000
    authRefreshCount = 0
    //+ 首次连接不触发 reconnect 回调，只有断线重连后才触发
    if (hasConnectedBefore) {
      reconnectHandlers.forEach(handler => {
        try {
          handler()
        } catch (e) {
          console.error('[SSE] reconnect handler error:', e)
        }
      })
    }
    hasConnectedBefore = true

    //+ 读取流
    const reader = response.body.getReader()
    const decoder = new TextDecoder('utf-8')
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        console.log('[SSE] 流结束')
        break
      }

      buffer += decoder.decode(value, { stream: true })

      //+ 按空行（\n\n）分割消息块
      let separatorIndex: number
      while ((separatorIndex = buffer.indexOf('\n\n')) !== -1) {
        const chunk = buffer.slice(0, separatorIndex)
        buffer = buffer.slice(separatorIndex + 2)

        const parsed = parseSSEChunk(chunk)
        if (parsed) {
          //+ 调试：确认 handler 数量，避免被误清
          console.log('[SSE] 派发事件给 handlers, 当前数量:', eventHandlers.size, 'event:', parsed.event)
          if (eventHandlers.size === 0) {
            console.warn('[SSE] ⚠️ eventHandlers 为空！handler 未注册或被误清')
          }
          eventHandlers.forEach(handler => {
            try {
              handler(parsed.event, parsed.data)
            } catch (e) {
              console.error('[SSE] handler error:', e)
            }
          })
        }
      }
    }

    //+ 流正常结束，标记断开并尝试重连
    isConnected = false
    scheduleReconnect()
  } catch (error: any) {
    console.warn('[SSE] 连接错误:', error?.message || error)
    isConnecting = false
    isConnected = false
    //+ AbortError 是主动断开，不重连
    if (error?.name !== 'AbortError') {
      scheduleReconnect()
    }
  }
}

//+ 使用新令牌重建连接（不重置刷新计数，避免异常情况下无限刷新）
function reconnectWithToken(token: string): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  if (abortController) {
    try { abortController.abort() } catch (_) { /* ignore */ }
    abortController = null
  }
  currentToken = token
  isConnecting = true
  isConnected = false
  connectRealSSE(token)
}

//+ 调度重连（指数退避）
function scheduleReconnect(): void {
  if (reconnectTimer) return
  //+ 优先使用本地最新的访问令牌（可能已被刷新逻辑更新）
  const latestToken = getToken()
  if (latestToken) {
    currentToken = latestToken
  }
  if (!currentToken) return

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    if (currentToken) {
      connectSSE(currentToken)
    }
    //+ 指数退避
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY)
  }, reconnectDelay)
}

//+ 建立 SSE 连接
export function connectSSE(token: string): void {
  if (!token) return
  const latestToken = getToken() || token
  currentToken = latestToken

  //+ 关闭已存在的连接
  if (abortController || mockTimer) {
    disconnectSSE()
    //+ disconnectSSE 会清空 currentToken，重新设置
    currentToken = latestToken
  }

  //+ Mock 模式：用 setTimeout 模拟推送，不走真实连接
  if (isMock) {
    console.log('[SSE] Mock 模式启动模拟推送')
    startMockSSE()
    return
  }

  //+ 真实模式：fetch + ReadableStream
  isConnecting = true
  connectRealSSE(latestToken)
}

//+ 主动断开 SSE 连接
//+ 注意：不清理 eventHandlers / reconnectHandlers，它们的注册/注销由
//+ onSSEEvent / onSSEReconnect 返回的 off 函数管理（组件 unmount 时调用）
//+ 之前在这里 clear() 会导致 StrictMode 双调用场景下 handler 被误清，
//+ 表现为 SSE 连接成功、消息能解析，但 handler 不被调用（弹窗不出现）
export function disconnectSSE(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
  //+ Mock 模式清理
  stopMockSSE()
  //+ 真实模式清理：abort 请求
  if (abortController) {
    abortController.abort()
    abortController = null
  }
  isConnecting = false
  isConnected = false
  reconnectDelay = 1000
  //+ 重置首次连接标志：登出/主动断开后，下次连接视为首次连接
  hasConnectedBefore = false
  authRefreshCount = 0
  //+ 不清理 eventHandlers / reconnectHandlers：由 onSSEEvent/off 管理
  currentToken = null
}

//+ 注册事件处理器
export function onSSEEvent(handler: SSEEventHandler): () => void {
  eventHandlers.add(handler)
  return () => {
    eventHandlers.delete(handler)
  }
}

//+ 注册重连成功处理器
export function onSSEReconnect(handler: SSEReconnectHandler): () => void {
  reconnectHandlers.add(handler)
  return () => {
    reconnectHandlers.delete(handler)
  }
}

//+ 获取当前连接状态
export function getSSEState(): { connected: boolean; connecting: boolean } {
  return {
    connected: isConnected,
    connecting: isConnecting
  }
}
