//+ 消息模块 Redux 状态管理
//+ 全链路：fetchInteractions / loadMoreInteractions / fetchSystemMessages / loadMoreSystemMessages
//+         fetchUnreadCount / markMessageRead / markAllMessagesRead / replyInteraction / deleteMessage
//+         + SSE 推送：showToast / hideToast / showNewMessageTip / setCurrentTab / handleSSEMessage
//+ 设计：store 作为单一数据源，Message 页面通过 useSelector 读取列表和未读数
//+       未读数由 API 驱动（fetchUnreadCount），标记已读后同步更新
//+       TabList 依赖 state.message.unreadTotal 显示红点
//+       SSE 推送不直接刷新列表，只更新未读数 + 弹框/提示条，列表由用户主动行为触发
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import {
  getInteractionsAPI,
  getSystemMessagesAPI,
  getUnreadCountAPI,
  markMessageReadAPI,
  markAllMessagesReadAPI,
  replyInteractionAPI,
  deleteMessageAPI
} from '@/apis/message'
import type { InteractionMessage, SystemMessage, PageResult, MessageReplyResult } from '@/types'

//+ 消息 tab 类型（用于 markMessageRead / markAllMessagesRead / deleteMessage 区分列表）
export type MessageTab = 'interaction' | 'system'

//+ SSE 事件类型（对齐接口文档事件分类表）
export const SSE_EVENT = {
  LIKE: 'like',
  COMMENT_LIKE: 'comment-like',
  FOLLOW: 'follow',
  COMMENT: 'comment',
  COMMENT_REPLY: 'comment-reply',
  COLLECT: 'collect',
  SIGNUP: 'signup',
  SIGNUP_SUCCESS: 'signup-success',
  ACTIVITY_START: 'activity-start',
  ACTIVITY_DELETED: 'activity-deleted',
  CONTENT_DELETED: 'content-deleted',
  CONTENT_OFFLINE: 'content-offline',
  UNREAD: 'unread',
} as const

export type SSEEventName = typeof SSE_EVENT[keyof typeof SSE_EVENT]

//+ 互动类 SSE 事件（msgType=1）与系统类事件（msgType=2）的区分
export const INTERACTION_EVENTS: SSEEventName[] = [
  'like', 'comment-like', 'follow', 'comment', 'comment-reply', 'collect'
]

export const SYSTEM_EVENTS: SSEEventName[] = [
  'signup', 'signup-success', 'activity-start', 'activity-deleted', 'content-deleted', 'content-offline'
]

//+ SSE 推送数据格式（对齐接口文档）
//+ 普通消息：{ content, senderId }
//+ 回复评论：{ replyId, replyToId, content, senderId }
//+ 未读数：{ total, interactions, system }
export interface SSEMessagePayload {
  event: SSEEventName
  data: Record<string, any>
}

//+ 消息模块状态
export interface MessageState {
  //+ 互动消息列表
  interactionList: InteractionMessage[]
  interactionPage: number
  interactionSize: number
  interactionTotal: number
  interactionTotalPage: number
  interactionHasMore: boolean
  interactionLoading: boolean
  interactionLoadingMore: boolean
  //+ 系统通知列表
  systemList: SystemMessage[]
  systemPage: number
  systemSize: number
  systemTotal: number
  systemTotalPage: number
  systemHasMore: boolean
  systemLoading: boolean
  systemLoadingMore: boolean
  //+ 未读数（TabList 依赖 unreadTotal 显示红点）
  unreadTotal: number
  interactionUnread: number
  systemUnread: number
  //+ 错误信息
  error: string | null
  //+ ========== SSE 相关状态 ==========
  //+ 当前消息页面 tab（0=互动 1=系统通知），用于 SSE 场景2判断
  currentTab: number
  //+ 全局弹窗（场景1：非消息页收到新消息）
  toastVisible: boolean
  toastContent: string
  toastTab: MessageTab
  //+ 弹窗防抖冷却中（冷却期间收到新消息只更新内容，不重复弹窗）
  toastCooldown: boolean
  //+ 消息页内新消息提示条（场景2.1：当前 tab 收到同类型新消息）
  showNewMessageTip: boolean
  //+ 弹窗跳转目标 tab（用于 Message 页面挂载时跳转）
  pendingJumpTab: number | null
}

