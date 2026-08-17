//+ 评论区组件（评论列表 + 删除弹层 + 分页加载更多）
//+ 支持：两级评论展示、评论点赞、展开/收起、长按删除、一级评论分页、二级评论加载更多
//+ 数据源：store 作为单一数据源，通过 initData 同步展示；点赞/删除由组件乐观更新，失败回滚
//+ 点击"回复"按钮 → 通过 onRequestReply 回调通知父组件，父组件再调用 CommentInput（Popup 弹层）完成输入+提交
//+ 复用于笔记详情 (NoteDetail) 和攻略详情 (GuideDetail)，通过 props 传入内容类型与事件回调
import { useState, useMemo, useCallback, useEffect } from 'react'
import Taro, { useDidHide } from '@tarojs/taro'
import { View } from '@tarojs/components'
import { Button } from '@nutui/nutui-react'
import { ArrowDown, ArrowUp } from '@nutui/icons-react'
import { useSelector } from 'react-redux'
import type { RootState } from '@/store'
import Avatar from '@/components/Avatar'
import type { Comment } from '@/types/entity'
import './index.less'

// ==================== 对外 Props ====================

//+ 评论区对外参数，笔记/攻略详情通用
//+ contentId / contentType：标识当前内容（笔记/攻略），供日志/埋点使用
export interface CommentSectionProps {
  /** 内容ID */
  contentId: string
  /** 内容类型：note / guide，攻略详情直接传 'guide' 即可复用 */
  contentType: 'note' | 'guide'
  /** 评论列表（来自 store，组件同步展示；变化时整体替换） */
  initData?: Comment[]
  /** 是否还有更多一级评论可加载（控制底部"加载更多评论"按钮显隐） */
  hasMoreComments?: boolean
  /** 是否正在加载更多一级评论（控制按钮 loading 文案） */
  loadingMore?: boolean
  /** 加载更多一级评论；失败时 throw 触发提示 */
  onLoadMoreComments?: () => Promise<void> | void
  /** 加载某一级评论下的更多二级评论；返回是否还有更多，失败时 throw */
  onLoadMoreReplies?: (parentId: string) => Promise<{ hasMore: boolean }>
  /** 点击"回复"按钮时触发：父组件应收到后将 replyTarget 传入 CommentInput.replyTarget */
  onRequestReply?: (target: {
    parentCommentId: string | null
    replyToId: string | null
    replyToName: string | null
  }) => void
  /** 单条评论点赞回调（失败 throw 触发回滚） */
  onToggleCommentLike?: (commentId: string, nextLiked: boolean) => PromiseLike<void> | void
  /** 删除评论回调（失败 throw 触发回滚） */
  onDeleteComment?: (commentId: string) => PromiseLike<void> | void
}

