//+ 评论模块API接口封装
//+ 对齐 docs/默认模块.md 接口文档：发表/列表/点赞/删除/二级评论加载更多
//+ 字段适配：后端 DTO 使用 user/replyToNickname，前端 Comment 实体使用 member/replyToName
//+           由 normalizeComment 在本层完成转换，store 与页面只感知 Comment 实体
import { get, post, del, type ResponseData } from '@/utils/request'
import type {
  Comment,
  PageResult,
  CommentDTO,
  CommentListResult,
  CreateCommentParams,
  CommentQueryParams,
  CommentRepliesQueryParams
} from '@/types'

//+ 适配器：后端 CommentDTO → 前端 Comment 实体
//+ user→member，replyToNickname→replyToName，空串→null
function normalizeComment(c: CommentDTO): Comment {
  return {
    id: c.id,
    member: { id: c.user.id, nickname: c.user.nickname, avatar: c.user.avatar },
    content: c.content,
    likeCount: c.likeCount,
    isLiked: c.isLiked,
    replyToId: c.replyToId || null,
    replyToName: c.replyToNickname || null,
    createdAt: c.createdAt,
    canDelete: c.canDelete,
    replyCount: c.replyCount,
    replies: c.replies ? c.replies.map(normalizeComment) : undefined
  }
}

//+ 发表评论（一级或回复）
//+ 返回适配后的 Comment（带真实 id，供页面追加到列表）
//+ 字段适配：String ID → Number（接口文档要求 targetId/replyToId/replyToMemberId 为 integer）
//+ 此处放宽参数类型为 number|string，内部统一 Number() 转换，保证 store/组件层继续用 string ID 也没问题
export async function createCommentAPI(params: Omit<CreateCommentParams, 'targetId' | 'replyToId' | 'replyToMemberId'> & {
  targetId: number | string
  replyToId?: number | string
  replyToMemberId?: number | string
}): Promise<ResponseData<Comment>> {
  const normalized: CreateCommentParams = {
    targetType: params.targetType,
    content: params.content,
    targetId: Number(params.targetId) || 0,
    ...(params.replyToId !== undefined && params.replyToId !== null
      ? { replyToId: Number(params.replyToId) || 0 }
      : {}),
    ...(params.replyToMemberId !== undefined && params.replyToMemberId !== null
      ? { replyToMemberId: Number(params.replyToMemberId) || 0 }
      : {})
  }
  const res = await post<CommentDTO>('/comments', normalized)
  return { ...res, data: normalizeComment(res.data) }
}

//+ 获取一级评论列表（分页）
//+ 展示规则由后端实现（前2条热评 + 其余按时间倒序），本层仅做分页与字段适配
//+ 字段适配：String ID → Number（接口文档要求 targetId 为 integer）
//+ signal：支持 AbortSignal，用于切换详情页时 abort 上一个未完成请求，防止旧 fulfilled 覆盖新数据
export async function getCommentsAPI(
  params: Omit<CommentQueryParams, 'targetId'> & { targetId: number | string },
  signal?: AbortSignal | null
): Promise<ResponseData<PageResult<Comment>>> {
  const normalized: CommentQueryParams = {
    targetType: params.targetType,
    targetId: Number(params.targetId) || 0,
    page: params.page,
    size: params.size
  }
  const res = await get<CommentListResult>('/comments', normalized, undefined, signal)
  const normalized_1: PageResult<Comment> = {
    ...res.data,
    list: res.data.list.map(normalizeComment)
  }
  return { ...res, data: normalized_1 }
}

//+ 点赞 / 取消点赞评论（切换式）
export function toggleCommentLikeAPI(id: string, signal?: AbortSignal | null) {
  return post(`/comments/like/${id}`, undefined, undefined, signal)
}

//+ 删除评论（软删除，一级评论删除时连带其下二级评论）
export function deleteCommentAPI(id: string) {
  return del(`/comments/${id}`)
}

//+ 获取二级评论列表（一级评论"展开"时加载更多）
//+ 排序规则由后端实现（前2条热度 + 其余时间倒序），列表项无嵌套 replies
//+ 字段适配：String ID → Number（接口文档要求 parentId 为 integer）
export async function getCommentRepliesAPI(params: Omit<CommentRepliesQueryParams, 'parentId'> & { parentId: number | string }): Promise<ResponseData<PageResult<Comment>>> {
  const res = await get<CommentListResult>(`/comments/replies/${Number(params.parentId) || 0}`, {
    page: params.page,
    size: params.size
  })
  const normalized: PageResult<Comment> = {
    ...res.data,
    list: res.data.list.map(normalizeComment)
  }
  return { ...res, data: normalized }
}