//+ 初始状态
const initialState: MessageState = {
  interactionList: [],
  interactionPage: 1,
  interactionSize: 10,
  interactionTotal: 0,
  interactionTotalPage: 0,
  interactionHasMore: false,
  interactionLoading: false,
  interactionLoadingMore: false,
  systemList: [],
  systemPage: 1,
  systemSize: 10,
  systemTotal: 0,
  systemTotalPage: 0,
  systemHasMore: false,
  systemLoading: false,
  systemLoadingMore: false,
  unreadTotal: 0,
  interactionUnread: 0,
  systemUnread: 0,
  error: null,
  currentTab: 0,
  toastVisible: false,
  toastContent: '',
  toastTab: 'interaction',
  toastCooldown: false,
  showNewMessageTip: false,
  pendingJumpTab: null,
}

// ==================== 异步 Thunks ====================

//+ 获取互动消息列表（首页，重置列表）
export const fetchInteractions = createAsyncThunk(
  'message/fetchInteractions',
  async (args: { page?: number; size?: number }, { rejectWithValue }) => {
    try {
      const res = await getInteractionsAPI({
        page: args.page ?? 1,
        size: args.size ?? 10
      })
      if (res.code === 0 || res.code === 200) {
        return res.data
      }
      return rejectWithValue(res.message || '获取互动消息失败')
    } catch (error: any) {
      return rejectWithValue(error?.message || '网络错误')
    }
  }
)

//+ 加载更多互动消息（下一页，追加）
export const loadMoreInteractions = createAsyncThunk(
  'message/loadMoreInteractions',
  async (_, { getState, rejectWithValue }) => {
    const state = (getState() as { message: MessageState }).message
    const { interactionPage, interactionSize } = state
    try {
      const res = await getInteractionsAPI({
        page: interactionPage + 1,
        size: interactionSize
      })
      if (res.code === 0 || res.code === 200) {
        return res.data
      }
      return rejectWithValue(res.message || '加载更多失败')
    } catch (error: any) {
      return rejectWithValue(error?.message || '网络错误')
    }
  }
)

//+ 获取系统通知列表（首页，重置列表）
export const fetchSystemMessages = createAsyncThunk(
  'message/fetchSystemMessages',
  async (args: { page?: number; size?: number }, { rejectWithValue }) => {
    try {
      const res = await getSystemMessagesAPI({
        page: args.page ?? 1,
        size: args.size ?? 10
      })
      if (res.code === 0 || res.code === 200) {
        return res.data
      }
      return rejectWithValue(res.message || '获取系统通知失败')
    } catch (error: any) {
      return rejectWithValue(error?.message || '网络错误')
    }
  }
)

//+ 加载更多系统通知（下一页，追加）
export const loadMoreSystemMessages = createAsyncThunk(
  'message/loadMoreSystemMessages',
  async (_, { getState, rejectWithValue }) => {
    const state = (getState() as { message: MessageState }).message
    const { systemPage, systemSize } = state
    try {
      const res = await getSystemMessagesAPI({
        page: systemPage + 1,
        size: systemSize
      })
      if (res.code === 0 || res.code === 200) {
        return res.data
      }
      return rejectWithValue(res.message || '加载更多失败')
    } catch (error: any) {
      return rejectWithValue(error?.message || '网络错误')
    }
  }
)

//+ 获取未读消息数（app.tsx launch 时调用，Message 页面也可刷新）
export const fetchUnreadCount = createAsyncThunk(
  'message/fetchUnreadCount',
  async (_, { rejectWithValue }) => {
    try {
      const res = await getUnreadCountAPI()
      if (res.code === 0 || res.code === 200) {
        return res.data
      }
      return rejectWithValue(res.message || '获取未读数失败')
    } catch (error: any) {
      return rejectWithValue(error?.message || '网络错误')
    }
  }
)

//+ 标记单条消息已读
//+ tab: 'interaction' | 'system'，用于更新对应列表的 read 状态和未读数
export const markMessageRead = createAsyncThunk(
  'message/markMessageRead',
  async (args: { id: string; tab: MessageTab }, { rejectWithValue }) => {
    try {
      const res = await markMessageReadAPI(args.id)
      if (res.code === 0 || res.code === 200) {
        return { id: args.id, tab: args.tab }
      }
      return rejectWithValue(res.message || '标记已读失败')
    } catch (error: any) {
      return rejectWithValue(error?.message || '网络错误')
    }
  }
)

