//+ useSSE Hook：管理 SSE 连接生命周期
//+ 已登录时自动建立连接，登出时断开
//+ 监听 SSE 事件并 dispatch 到 Redux store
//+ 事件分发逻辑：
//+   1. 非消息页 → 刷新未读数 + 弹出全局弹窗
//+   2. 消息页当前 tab 匹配 → 刷新未读数 + 显示提示条
//+   3. 消息页 tab 不匹配 → 仅刷新未读数
import { useEffect, useRef, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  connectSSE,
  disconnectSSE,
  ensureSSEConnection,
  onSSEEvent,
  onSSEReconnect
} from '@/utils/sse'
import { getToken, isLoggedIn } from '@/utils/token'
import Taro from '@tarojs/taro'
import type { RootState, AppDispatch } from '@/store'
import {
  fetchUnreadCount,
  showToast,
  clearToastCooldown,
  updateUnreadFromSSE,
  handleSSEEvent,
  SSE_EVENT,
  INTERACTION_EVENTS,
  SYSTEM_EVENTS,
  type MessageTab,
  type SSEEventName,
  type SSEMessagePayload
} from '@/store/modules/message'

//+ 判断当前是否在消息页面
//+ 返回值 + 判断依据，方便排查"非消息页不弹窗"问题
function isOnMessagePage(): { onMessagePage: boolean; reason: string } {
  //+ 优先用 Taro 页面栈判断
  try {
    const pages = Taro.getCurrentPages()
    if (pages.length > 0) {
      const route = pages[pages.length - 1]?.route || ''
      const onMessagePage = route.toLowerCase().includes('message')
      return { onMessagePage, reason: `Taro页面栈 route="${route}"` }
    }
  } catch {
    // ignore，走降级
  }
  //+ 降级：用 window.location.pathname 判断
  if (typeof window !== 'undefined' && window.location) {
    const path = window.location.pathname.toLowerCase()
    const onMessagePage = path.includes('message')
    return { onMessagePage, reason: `window.location.pathname="${path}"` }
  }
  return { onMessagePage: false, reason: '无法获取页面栈和 location' }
}

//+ 根据事件类型判断属于互动消息还是系统通知
function eventToTab(event: SSEEventName): MessageTab {
  if (INTERACTION_EVENTS.includes(event)) return 'interaction'
  if (SYSTEM_EVENTS.includes(event)) return 'system'
  //+ comment-reply 归入互动 tab
  return 'interaction'
}

//+ useSSE Hook
export function useSSE() {
  const dispatch = useDispatch<AppDispatch>()
  const currentTab = useSelector((state: RootState) => state.message.currentTab)
  const toastCooldownRef = useRef(false)
  //+ 用 ref 持有最新的 handleSSEMessage，避免 onSSEEvent 闭包永远拿到第一次的函数
  const handleSSEMessageRef = useRef<typeof handleSSEMessage>(() => {})

  //+ 处理 SSE 消息（对齐推送顺序：先消息事件，再 unread）
  const handleSSEMessage = useCallback((event: SSEEventName, data: Record<string, any>) => {
    console.log('[useSSE] 处理事件:', event, data)
    //+ unread 事件：直接更新未读数
    if (event === SSE_EVENT.UNREAD) {
      if (data && typeof data.total === 'number') {
        dispatch(updateUnreadFromSSE({
          total: data.total,
          interactions: data.interactions ?? 0,
          system: data.system ?? 0
        }))
        console.log('[useSSE] unread 事件已更新 store')
      }
      return
    }

    //+ 其他事件：消息事件（like/follow/comment/collect/signup/...）
    const messagePayload: SSEMessagePayload = { event, data }
    const tab = eventToTab(event)

    //+ 判断当前是否在消息页面（带判断依据，便于排查）
    const { onMessagePage, reason } = isOnMessagePage()
    console.log('[useSSE] 是否在消息页:', onMessagePage, '| 判断依据:', reason, '| tab:', tab)

    if (!onMessagePage) {
      //+ 场景1：非消息页 → 弹出全局弹窗
      const content = data.content || '收到一条新消息'
      console.log('[useSSE] 非消息页，准备弹窗:', content)
      dispatch(showToast({ content, tab }))
      //+ 防抖冷却：3 秒后允许下次弹窗
      toastCooldownRef.current = true
      setTimeout(() => {
        dispatch(clearToastCooldown())
        toastCooldownRef.current = false
      }, 3000)
    } else {
      //+ 场景2：在消息页 → 判断 tab
      //+ currentTab: 0=互动, 1=系统通知
      const expectedTabIndex = tab === 'interaction' ? 0 : 1
      if (expectedTabIndex === currentTab) {
        //+ 分支2.1：当前 tab 匹配 → 显示提示条
        console.log('[useSSE] 消息页 tab 匹配，触发提示条')
        dispatch(handleSSEEvent(messagePayload))
      } else {
        console.log('[useSSE] 消息页 tab 不匹配，忽略（仅已由 unread 事件更新未读数）')
      }
      //+ 分支2.2：tab 不匹配 → 只更新未读数（已在 unread 事件处理中完成）
      //+ 此处不再做额外操作
    }
  }, [dispatch, currentTab])

  //+ 每次 handleSSEMessage 重建时同步到 ref
  handleSSEMessageRef.current = handleSSEMessage

  //+ 弹窗防抖：收到非 unread 事件时延迟判断是否弹窗
  useEffect(() => {
    //+ 1. 已登录时建立 SSE 连接
    const token = getToken()
    if (token) {
      connectSSE(token)
    }

    //+ 2. 监听 token 变化：
    //+    登出 → 断开连接；
    //+    登录 → 补建连接（登录走 SPA 路由，App 不会重新挂载，首次挂载时无 token 就不会建连）
    //+    断线且不在重连等待中 → 由 ensureSSEConnection 兜底恢复
    const checkTokenInterval = setInterval(() => {
      const token = getToken()
      if (!token) {
        disconnectSSE()
        return
      }
      ensureSSEConnection(token)
    }, 2000)

    //+ 3. 注册 SSE 事件处理器（始终调用 ref 里最新的 handleSSEMessage）
    const offEvent = onSSEEvent((event, data) => {
      handleSSEMessageRef.current(event as SSEEventName, data)
    })

    //+ 4. 注册重连成功处理器（仅刷新未读数）
    const offReconnect = onSSEReconnect(() => {
      if (isLoggedIn()) {
        console.log('[useSSE] 重连成功，刷新未读数')
        dispatch(fetchUnreadCount())
      }
    })

    return () => {
      clearInterval(checkTokenInterval)
      offEvent()
      offReconnect()
      disconnectSSE()
    }
  }, [dispatch])
}
