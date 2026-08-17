//+ 消息模块API接口封装
//+ 对齐 docs/默认模块.md 接口文档：
//+   GET    /messages/interactions          获取互动消息列表（分页）
//+   GET    /messages/system                获取系统通知列表（分页）
//+   GET    /messages/unread-count          获取未读消息数
//+   PUT    /messages/{id}/read             标记单条消息已读
//+   PUT    /messages/read-all              标记全部消息已读
//+   POST   /messages/interactions/{id}/reply  回复互动消息（评论）
//+   DELETE /messages/{id}                  删除消息
//+ 字段适配：后端 MessageDTO（msgType/content/sendTime/isRead/sender）
//+           → 前端 InteractionMessage / SystemMessage 实体
//+           由 normalizeInteraction / normalizeSystem 在本层完成转换
//+           store 与页面只感知前端实体
import { get, post, put, del, type ResponseData } from '@/utils/request'
import type {
  InteractionMessage,
  SystemMessage,
  PageResult,
  MessageDTO,
  MessageListResult,
  UnreadCountResult,
  MessageReplyResult,
  MarkAllReadResult
} from '@/types'

//+ 互动消息类型关键词映射（从 content 文本中推导 type 字段）
//+ 优先级：comment > favorite > follow > like > 默认 like
//+ 判断互动消息类型：以 m.comment 是否为 null 为准（后端权威字段）
//+ - comment != null → 'comment'（评论/回复消息，有回复功能）
//+ - comment == null → 按 content 文本判断其他类型（赞/收藏/关注）
//+ 不再仅靠 content 文本判断，避免"赞了你的评论"被误判为 comment 类型
function deriveInteractionType(m: MessageDTO): InteractionMessage['type'] {
  if (m.comment != null) return 'comment'
  const content = m.content || ''
  if (content.includes('收藏')) return 'favorite'
  if (content.includes('关注')) return 'follow'
  if (content.includes('赞')) return 'like'
  return 'like'
}

//+ 从 content 中提取目标标题（《...》内的文本）
function extractTargetTitle(content: string): string {
  const match = content.match(/《([^》]+)》/)
  return match ? match[1] : ''
}

//+ 适配器：后端 MessageDTO → 前端 InteractionMessage 实体
//+ sender 为 null 时使用默认占位（互动消息理论上 sender 不为 null，做兜底）
//+ 评论类消息：解析 m.comment.replies 映射到 item.replies，replyCount 取 replies.length
function normalizeInteraction(m: MessageDTO): InteractionMessage {
  const sender = m.sender || { id: '', nickname: '匿名用户', avatar: '' }
  //+ 解析评论回复列表：后端 comment.replies → 前端 { id, sender, content }
  const commentReplies = m.comment?.replies
  const replies = Array.isArray(commentReplies)
    ? commentReplies.map(r => ({
        id: r.commentId,
        sender: r.sender,
        content: r.content
      }))
    : []
  return {
    id: m.id,
    //+ --- 文档字段（透传） ---
    msgType: m.msgType,
    content: m.content,
    sendTime: m.sendTime,
    isRead: m.isRead,
    sender: m.sender,
    //+ --- 前端兼容字段（适配层填充） ---
    type: deriveInteractionType(m),
    member: { id: sender.id, nickname: sender.nickname, avatar: sender.avatar },
    targetTitle: extractTargetTitle(m.content),
    createdAt: m.sendTime,
    read: m.isRead === 1,
    replyCount: replies.length,
    replies
  }
}

//+ 适配器：后端 MessageDTO → 前端 SystemMessage 实体
function normalizeSystem(m: MessageDTO): SystemMessage {
  return {
    id: m.id,
    //+ --- 文档字段（透传） ---
    msgType: m.msgType,
    content: m.content,
    sendTime: m.sendTime,
    isRead: m.isRead,
    sender: m.sender,
    //+ --- 前端兼容字段 ---
    type: 'system',
    createdAt: m.sendTime,
    read: m.isRead === 1
  }
}

//+ 获取互动消息列表（分页）
export async function getInteractionsAPI(params: {
  page: number
  size: number
}): Promise<ResponseData<PageResult<InteractionMessage>>> {
  const res = await get<MessageListResult>('/messages/interactions', params)
  const normalized: PageResult<InteractionMessage> = {
    ...res.data,
    list: res.data.list.map(normalizeInteraction)
  }
  return { ...res, data: normalized }
}

//+ 获取系统通知列表（分页）
export async function getSystemMessagesAPI(params: {
  page: number
  size: number
}): Promise<ResponseData<PageResult<SystemMessage>>> {
  const res = await get<MessageListResult>('/messages/system', params)
  const normalized: PageResult<SystemMessage> = {
    ...res.data,
    list: res.data.list.map(normalizeSystem)
  }
  return { ...res, data: normalized }
}

//+ 获取未读消息数
export function getUnreadCountAPI(): Promise<ResponseData<UnreadCountResult>> {
  return get<UnreadCountResult>('/messages/unread-count')
}

//+ 标记单条消息已读
export function markMessageReadAPI(id: string): Promise<ResponseData<Record<string, never>>> {
  return put(`/messages/${id}/read`)
}

//+ 标记全部消息已读
export function markAllMessagesReadAPI(): Promise<ResponseData<MarkAllReadResult>> {
  return put<MarkAllReadResult>('/messages/read-all')
}

//+ 回复互动消息（评论回复）
export function replyInteractionAPI(
  id: string,
  content: string
): Promise<ResponseData<MessageReplyResult>> {
  return post<MessageReplyResult>(`/messages/interactions/${id}/reply`, { content })
}

//+ 删除消息
export function deleteMessageAPI(id: string): Promise<ResponseData<Record<string, never>>> {
  return del(`/messages/${id}`)
}