//+ 标记全部消息已读
//+ tab: 'interaction' | 'system'，用于清空对应 tab 的未读数
export const markAllMessagesRead = createAsyncThunk(
  'message/markAllMessagesRead',
  async (args: { tab: MessageTab }, { rejectWithValue }) => {
    try {
      const res = await markAllMessagesReadAPI()
      if (res.code === 0 || res.code === 200) {
        return { tab: args.tab, updated: (res.data as { updated?: number })?.updated ?? 0 }
      }
      return rejectWithValue(res.message || '标记全部已读失败')
    } catch (error: any) {
      return rejectWithValue(error?.message || '网络错误')
    }
  }
)

//+ 回复互动消息（评论回复）
//+ 返回 { id, replyToId, content, sendTime }，用于更新对应消息的 replies 数组
export const replyInteraction = createAsyncThunk(
  'message/replyInteraction',
  async (args: { id: string; content: string }, { rejectWithValue }) => {
    try {
      const res = await replyInteractionAPI(args.id, args.content)
      if (res.code === 0 || res.code === 200) {
        //+ 带 args.content 兜底：后端返回的 reply.content 可能因 data 结构不一致而为 undefined
        return { messageId: args.id, reply: res.data, content: args.content }
      }
      return rejectWithValue(res.message || '回复失败')
    } catch (error: any) {
      return rejectWithValue(error?.message || '网络错误')
    }
  }
)

//+ 删除消息
//+ tab: 'interaction' | 'system'，用于从对应列表中移除 + 同步未读数
export const deleteMessage = createAsyncThunk(
  'message/deleteMessage',
  async (args: { id: string; tab: MessageTab }, { rejectWithValue, getState }) => {
    const state = (getState() as { message: MessageState }).message
    //+ 记录删除前该消息是否为未读，用于 fulfilled 时同步未读数
    const wasUnread = (() => {
      if (args.tab === 'interaction') {
        const m = state.interactionList.find(m => m.id === args.id)
        return m ? !m.read : false
      } else {
        const m = state.systemList.find(m => m.id === args.id)
        return m ? !m.read : false
      }
    })()
    try {
      const res = await deleteMessageAPI(args.id)
      if (res.code === 0 || res.code === 200) {
        return { id: args.id, tab: args.tab, wasUnread }
      }
      return rejectWithValue(res.message || '删除失败')
    } catch (error: any) {
      return rejectWithValue(error?.message || '网络错误')
    }
  }
)

// ==================== Slice ====================

