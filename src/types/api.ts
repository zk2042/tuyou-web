//+ API 协议域类型：枚举/常量/映射、分页响应、请求/响应 DTO、统一响应结构
//+ 不包含任何业务实体（实体放 entity.ts）
import type { ActivityListItem } from './entity'

//+ 用户角色：member=普通会员，leader=领队
export type UserRole = 'member' | 'leader'

//+ 分类ID→名称映射（后端返回数字ID，前端映射为中文）
export const CATEGORY_MAP: Record<number, string> = {
  1: '徒步',
  2: '露营',
  3: '骑行',
  4: '登山',
  5: '跑步',
  6: '攀岩',
  7: '溯溪',
}

//+ 根据分类ID获取名称
export function getCategoryName(categoryId?: number): string {
  if (!categoryId) return ''
  return CATEGORY_MAP[categoryId] || ''
}

//+ 分页响应数据结构（通用）
//+ total_page 可选：真实后端只返回 total+size，需前端自行计算；Mock 会返回 total_page
//+ totalComments 可选：评论列表专用，含二级回复的评论总数（区别于 total=一级评论数）
export interface PageResult<T> {
  list: T[]
  total: number
  page: number
  size: number
  total_page?: number
  //+ 评论列表专用：含二级回复的评论总数（后端返回，用于评论区标题展示真实总数）
  totalComments?: number
}

//+ 活动列表分页响应 data 结构（调用方 import ActivityListResult from '@/types' 时保持一致）
export interface ActivityListResult extends PageResult<ActivityListItem> {}

//+ 个人主页信息（GET /personal 返回）
export interface ProfileInfo {
  id: string
  nickname: string
  avatar: string
  bio: string
  bgImg: string
  publishCount: number
  followCount: number
  fansCount: number
}

//+ 编辑个人信息请求参数（PUT /personal body）
export interface ProfileUpdate {
  avatar: string
  nickname: string
  bio: string
  bgImg: string
}

//+ 统一响应数据结构
//+ 注：请求封装层（utils/request）也有同名 ResponseData<T>，二者结构一致；
//+     如需在调用方与 request.ts 共用此结构，可直接 import ApiResponse 并重命名为 ResponseData。
export interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
}

// ========== 评论模块协议域 ==========

//+ 评论目标类型常量：1=笔记，2=攻略
export const COMMENT_TARGET_TYPE = {
  NOTE: 1,
  GUIDE: 2
} as const

//+ 后端评论 DTO（对齐接口文档字段：user/replyToNickname/replyCount）
//+ 前端 Comment 实体使用 member/replyToName，由 apis/comment.ts 适配器转换
export interface CommentUserDTO {
  id: string
  nickname: string
  avatar: string
}
export interface CommentDTO {
  id: string
  user: CommentUserDTO
  content: string
  likeCount: number
  isLiked: boolean
  //+ 一级评论为空字符串，二级评论为一级评论 ID
  replyToId: string | ''
  //+ 一级评论为空字符串，二级评论为被回复用户昵称
  replyToNickname: string | ''
  createdAt: string
  //+ 一级评论才有：二级评论总数
  replyCount?: number
  //+ 一级评论才有：热度最高的二级评论（最多2条）
  replies?: CommentDTO[]
  canDelete: boolean
}

//+ 评论列表分页响应（data 结构）
export interface CommentListResult extends PageResult<CommentDTO> {}

//+ 发表评论请求参数
//+ 文档要求 targetId 为 integer，replyToId、replyToMemberId、parentId 均使用 number
export interface CreateCommentParams {
  targetType: number
  targetId: number
  content: string
  //+ 被回复的一级评论 ID；空=一级评论
  replyToId?: number
  //+ 被回复的用户 ID；回复二级评论时必传
  replyToMemberId?: number
}

//+ 评论列表查询参数
export interface CommentQueryParams {
  targetType: number
  targetId: number
  page: number
  size: number
}

//+ 二级评论列表查询参数
export interface CommentRepliesQueryParams {
  parentId: number
  page: number
  size: number
}

// ========== 消息模块协议域 ==========

//+ 消息发送者 DTO（对齐接口文档 sender 字段；系统消息 sender 可为 null）
export interface MessageSenderDTO {
  id: string
  nickname: string
  avatar: string
}

//+ 消息回复 DTO（互动消息 comment.replies 数组项，后端字段）
export interface MessageReplyDTO {
  commentId: string
  //+ 'me'=我发出的回复，'you'=对方发给我的
  sender: 'me' | 'you'
  content: string
  sendTime?: string
  likeCount?: number
  isLiked?: boolean
  replies?: MessageReplyDTO[] | null
}

//+ 消息评论 DTO（互动消息 comment 字段，后端字段）
export interface MessageCommentDTO {
  commentId: string
  sender: 'me' | 'you'
  content: string
  sendTime?: string
  likeCount?: number
  isLiked?: boolean
  replies?: MessageReplyDTO[] | null
}

//+ 消息 DTO（对齐 GET /messages/interactions 和 GET /messages/system 响应项）
//+ 互动消息和系统消息共用此结构，通过 msgType 区分
//+ msgType: 1=互动消息（点赞/收藏/关注/评论），2=系统通知
export interface MessageDTO {
  id: string
  msgType: number
  content: string
  sendTime: string
  isRead: number
  sender: MessageSenderDTO | null
  //+ 评论类互动消息携带的评论+回复数据（其他类型为 null）
  comment?: MessageCommentDTO | null
}

//+ 消息列表分页响应（data 结构）
export interface MessageListResult extends PageResult<MessageDTO> {}

//+ 未读消息数响应（GET /messages/unread-count data 结构）
export interface UnreadCountResult {
  total: number
  interactions: number
  system: number
}

//+ 消息回复响应（POST /messages/interactions/{id}/reply data 结构）
export interface MessageReplyResult {
  id: string
  replyToId: string
  content: string
  sendTime: string
}

//+ 全部已读响应（PUT /messages/read-all data 结构）
export interface MarkAllReadResult {
  updated: number
}
