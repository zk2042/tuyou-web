//+ 评论模块Redux状态管理
//+ 全链路：fetchComments(分页) / loadMoreComments / createComment / toggleCommentLike / deleteComment / fetchReplies
//+ 设计：store 作为单一数据源，CommentSection 通过 initData 同步展示；点赞/删除由组件乐观更新，store 在 fulfilled 后同步权威状态
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import {
  getCommentsAPI,
  createCommentAPI,
  toggleCommentLikeAPI,
  deleteCommentAPI,
  getCommentRepliesAPI
} from '@/apis/comment'
import type { Comment, PageResult, CreateCommentParams } from '@/types'
import { diffCommentLikes, type CommentLikePatch } from '@/utils/diffCommentLikes'

//+ 轮询结果类型：pollCommentUpdates.fulfilled 的 payload
interface CommentPollResult {
  patch: CommentLikePatch[]
  totalComments?: number
}

//+ 评论列表查询参数（fetchComments）
export interface FetchCommentsArgs {
  targetType: number
  targetId: string | number
  page?: number
  size?: number
}

//+ 二级评论查询参数（fetchReplies）
export interface FetchRepliesArgs {
  parentId: string
  page?: number
  size?: number
}

//+ 评论模块状态
export interface CommentState {
  //+ 当前评论目标（1=笔记，2=攻略）
  targetType: number | null
  targetId: string | null
  //+ 一级评论列表
  list: Comment[]
  total: number
  //+ 含二级回复的评论总数（后端返回，用于评论区标题展示真实总数）
  totalComments: number
  page: number
  size: number
  totalPage: number
  hasMore: boolean
  //+ 加载状态
  loading: boolean
  loadingMore: boolean
  sending: boolean
  error: string | null
  //+ 二级评论分页：parentId → 下一页页码 / 是否还有更多
  repliesPage: Record<string, number>
  repliesHasMore: Record<string, boolean>
  //+ 评论点赞乐观更新时间戳：commentId → 最近一次 toggleCommentLike.pending 的时间
  //+ 轮询 patch 时跳过 2s 内操作过的评论，避免覆盖乐观值导致 UI 闪烁
  lastLikedAt: Record<string, number>
}

//+ 初始状态
const initialState: CommentState = {
  targetType: null,
  targetId: null,
  list: [],
  total: 0,
  totalComments: 0,
  page: 1,
  size: 15,
  totalPage: 0,
  hasMore: false,
  loading: false,
  loadingMore: false,
  sending: false,
  error: null,
  repliesPage: {},
  repliesHasMore: {},
  lastLikedAt: {}
}

// ==================== 树操作工具（不可变）====================

//+ 在评论树中按 id 查找评论（一级或二级），供页面查找 replyToMemberId 使用
export function findCommentById(list: Comment[], id: string): Comment | undefined {
  for (const c of list) {
    if (c.id === id) return c
    if (c.replies?.length) {
      const found = c.replies.find(r => r.id === id)
      if (found) return found
    }
  }
  return undefined
}

//+ 不可变：更新树中指定 id 的评论（一级或二级）
function updateCommentInTree(list: Comment[], id: string, patch: Partial<Comment>): Comment[] {
  return list.map(c => {
    if (c.id === id) return { ...c, ...patch }
    if (c.replies?.length) {
      const idx = c.replies.findIndex(r => r.id === id)
      if (idx >= 0) {
        const newReplies = c.replies.slice()
        newReplies[idx] = { ...newReplies[idx], ...patch }
        return { ...c, replies: newReplies }
      }
    }
    return c
  })
}

//+ 不可变：从树中移除指定 id 的评论（一级连同其 replies 一并移除，二级仅移除自身）
function removeCommentFromTree(list: Comment[], id: string): Comment[] {
  const withoutFirst = list.filter(c => c.id !== id)
  if (withoutFirst.length !== list.length) return withoutFirst
  return list.map(c => {
    if (!c.replies?.length) return c
    const newReplies = c.replies.filter(r => r.id !== id)
    if (newReplies.length !== c.replies.length) {
      return {
        ...c,
        replies: newReplies,
        replyCount: Math.max(0, (c.replyCount ?? c.replies.length) - 1)
      }
    }
    return c
  })
}

//+ 不可变：向指定一级评论追加二级回复（按 id 去重，防止重复加载）
function appendRepliesToParent(list: Comment[], parentId: string, replies: Comment[]): Comment[] {
  return list.map(c => {
    if (c.id !== parentId) return c
    const existing = c.replies || []
    const existingIds = new Set(existing.map(r => r.id))
    const merged = [...existing, ...replies.filter(r => !existingIds.has(r.id))]
    return { ...c, replies: merged }
  })
}