const messageSlice = createSlice({
  name: 'message',
  initialState,
  reducers: {
    //+ 重置消息状态（登出时调用，清空列表和未读数）
    resetMessageState(state) {
      state.interactionList = []
      state.interactionPage = 1
      state.interactionTotal = 0
      state.interactionTotalPage = 0
      state.interactionHasMore = false
      state.interactionLoading = false
      state.interactionLoadingMore = false
      state.systemList = []
      state.systemPage = 1
      state.systemTotal = 0
      state.systemTotalPage = 0
      state.systemHasMore = false
      state.systemLoading = false
      state.systemLoadingMore = false
      state.unreadTotal = 0
      state.interactionUnread = 0
      state.systemUnread = 0
      state.error = null
      state.toastVisible = false
      state.toastContent = ''
      state.toastCooldown = false
      state.showNewMessageTip = false
      state.pendingJumpTab = null
    },
    //+ 更新当前 tab（Message 页面切换 tab 时调用）
    setCurrentTab(state, action: PayloadAction<number>) {
      state.currentTab = action.payload
    },
    //+ 显示全局弹窗（场景1：非消息页收到新消息）
    showToast(state, action: PayloadAction<{ content: string; tab: MessageTab }>) {
      //+ 冷却中只更新内容，不重复弹窗
      if (state.toastCooldown) {
        console.log('[store/showToast] 冷却中，仅更新内容:', action.payload.content)
        state.toastContent = action.payload.content
        return
      }
      console.log('[store/showToast] 弹窗显示:', action.payload.content, 'tab:', action.payload.tab)
      state.toastVisible = true
      state.toastContent = action.payload.content
      state.toastTab = action.payload.tab
      state.toastCooldown = true
    },
    //+ 关闭全局弹窗（弹窗自动关闭或点击后关闭）
    hideToast(state) {
      state.toastVisible = false
    },
    //+ 弹窗冷却结束（2-3 秒后调用，允许下次弹窗）
    clearToastCooldown(state) {
      state.toastCooldown = false
    },
    //+ 显示消息页内新消息提示条（场景2.1）
    setShowNewMessageTip(state, action: PayloadAction<boolean>) {
      state.showNewMessageTip = action.payload
    },
    //+ 设置弹窗跳转目标 tab（弹窗点击跳转时使用）
    setPendingJumpTab(state, action: PayloadAction<number | null>) {
      state.pendingJumpTab = action.payload
    },
    //+ SSE 推送：直接更新未读数（不刷新列表，由用户主动行为触发）
    //+ 对齐接口文档：推送顺序为先消息事件，再 unread 事件
    //+ 此处处理 unread 事件
    updateUnreadFromSSE(state, action: PayloadAction<{ total: number; interactions: number; system: number }>) {
      state.unreadTotal = action.payload.total
      state.interactionUnread = action.payload.interactions
      state.systemUnread = action.payload.system
    },
    //+ SSE 推送：处理消息事件（非 unread）
    //+ 仅触发页面内提示逻辑，不修改列表数据
    handleSSEEvent(state, action: PayloadAction<SSEMessagePayload>) {
      const { event } = action.payload
      //+ 互动类事件 + 当前在消息页且 tab=0 → 显示提示条
      //+ 系统类事件 + 当前在消息页且 tab=1 → 显示提示条
      //+ 非当前 tab → 只更新未读数（在 updateUnreadFromSSE 中处理）
      const isInteraction = INTERACTION_EVENTS.includes(event)
      const isSystem = SYSTEM_EVENTS.includes(event)
      const expectedTab = isInteraction ? 0 : isSystem ? 1 : -1
      if (expectedTab === state.currentTab) {
        state.showNewMessageTip = true
      }
    },
  },
  extraReducers: (builder) => {
    builder
      //+ ==================== 互动消息列表 ====================
      .addCase(fetchInteractions.pending, (state) => {
        state.interactionLoading = true
        state.error = null
      })
      .addCase(fetchInteractions.fulfilled, (state, action: PayloadAction<PageResult<InteractionMessage>>) => {
        const { list, total, page, size, total_page } = action.payload
        state.interactionLoading = false
        state.interactionList = list
        state.interactionTotal = total
        state.interactionPage = page
        state.interactionSize = size
        state.interactionTotalPage = total_page || 0
        state.interactionHasMore = page < (total_page || 0)
      })
      .addCase(fetchInteractions.rejected, (state, action) => {
        state.interactionLoading = false
        state.error = action.payload as string
      })
      //+ 加载更多互动消息
      .addCase(loadMoreInteractions.pending, (state) => {
        state.interactionLoadingMore = true
      })
      .addCase(loadMoreInteractions.fulfilled, (state, action: PayloadAction<PageResult<InteractionMessage>>) => {
        const { list, page, total_page } = action.payload
        state.interactionList = [...state.interactionList, ...list]
        state.interactionPage = page
        state.interactionTotalPage = total_page || 0
        state.interactionHasMore = page < (total_page || 0)
        state.interactionLoadingMore = false
      })
      .addCase(loadMoreInteractions.rejected, (state, action) => {
        state.interactionLoadingMore = false
        state.error = action.payload as string
      })
      //+ ==================== 系统通知列表 ====================
      .addCase(fetchSystemMessages.pending, (state) => {
        state.systemLoading = true
        state.error = null
      })
      .addCase(fetchSystemMessages.fulfilled, (state, action: PayloadAction<PageResult<SystemMessage>>) => {
        const { list, total, page, size, total_page } = action.payload
        state.systemLoading = false
        state.systemList = list
        state.systemTotal = total
        state.systemPage = page
        state.systemSize = size
        state.systemTotalPage = total_page || 0
        state.systemHasMore = page < (total_page || 0)
      })
      .addCase(fetchSystemMessages.rejected, (state, action) => {
        state.systemLoading = false
        state.error = action.payload as string
      })
      //+ 加载更多系统通知
      .addCase(loadMoreSystemMessages.pending, (state) => {
        state.systemLoadingMore = true
      })
      .addCase(loadMoreSystemMessages.fulfilled, (state, action: PayloadAction<PageResult<SystemMessage>>) => {
        const { list, page, total_page } = action.payload
        state.systemList = [...state.systemList, ...list]
        state.systemPage = page
        state.systemTotalPage = total_page || 0
        state.systemHasMore = page < (total_page || 0)
        state.systemLoadingMore = false
      })
      .addCase(loadMoreSystemMessages.rejected, (state, action) => {
        state.systemLoadingMore = false
        state.error = action.payload as string
      })
      //+ ==================== 未读消息数 ====================
      .addCase(fetchUnreadCount.fulfilled, (state, action: PayloadAction<{ total: number; interactions: number; system: number }>) => {
        state.unreadTotal = action.payload.total
        state.interactionUnread = action.payload.interactions
        state.systemUnread = action.payload.system
      })
      //+ ==================== 标记单条已读 ====================
      .addCase(markMessageRead.fulfilled, (state, action: PayloadAction<{ id: string; tab: MessageTab }>) => {
        const { id, tab } = action.payload
        if (tab === 'interaction') {
          state.interactionList = state.interactionList.map(m =>
            m.id === id && !m.read ? { ...m, read: true, isRead: 1 } : m
          )
          if (state.interactionUnread > 0) state.interactionUnread -= 1
        } else {
          state.systemList = state.systemList.map(m =>
            m.id === id && !m.read ? { ...m, read: true, isRead: 1 } : m
          )
          if (state.systemUnread > 0) state.systemUnread -= 1
        }
        state.unreadTotal = state.interactionUnread + state.systemUnread
      })
      //+ ==================== 标记全部已读 ====================
      .addCase(markAllMessagesRead.fulfilled, (state) => {
        state.interactionList = state.interactionList.map(m => ({ ...m, read: true, isRead: 1 }))
        state.systemList = state.systemList.map(m => ({ ...m, read: true, isRead: 1 }))
        state.interactionUnread = 0
        state.systemUnread = 0
        state.unreadTotal = 0
      })
      //+ ==================== 回复互动消息 ====================
      .addCase(replyInteraction.fulfilled, (state, action: PayloadAction<{ messageId: string; reply: MessageReplyResult; content: string }>) => {
        const { messageId, reply, content } = action.payload
        //+ content 用 payload.content 兜底 reply.content（后端 data 结构可能不一致）
        const replyContent = reply.content || content
        state.interactionList = state.interactionList.map(m => {
          if (m.id !== messageId) return m
          const replies = m.replies || []
          return {
            ...m,
            replies: [...replies, { id: reply.id, sender: 'me' as const, content: replyContent }],
            replyCount: (m.replyCount || 0) + 1
          }
        })
      })
      //+ ==================== 删除消息（同步未读数） ====================
      .addCase(deleteMessage.fulfilled, (state, action: PayloadAction<{ id: string; tab: MessageTab; wasUnread: boolean }>) => {
        const { id, tab, wasUnread } = action.payload
        if (tab === 'interaction') {
          state.interactionList = state.interactionList.filter(m => m.id !== id)
          if (wasUnread && state.interactionUnread > 0) state.interactionUnread -= 1
        } else {
          state.systemList = state.systemList.filter(m => m.id !== id)
          if (wasUnread && state.systemUnread > 0) state.systemUnread -= 1
        }
        state.unreadTotal = state.interactionUnread + state.systemUnread
      })
  }
})

//+ 导出 Action
export const {
  resetMessageState,
  setCurrentTab,
  showToast,
  hideToast,
  clearToastCooldown,
  setShowNewMessageTip,
  setPendingJumpTab,
  updateUnreadFromSSE,
  handleSSEEvent,
} = messageSlice.actions

//+ 导出 Reducer
export default messageSlice.reducer