// ==================== 时间格式化（与文档 4.5 规则一致）====================
//+ 接受后端 "2026-07-31 10:00:00" 格式字符串，或 10位秒 / 13位毫秒 时间戳
function formatCommentTime(raw: string | number): string {
  let time: number
  if (typeof raw === 'number') {
    time = raw < 10000000000 ? raw * 1000 : raw
  } else {
    //+ 兼容 YYYY-MM-DD HH:mm:ss
    time = new Date(raw.replace(/-/g, '/')).getTime()
  }
  if (!Number.isFinite(time)) return ''
  const now = Date.now()
  const diff = now - time

  if (diff < 60 * 1000) return '刚刚'
  if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))}分钟前`
  if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))}小时前`
  //+ 昨天几点
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  const startOfYesterday = startOfToday.getTime() - 24 * 60 * 60 * 1000
  if (time >= startOfYesterday && time < startOfToday.getTime()) {
    const h = String(new Date(time).getHours()).padStart(2, '0')
    const m = String(new Date(time).getMinutes()).padStart(2, '0')
    return `昨天${h}:${m}`
  }
  if (diff < 7 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / (24 * 60 * 60 * 1000))}天前`
  const date = new Date(time)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const currentYear = new Date(now).getFullYear()
  return year === currentYear ? `${month}-${day}` : `${year}-${month}-${day}`
}

// ==================== 主组件 ====================

const DEFAULT_VISIBLE_REPLIES = 2

const CommentSection = (props: CommentSectionProps) => {
  const {
    initData,
    hasMoreComments,
    loadingMore,
    onLoadMoreComments,
    onLoadMoreReplies,
    onRequestReply,
    onToggleCommentLike,
    onDeleteComment,
  } = props

  // ---------- 状态 ----------
  //+ 评论列表：从 store（initData）同步，store 为单一数据源
  const [comments, setComments] = useState<Comment[]>(initData ?? [])

  //+ initData 变化时同步（fetch/loadMore/create/like/delete 后 store 更新 → 同步展示）
  useEffect(() => {
    setComments(initData ?? [])
  }, [initData])

  //+ 一级评论的"展开/收起"状态：key=parentId，true=展开全部已加载回复
  const [expandMap, setExpandMap] = useState<Record<string, boolean>>({})

  //+ 二级评论加载更多状态：是否加载中 / 是否还有更多（按 parentId 隔离）
  const [repliesLoadingMap, setRepliesLoadingMap] = useState<Record<string, boolean>>({})
  const [repliesHasMoreMap, setRepliesHasMoreMap] = useState<Record<string, boolean>>({})

  //+ 删除确认弹层：长按评论后显示
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    /** 父评论 id，若为一级评论则 null */
    parentId: string | null
  } | null>(null)

  // ---------- 派生 ----------
  //+ 评论总数：优先用后端返回的 totalComments（含二级回复），降级用已加载数据累加
  const storeTotalComments = useSelector((state: RootState) => state.comment.totalComments)
  const totalCount = useMemo(
    () => storeTotalComments > 0
      ? storeTotalComments
      : comments.reduce((sum, c) => sum + 1 + (c.replies?.length || 0), 0),
    [storeTotalComments, comments]
  )

  // ---------- 工具：本地更新 ----------
  //+ 更新某条评论（一级或二级），返回新数组（不可变，用于乐观更新/回滚）
  const updateOne = useCallback((list: Comment[], id: string, patch: Partial<Comment>): Comment[] => {
    return list.map(c => {
      if (c.id === id) {
        return { ...c, ...patch }
      }
      if (c.replies?.length) {
        return { ...c, replies: c.replies.map(r => r.id === id ? { ...r, ...patch } : r) }
      }
      return c
    })
  }, [])

  // ---------- 交互：单条评论点赞（乐观更新 + 失败回滚）----------
  const handleToggleCommentLike = useCallback(async (c: Comment) => {
    const nextLiked = !c.isLiked
    const nextCount = c.likeCount + (nextLiked ? 1 : -1)
    //+ 乐观更新
    setComments(prev => updateOne(prev, c.id, { isLiked: nextLiked, likeCount: nextCount }))
    try {
      await onToggleCommentLike?.(c.id, nextLiked)
    } catch (e) {
      //+ 后端失败 → 回滚（store 未更新，initData 不变，本地回滚生效）
      setComments(prev => updateOne(prev, c.id, { isLiked: !nextLiked, likeCount: c.likeCount }))
      Taro.showToast({ title: '点赞失败', icon: 'none' })
    }
  }, [onToggleCommentLike, updateOne])

  // ---------- 交互：长按删除 ----------
  const handleLongPress = useCallback((c: Comment, parentId: string | null) => {
    if (!c.canDelete) return
    setDeleteTarget({ id: c.id, parentId })
  }, [])

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return
    const { id, parentId } = deleteTarget
    //+ 乐观移除
    setComments(prev => {
      if (!parentId) {
        //+ 删除一级评论 → 同时移除其下所有二级
        return prev.filter(c => c.id !== id)
      }
      //+ 删除二级评论
      return prev.map(c => c.id === parentId && c.replies ? { ...c, replies: c.replies.filter(r => r.id !== id) } : c)
    })
    setDeleteTarget(null)
    Taro.showToast({ title: '删除成功', icon: 'none' })
    try {
      await onDeleteComment?.(id)
    } catch (e) {
      Taro.showToast({ title: '删除失败', icon: 'none' })
      //+ 回滚：store 未更新，真实项目此处建议重新拉取列表
    }
  }, [deleteTarget, onDeleteComment])

  // ---------- 交互：点击回复按钮 → 通知父组件切换 CommentInput 为回复模式 ----------
  const handleOpenReply = useCallback((c: Comment, parentCommentId: string | null) => {
    onRequestReply?.({
      parentCommentId,
      replyToId: c.id,
      replyToName: c.member.nickname
    })
  }, [onRequestReply])

  // ---------- 交互：展开/收起二级评论（仅切换已加载回复的显隐）----------
  const toggleExpand = useCallback((parentId: string) => {
    setExpandMap(prev => ({ ...prev, [parentId]: !prev[parentId] }))
  }, [])

  // ---------- 交互：加载更多二级评论（调用父组件 → store 追加 → initData 同步）----------
  const handleLoadMoreReplies = useCallback(async (parentId: string) => {
    if (!onLoadMoreReplies) return
    setRepliesLoadingMap(prev => ({ ...prev, [parentId]: true }))
    try {
      const { hasMore } = await onLoadMoreReplies(parentId)
      setRepliesHasMoreMap(prev => ({ ...prev, [parentId]: hasMore }))
      //+ 展开显示全部已加载回复
      setExpandMap(prev => ({ ...prev, [parentId]: true }))
    } catch (e) {
      Taro.showToast({ title: '加载回复失败', icon: 'none' })
    } finally {
      setRepliesLoadingMap(prev => ({ ...prev, [parentId]: false }))
    }
  }, [onLoadMoreReplies])

  // ---------- 交互：加载更多一级评论（调用父组件 → store 追加 → initData 同步）----------
  const handleLoadMoreComments = useCallback(async () => {
    if (!onLoadMoreComments || loadingMore) return
    try {
      await onLoadMoreComments()
    } catch (e) {
      Taro.showToast({ title: '加载失败', icon: 'none' })
    }
  }, [onLoadMoreComments, loadingMore])

  // ---------- 离开页面 → 关闭弹层（防止路由栈残留）----------
  useDidHide(() => {
    setDeleteTarget(null)
  })

  // ---------- 渲染：单条评论（一级/二级共用，通过 level 控制缩进/昵称格式）----------
  const renderComment = (c: Comment, level: 1 | 2, parentId: string | null) => {
    //+ 二级评论昵称格式：A @ B（replyToName 存在时）
    const nicknameRender = level === 2
      ? (
          <div className='comment-nickname'>
            <span className='nickname-self'>{c.member.nickname}</span>
            {c.replyToName && (
              <>
                <span className='nickname-at'>  </span>
                <span className='nickname-target'>{c.replyToName}</span>
              </>
            )}
          </div>
        )
      : <div className='comment-nickname'>{c.member.nickname}</div>

    return (
      <View
        key={c.id}
        className={`comment-item comment-level-${level}`}
        onLongPress={() => handleLongPress(c, parentId)}
      >
        {/* 头像 */}
        <div className='comment-avatar'>
          <Avatar url={c.member.avatar} size='32' />
        </div>

        {/* 右侧内容 */}
        <div className='comment-right'>
          {nicknameRender}
          <div className='comment-content'>{c.content}</div>
          <div className='comment-meta'>
            <span className='comment-time'>{formatCommentTime(c.createdAt)}</span>
            <span className='comment-reply-btn' onClick={() => handleOpenReply(c, level === 1 ? c.id : parentId)}>
              回复
            </span>
            <span className='comment-like' onClick={() => handleToggleCommentLike(c)}>
              <span className={`like-icon ${c.isLiked ? 'liked' : ''}`}>
                {c.isLiked ? '❤' : '♡'}
              </span>
              <span className='like-count'>{c.likeCount || ''}</span>
            </span>
          </div>
        </div>
      </View>
    )
  }

  // ---------- 渲染：一级评论 + 二级 + 展开/收起/加载更多 ----------
  const renderLevel1 = (parent: Comment) => {
    const allReplies = parent.replies || []
    const replyCount = parent.replyCount ?? allReplies.length
    const expanded = !!expandMap[parent.id]
    //+ 是否还有更多二级评论未加载：未配置回调时退化为 false（仅展开/收起已加载）
    const hasMoreReplies = onLoadMoreReplies
      ? (repliesHasMoreMap[parent.id] ?? (replyCount > allReplies.length))
      : false
    const repliesLoading = repliesLoadingMap[parent.id]

    //+ 可见回复：已展开或有更多待加载时显示全部已加载；否则只显示前2条
    const showAll = expanded || hasMoreReplies
    const visibleReplies = showAll ? allReplies : allReplies.slice(0, DEFAULT_VISIBLE_REPLIES)
    //+ 是否显示展开行：回复总数 > 2
    const showExpandRow = replyCount > DEFAULT_VISIBLE_REPLIES
    //+ 待加载的回复数（用于按钮文案）
    const pendingCount = Math.max(0, replyCount - allReplies.length)

    return (
      <div key={parent.id} className='comment-level1-wrap'>
        {renderComment(parent, 1, null)}

        {/* 二级评论 */}
        {visibleReplies.length > 0 && (
          <div className='comment-replies-wrap'>
            {visibleReplies.map(r => renderComment(r, 2, parent.id))}
          </div>
        )}

        {/* 展开/收起/加载更多 控制 */}
        {showExpandRow && (
          <div className='comment-expand-row'>
            <span className='comment-expand-line'></span>
            {hasMoreReplies ? (
              <span className='comment-expand-btn' onClick={() => handleLoadMoreReplies(parent.id)}>
                {repliesLoading ? '加载中...' : `展开${pendingCount}条回复`}
                {!repliesLoading && <ArrowDown className='comment-expand-icon'/>}
              </span>
            ) : expanded ? (
              <span className='comment-expand-btn' onClick={() => toggleExpand(parent.id)}>
                收起<ArrowUp className='comment-expand-icon'/>
              </span>
            ) : (
              <span className='comment-expand-btn' onClick={() => toggleExpand(parent.id)}>
                展开更多<ArrowDown className='comment-expand-icon'/>
              </span>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className='comment-section'>
      {/* 4.1 标题 */}
      <div className='comment-title'>评论（{totalCount}）</div>

      {/* 评论列表 */}
      <div className='comment-list'>
        {comments.length === 0 && (
          <div className='comment-empty'>暂无评论，说点什么吧~</div>
        )}
        {comments.map(renderLevel1)}

        {/* 一级评论加载更多：滑动触发为主，点击作兜底 */}
        {/* hasMore=true && loadingMore=false → 提示"上滑加载更多/手动点"（点击兜底触发 handleLoadMoreComments）*/}
        {/* hasMore=true && loadingMore=true  → 提示"加载中..." */}
        {/* hasMore=false                     → 提示"已经到底啦" */}
        {hasMoreComments ? (
          <div
            className='comment-load-more'
            onClick={loadingMore ? undefined : handleLoadMoreComments}
          >
            {loadingMore ? '加载中...' : '上滑加载更多，或者点我'}
          </div>
        ) : (
          comments.length > 0 && (
            <div className='comment-load-more comment-no-more'>— 已经到底啦 —</div>
          )
        )}
      </div>

      {/* 删除确认弹层 */}
      {deleteTarget && (
        <div className='delete-modal' onClick={() => setDeleteTarget(null)}>
          <div className='delete-panel' onClick={(e) => e.stopPropagation()}>
            <div className='delete-title'>确认删除该评论？</div>
            <div className='delete-sub'>删除后无法恢复，一级评论下的所有子评论都会删除</div>
            <div className='delete-actions'>
              <Button className='delete-cancel-btn' onClick={() => setDeleteTarget(null)} block>取消</Button>
              <Button className='delete-confirm-btn' type='primary' onClick={handleConfirmDelete} block>删除</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CommentSection