// ==================== 异步 Thunks ====================

//+ 获取一级评论列表（首页，重置列表）
export const fetchComments = createAsyncThunk(
  'comment/fetchComments',
  async (args: FetchCommentsArgs, { rejectWithValue }) => {
    try {
      const res = await getCommentsAPI({
        targetType: args.targetType,
        targetId: args.targetId,
        page: args.page ?? 1,
        size: args.size ?? 15
      })
      if (res.code === 0 || res.code === 200) {
        return {
          ...res.data,
          targetType: args.targetType,
          targetId: String(args.targetId)
        }
      }
      return rejectWithValue(res.message || '获取评论失败')
    } catch (error: any) {
      return rejectWithValue(error?.message || '网络错误')
    }
  }
)

//+ 加载更多一级评论（下一页，追加）
export const loadMoreComments = createAsyncThunk(
  'comment/loadMoreComments',
  async (_, { getState, rejectWithValue }) => {
    const state = (getState() as { comment: CommentState }).comment
    const { targetType, targetId, page, size } = state
    if (!targetType || !targetId) return rejectWithValue('缺少评论目标')
    try {
      const res = await getCommentsAPI({
        targetType,
        targetId,
        page: page + 1,
        size: size || 15
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

//+ 发表评论（一级或回复），返回带真实 id 的 Comment
//+ reject 携带 { code, message }：组件层据 code 区分提示（如 2001=违禁词）
export const createComment = createAsyncThunk(
  'comment/createComment',
  async (args: CreateCommentParams, { rejectWithValue }) => {
    try {
      const res = await createCommentAPI(args)
      if (res.code === 0 || res.code === 200) {
        return res.data
      }
      return rejectWithValue({ code: res.code, message: res.message || '发表评论失败' })
    } catch (error: any) {
      //+ request.ts 在 code 非 0/200 时 reject(完整 ResponseData)
      //+ 透传后端的 code（如 2001=违禁词）和 message，让组件层能区分业务错误
      return rejectWithValue({
        code: typeof error?.code === 'number' ? error.code : -1,
        message: error?.message || '网络错误'
      })
    }
  }
)

//+ 点赞 / 取消点赞评论
//+ Pending 乐观翻转，Rejected 回滚，Fulfilled 用后端真实值校准
export const toggleCommentLike = createAsyncThunk(
  'comment/toggleCommentLike',
  async (id: string, { rejectWithValue, signal }) => {
    try {
      const res = await toggleCommentLikeAPI(id, signal)
      if (res.code === 0 || res.code === 200) {
        return { id, ...(res.data || {}) }
      }
      return rejectWithValue(res.message || '操作失败')
    } catch (error: any) {
      if (error?.name === 'AbortError') return rejectWithValue('aborted')
      return rejectWithValue(error?.message || '网络错误')
    }
  }
)

//+ 删除评论
export const deleteComment = createAsyncThunk(
  'comment/deleteComment',
  async (id: string, { rejectWithValue }) => {
    try {
      const res = await deleteCommentAPI(id)
      if (res.code === 0 || res.code === 200) {
        return { id }
      }
      return rejectWithValue(res.message || '删除失败')
    } catch (error: any) {
      return rejectWithValue(error?.message || '网络错误')
    }
  }
)

//+ 获取二级评论列表（展开加载更多），返回 { parentId, list, hasMore }
export const fetchReplies = createAsyncThunk(
  'comment/fetchReplies',
  async (args: FetchRepliesArgs, { getState, rejectWithValue }) => {
    const state = (getState() as { comment: CommentState }).comment
    const nextPage = args.page ?? ((state.repliesPage[args.parentId] ?? 1))
    try {
      const res = await getCommentRepliesAPI({
        parentId: args.parentId,
        page: nextPage,
        size: args.size ?? 10
      })
      if (res.code === 0 || res.code === 200) {
        const hasMore = res.data.page < (res.data.total_page || 0)
        return {
          parentId: args.parentId,
          list: res.data.list,
          page: res.data.page,
          hasMore
        }
      }
      return rejectWithValue(res.message || '获取回复失败')
    } catch (error: any) {
      return rejectWithValue(error?.message || '网络错误')
    }
  }
)

//+ 轮询：拉取当前页一级评论（自带 replies 前2条），与本地 diff 后只 patch likeCount 变化项
//+ 设计：
//+   1. 只请求当前 page 的一级评论，不单独请求二级"加载更多"页（权衡实时性 vs 流量）
//+   2. diff 只输出 likeCount 变化的项，reducer 跳过 2s 内有乐观更新的项
//+   3. totalComments 也顺带刷新（评论总数实时同步）
//+   4. 不替换整个 list，只改 likeCount 字段，引用最小化，UI 无抖动
export const pollCommentUpdates = createAsyncThunk(
  'comment/pollCommentUpdates',
  async (_, { getState, rejectWithValue }) => {
    const state = (getState() as { comment: CommentState }).comment
    //+ targetType/targetId 为空（未进入详情页）→ 不轮询
    if (state.targetType == null || !state.targetId) {
      return rejectWithValue('no target')
    }
    try {
      //+ 并发请求所有已加载的一级评论页（1 ~ state.page）
      //+ 之前只请求 state.page（当前页），导致前几页的 likeCount 变化轮询不到
      const pages = Array.from({ length: state.page }, (_, i) => i + 1)
      const results = await Promise.all(
        pages.map(page =>
          getCommentsAPI({
            targetType: state.targetType!,
            targetId: Number(state.targetId) || 0,
            page,
            size: state.size
          })
        )
      )
      //+ 任一页失败则整体失败（保持数据一致性）
      const failed = results.find(r => r.code !== 0 && r.code !== 200)
      if (failed) {
        return rejectWithValue(failed.message || 'poll failed')
      }
      //+ 合并所有页的评论列表，按页顺序拼接
      const allRemoteComments = results.flatMap(r => r.data.list)
      //+ diff 出 likeCount 变化项（一级 + 二级前2条都会比对）
      const patch = diffCommentLikes(state.list, allRemoteComments)
      //+ totalComments 每页都返回相同值，取第一页的即可
      return {
        patch,
        totalComments: results[0]?.data.totalComments
      }
    } catch (error: any) {
      return rejectWithValue(error?.message || '网络错误')
    }
  }
)

// ==================== Slice ====================

const commentSlice = createSlice({
  name: 'comment',
  initialState,
  reducers: {
    //+ 重置评论状态（切换目标/离开详情页时调用）
    resetComments(state) {
      state.list = []
      state.total = 0
      state.totalComments = 0
      state.page = 1
      state.totalPage = 0
      state.hasMore = false
      state.loading = false
      state.loadingMore = false
      state.sending = false
      state.error = null
      state.repliesPage = {}
      state.repliesHasMore = {}
      state.lastLikedAt = {}
    }
  },
  extraReducers: (builder) => {
    builder
      //+ 获取一级评论列表
      .addCase(fetchComments.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchComments.fulfilled, (state, action: PayloadAction<PageResult<Comment> & { targetType: number; targetId: string }>) => {
        const { list, total, totalComments, page, size, total_page, targetType, targetId } = action.payload
        state.loading = false
        state.list = list
        state.total = total
        //+ 评论总数（含二级回复）：后端返回则用，否则降级为一级 total
        state.totalComments = totalComments ?? total
        state.page = page
        state.size = size
        state.totalPage = total_page || 0
        state.hasMore = page < (total_page || 0)
        state.targetType = targetType
        state.targetId = targetId
        state.repliesPage = {}
        state.repliesHasMore = {}
      })
      .addCase(fetchComments.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      //+ 加载更多一级评论
      .addCase(loadMoreComments.pending, (state) => {
        state.loadingMore = true
      })
      .addCase(loadMoreComments.fulfilled, (state, action: PayloadAction<PageResult<Comment>>) => {
        const { list, page, total_page } = action.payload
        state.list = [...state.list, ...list]
        state.page = page
        state.totalPage = total_page || 0
        state.hasMore = page < (total_page || 0)
        state.loadingMore = false
      })
      .addCase(loadMoreComments.rejected, (state, action) => {
        state.loadingMore = false
        state.error = action.payload as string
      })
      //+ 发表评论
      .addCase(createComment.pending, (state) => {
        state.sending = true
      })
      .addCase(createComment.fulfilled, (state, action: PayloadAction<Comment>) => {
        state.sending = false
        const newComment = action.payload
        if (!newComment.replyToId) {
          //+ 一级评论 → 置顶
          state.list = [newComment, ...state.list]
        } else {
          //+ 二级回复 → 追加到对应一级评论，并更新 replyCount
          state.list = appendRepliesToParent(state.list, newComment.replyToId, [newComment])
          state.list = state.list.map(c => c.id === newComment.replyToId
            ? { ...c, replyCount: (c.replyCount ?? 0) + 1 }
            : c)
        }
      })
      .addCase(createComment.rejected, (state, action) => {
        state.sending = false
        //+ payload 现为 { code, message } 对象，取 message 存 error
        state.error = (action.payload as { code: number; message: string })?.message || '发表评论失败'
      })
      //+ 评论点赞：pending 乐观翻转，rejected 回滚，fulfilled 校准（同时支持一级/二级评论树）
      .addCase(toggleCommentLike.pending, (state, action) => {
        const id = action.meta.arg
        //+ 记录乐观更新时间，轮询 patch 时跳过 2s 内操作过的评论
        state.lastLikedAt[id] = Date.now()
        //+ 遍历树找目标，翻转 isLiked 与 likeCount
        const mutList = [...state.list]
        for (let i = 0; i < mutList.length; i++) {
          const c = mutList[i]
          if (c.id === id) {
            const isLiked = !c.isLiked
            mutList[i] = { ...c, isLiked, likeCount: (c.likeCount || 0) + (isLiked ? 1 : -1) }
            break
          }
          if (c.replies?.length) {
            const ridx = c.replies.findIndex(r => r.id === id)
            if (ridx >= 0) {
              const r = c.replies[ridx]
              const isLiked = !r.isLiked
              const newReplies = c.replies.slice()
              newReplies[ridx] = { ...r, isLiked, likeCount: (r.likeCount || 0) + (isLiked ? 1 : -1) }
              mutList[i] = { ...c, replies: newReplies }
              break
            }
          }
        }
        state.list = mutList
      })
      .addCase(toggleCommentLike.fulfilled, (state, action: PayloadAction<{ id: string; isLiked?: boolean; likeCount?: number }>) => {
        const { id, isLiked, likeCount } = action.payload
        const patch: Partial<Comment> = {}
        if (typeof isLiked === 'boolean') patch.isLiked = isLiked
        if (typeof likeCount === 'number') patch.likeCount = likeCount
        if (Object.keys(patch).length) {
          state.list = updateCommentInTree(state.list, id, patch)
        }
      })
      .addCase(toggleCommentLike.rejected, (state, action) => {
        if (action.payload === 'aborted') return
        //+ 回滚：再翻转一次
        const id = action.meta.arg
        const mutList = [...state.list]
        for (let i = 0; i < mutList.length; i++) {
          const c = mutList[i]
          if (c.id === id) {
            const isLiked = !c.isLiked
            mutList[i] = { ...c, isLiked, likeCount: (c.likeCount || 0) + (isLiked ? 1 : -1) }
            break
          }
          if (c.replies?.length) {
            const ridx = c.replies.findIndex(r => r.id === id)
            if (ridx >= 0) {
              const r = c.replies[ridx]
              const isLiked = !r.isLiked
              const newReplies = c.replies.slice()
              newReplies[ridx] = { ...r, isLiked, likeCount: (r.likeCount || 0) + (isLiked ? 1 : -1) }
              mutList[i] = { ...c, replies: newReplies }
              break
            }
          }
        }
        state.list = mutList
      })
      //+ 删除评论
      .addCase(deleteComment.fulfilled, (state, action: PayloadAction<{ id: string }>) => {
        state.list = removeCommentFromTree(state.list, action.payload.id)
      })
      //+ 加载更多二级评论
      .addCase(fetchReplies.fulfilled, (state, action: PayloadAction<{ parentId: string; list: Comment[]; page: number; hasMore: boolean }>) => {
        const { parentId, list, page, hasMore } = action.payload
        state.list = appendRepliesToParent(state.list, parentId, list)
        state.repliesPage[parentId] = page + 1
        state.repliesHasMore[parentId] = hasMore
      })
      //+ 轮询：只 patch likeCount 变化项 + 刷新 totalComments，不替换整个 list
      //+ 跳过 2s 内有 toggleCommentLike 操作的评论，避免覆盖乐观值
      .addCase(pollCommentUpdates.fulfilled, (state, action: PayloadAction<CommentPollResult>) => {
        const { patch, totalComments } = action.payload
        if (patch.length === 0) {
          //+ 无 likeCount 变化，只更新 totalComments（若后端有返回）
          if (typeof totalComments === 'number') state.totalComments = totalComments
          return
        }
        const now = Date.now()
        //+ 过滤掉 2s 内有乐观更新的评论
        const effectivePatch = patch.filter(p => {
          const ts = state.lastLikedAt[p.id]
          return !ts || (now - ts) > 2000
        })
        //+ 逐项 patch likeCount，复用 updateCommentInTree 保持引用最小化
        for (const p of effectivePatch) {
          state.list = updateCommentInTree(state.list, p.id, { likeCount: p.likeCount })
        }
        if (typeof totalComments === 'number') {
          state.totalComments = totalComments
        }
      })
  }
})

//+ 导出Action
export const { resetComments } = commentSlice.actions

//+ 导出Reducer
export default commentSlice.reducer
