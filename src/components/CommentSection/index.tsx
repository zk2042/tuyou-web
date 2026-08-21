//+ 评论区组件（评论列表 + 删除弹层 + 分页加载更多）
//+ 支持：两级评论展示、评论点赞、展开/收起、长按删除、一级评论分页、二级评论加载更多
//+ 数据源：store 作为单一数据源，通过 initData 同步展示；点赞/删除由组件乐观更新，失败回滚
//+ 点击"回复"按钮 → 通过 onRequestReply 回调通知父组件，父组件再调用 CommentInput（Popup 弹层）完成输入+提交
//+ 复用于笔记详情 (NoteDetail) 和攻略详情 (GuideDetail)，通过 props 传入内容类型与事件回调
import { useState, useMemo, useCallback, useEffect ,useRef} from 'react'
import Taro, { useDidHide } from '@tarojs/taro'
import { View } from '@tarojs/components'
import { Button } from '@nutui/nutui-react'
import { ArrowDown, ArrowUp } from '@nutui/icons-react'
import { useSelector } from 'react-redux'
import type { RootState } from '@/store'
import Avatar from '@/components/Avatar'
import StatusBadge from '@/components/StatusBadge'
import UserCardModal from '@/components/UserCardModal'
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
  //+ 上一次 comments 快照：用于检测新增二级评论
  const prevCommentsRef = useRef<Comment[]>(initData ?? [])
  //+ 正在通过 onLoadMoreReplies 拉取"更多"的 parent 集合
  //+ 用途：拉取期间 replies 会增加，但不应被算到 initialCount（避免拉取的"更多"无法被收起）
  const fetchingRepliesRef = useRef<Set<string>>(new Set())

  //+ initData 变化时同步（fetch/loadMore/create/like/delete 后 store 更新 → 同步展示）
  //+ 同时检测：某条一级评论的 replies 数量增加（用户/其他人发二级评论）
  //+          → 把新评论算到 initialCount（即归入"初始热度子评论"区域，永远显示）
  //+          → expanded 保持 false，按钮只显示 [展示更多]，不会冒出多余的 [收起]
  //+          → 跳过 fetchingRepliesRef 中的 parent（onLoadMoreReplies 拉取的不算到 initialCount）
  useEffect(() => {
    const newComments = initData ?? []
    const prevComments = prevCommentsRef.current

    for (const newParent of newComments) {
      if (fetchingRepliesRef.current.has(newParent.id)) continue  //+ 跳过 onLoadMoreReplies 拉取
      const oldParent = prevComments.find(p => p.id === newParent.id)
      const oldRepliesLen = oldParent?.replies?.length ?? 0
      const newRepliesLen = newParent.replies?.length ?? 0
      if (newRepliesLen > oldRepliesLen) {
        //+ 新发评论 → 更新 initialCount（新评论归入"初始热度子评论"区域）
        const oldInitial = initialRepliesCountRef.current.get(newParent.id) ?? 0
        initialRepliesCountRef.current.set(newParent.id, oldInitial + (newRepliesLen - oldRepliesLen))
      }
    }

    prevCommentsRef.current = newComments
    setComments(newComments)
  }, [initData])

  //+ 一级评论的"展开/收起更多回复"状态：key=parentId，true=展开通过接口拉取的更多回复
  //+ 注意：后端响应的初始 replies（热度子评论）永远显示，不受 expandMap 控制
  //+       expandMap 只控制 onLoadMoreReplies 拉取的"更多"是否显示
  const [expandMap, setExpandMap] = useState<Record<string, boolean>>({})
  //+ 记录每个 parentId 的初始 replies 数量（后端响应的热度子评论数）
  //+ 用于区分"初始子评论"（永远显示）和"拉取的更多子评论"（可收起）
  const initialRepliesCountRef = useRef<Map<string, number>>(new Map())

  //+ 二级评论加载更多状态：是否加载中 / 是否还有更多（按 parentId 隔离）
  const [repliesLoadingMap, setRepliesLoadingMap] = useState<Record<string, boolean>>({})
  const [repliesHasMoreMap, setRepliesHasMoreMap] = useState<Record<string, boolean>>({})

  //+ 删除确认弹层：长按评论后显示
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    /** 父评论 id，若为一级评论则 null */
    parentId: string | null
  } | null>(null)
  //+ 长按锁定时间窗：长按触发后会紧接 touchend → click，导致弹层一显示就被关闭
  //+ 加 400ms 锁定窗，长按触发后 400ms 内忽略任何关闭事件
  const longPressLockRef = useRef(false)

  //+ 用户资料卡弹窗：点击评论人头像弹出
  const [cardUserId, setCardUserId] = useState<string | null>(null)
  const [cardVisible, setCardVisible] = useState(false)
  const handleOpenCard = useCallback((userId: string) => {
    setCardUserId(userId)
    setCardVisible(true)
  }, [])
  const handleCloseCard = useCallback(() => {
    setCardVisible(false)
    setCardUserId(null)
  }, [])

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
    //+ 启动 400ms 锁定窗，防止长按后紧接的 touchend → click 关闭弹层
    longPressLockRef.current = true
    setTimeout(() => { longPressLockRef.current = false }, 400)
  }, [])

  //+ 关闭弹层（带锁检查）：长按后短时间内的关闭事件被忽略
  const closeDeleteModal = useCallback(() => {
    if (longPressLockRef.current) return
    setDeleteTarget(null)
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

  // ---------- 交互：展开更多二级评论（仅针对 onLoadMoreReplies 拉取的"更多"）----------
  //+ 场景A：用户没拉过更多（allReplies.length == initialCount）+ replyCount > initialCount → 首次拉取
  //+ 场景B：用户拉过更多但收起过（allReplies.length > initialCount + expandRaw=false）→ 直接展开，不请求
  //+ 注意：后端响应的初始 replies（热度子评论）永远显示，这里只管"更多"
  const handleExpand = useCallback(async (parent: Comment) => {
    const allReplies = parent.replies || []
    const initialCount = initialRepliesCountRef.current.get(parent.id) ?? 0
    const hasLoadedMore = allReplies.length > initialCount
    const needFetch = !hasLoadedMore
      && (parent.replyCount ?? 0) > initialCount
      && onLoadMoreReplies
    if (needFetch) {
      //+ 标记拉取中：让 initData useEffect 跳过该 parent，避免拉取的"更多"被算到 initialCount
      fetchingRepliesRef.current.add(parent.id)
      setRepliesLoadingMap(prev => ({ ...prev, [parent.id]: true }))
      try {
        const { hasMore } = await onLoadMoreReplies(parent.id)
        setRepliesHasMoreMap(prev => ({ ...prev, [parent.id]: hasMore }))
      } catch (e) {
        Taro.showToast({ title: '加载回复失败', icon: 'none' })
        fetchingRepliesRef.current.delete(parent.id)
        return  //+ 拉取失败不展开
      } finally {
        setRepliesLoadingMap(prev => ({ ...prev, [parent.id]: false }))
      }
      fetchingRepliesRef.current.delete(parent.id)
    }
    //+ 标记展开（首次拉取成功 / 已有更多数据直接展开）
    setExpandMap(prev => ({ ...prev, [parent.id]: true }))
  }, [onLoadMoreReplies])

  // ---------- 交互：收起二级评论（仅切换显隐，replies 数据保留在 store）----------
  //+ 下次点"展开更多"走场景 B，直接显示已加载，不重新请求
  const toggleExpand = useCallback((parentId: string) => {
    setExpandMap(prev => ({ ...prev, [parentId]: !prev[parentId] }))
  }, [])

  // ---------- 交互：展开后继续加载更多二级评论（仅当 hasMoreReplies=true 才显示按钮）----------
  //+ 与 handleExpand 区分：handleExpand 是"从收起到展开"，本函数是"已展开状态下加载下一页"
  const handleLoadMoreReplies = useCallback(async (parentId: string) => {
    if (!onLoadMoreReplies) return
    //+ 标记拉取中：避免拉取的"更多"被算到 initialCount
    fetchingRepliesRef.current.add(parentId)
    setRepliesLoadingMap(prev => ({ ...prev, [parentId]: true }))
    try {
      const { hasMore } = await onLoadMoreReplies(parentId)
      setRepliesHasMoreMap(prev => ({ ...prev, [parentId]: hasMore }))
      //+ 保持 expanded=true，新数据通过 initData 同步进来追加显示
    } catch (e) {
      Taro.showToast({ title: '加载回复失败', icon: 'none' })
    } finally {
      setRepliesLoadingMap(prev => ({ ...prev, [parentId]: false }))
      fetchingRepliesRef.current.delete(parentId)
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
    //+ 昵称右侧统一渲染状态角标（status=0/2 时显示，正常时不渲染）
    const nicknameRender = level === 2
      ? (
          <div className='comment-nickname'>
            <span className='nickname-self'>{c.member.nickname}</span>
            <StatusBadge status={c.member.status} size='small' />
            {c.replyToName && (
              <>
                <span className='nickname-at'>  </span>
                <span className='nickname-target'>{c.replyToName}</span>
              </>
            )}
          </div>
        )
      : (
          <div className='comment-nickname'>
            {c.member.nickname}
            <StatusBadge status={c.member.status} size='small' />
          </div>
        )

    return (
      <View
        key={c.id}
        className={`comment-item comment-level-${level}`}
        onLongPress={() => handleLongPress(c, parentId)}
      >
        {/* 头像：点击弹出用户资料卡 */}
        <div className='comment-avatar' onClick={() => handleOpenCard(c.member.id)}>
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

  // ---------- 渲染：一级评论 + 二级 + 展示更多/收起 ----------
  //+ 规则（按接口文档）：
  //+   一页渲染规则：
  //+     replies 不为空 → 渲染出来（初始热度子评论，永远显示，不受收起影响）
  //+     replies 为空 → 不渲染子评论
  //+     replyCount=0 → 不显示 [展示更多] 和 [收起]
  //+     replyCount>0 → 显示 [展示更多]，无 [收起]
  //+   点击 [展示更多]：
  //+     首次 → 拉取更多二级评论
  //+     拉取后 hasMoreReplies=true → 显示 [展示更多][收起]
  //+     拉取后 hasMoreReplies=false → 只显示 [收起]
  //+   点击 [收起]：
  //+     收起全部"更多"数据，保留初始 replies（热度子评论不被收起）
  //+     按钮变回 [展示更多]
  //+   收起后再点 [展示更多] → 直接展开上次收起的数据，不重新请求
  const renderLevel1 = (parent: Comment) => {
    const allReplies = parent.replies || []
    const replyCount = parent.replyCount ?? allReplies.length

    //+ 记录初始 replies 数量（首次渲染时锁定，后续 onLoadMoreReplies 追加的不计入）
    if (!initialRepliesCountRef.current.has(parent.id)) {
      initialRepliesCountRef.current.set(parent.id, allReplies.length)
    }
    const initialCount = initialRepliesCountRef.current.get(parent.id) || 0

    const expandRaw = expandMap[parent.id]
    //+ undefined → 默认不展开"更多"（false）；用户显式设置则用用户的值
    const expanded = expandRaw === undefined ? false : expandRaw

    //+ 是否还有未加载的二级评论：replyCount > 已加载数 + 配置了回调
    const hasMoreReplies = onLoadMoreReplies
      ? (repliesHasMoreMap[parent.id] ?? (replyCount > allReplies.length))
      : false
    const repliesLoading = repliesLoadingMap[parent.id]

    //+ 可见回复：
    //+   展开状态 → 显示全部（初始 + 更多）
    //+   收起状态 → 只显示前 initialCount 条（初始热度子评论），隐藏"更多"
    const visibleReplies = expanded
      ? allReplies
      : allReplies.slice(0, initialCount)
    //+ 显示展开行入口：replyCount > initialCount（还有更多可加载/可展开）
    //+ 如果 replyCount === initialCount（初始已全部返回），无需展开入口
    const showExpandRow = replyCount > initialCount

    return (
      <div key={parent.id} className='comment-level1-wrap'>
        {renderComment(parent, 1, null)}

        {/* 二级评论 */}
        {visibleReplies.length > 0 && (
          <div className='comment-replies-wrap'>
            {visibleReplies.map(r => renderComment(r, 2, parent.id))}
          </div>
        )}

        {/* 展示更多/收起 控制 */}
        {showExpandRow && (
          <div className='comment-expand-row'>
            <span className='comment-expand-line'></span>
            {!expanded ? (
              //+ 收起状态：只显示 [展示更多]
              <span className='comment-expand-btn' onClick={() => handleExpand(parent)}>
                {repliesLoading ? '加载中...' : '展示更多'}
                {!repliesLoading && <ArrowDown className='comment-expand-icon'/>}
              </span>
            ) : (
              //+ 展开状态：[展示更多?] [收起] 并排，hasMoreReplies 时才显示左侧
              <>
                {hasMoreReplies && (
                  <span
                    className='comment-expand-btn comment-expand-more'
                    onClick={() => handleLoadMoreReplies(parent.id)}
                  >
                    {repliesLoading ? '加载中...' : '展示更多'}
                    {!repliesLoading && <ArrowDown className='comment-expand-icon'/>}
                  </span>
                )}
                <span className='comment-expand-btn' onClick={() => toggleExpand(parent.id)}>
                  收起<ArrowUp className='comment-expand-icon'/>
                </span>
              </>
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
        <div className='delete-modal' onClick={closeDeleteModal}>
          <div className='delete-panel' onClick={(e) => e.stopPropagation()}>
            {/* <div className='delete-title'>确认删除该评论？</div> */}
            <div className='delete-sub'>确认删除该评论？删除后无法恢复</div>
            <div className='delete-actions'>
              <Button className='delete-cancel-btn' onClick={closeDeleteModal} block>取消</Button>
              <Button className='delete-confirm-btn' type='primary' onClick={handleConfirmDelete} block>删除</Button>
            </div>
          </div>
        </div>
      )}

      {/* 用户资料卡弹窗：点击评论人头像 */}
      <UserCardModal
        visible={cardVisible}
        userId={cardUserId}
        onClose={handleCloseCard}
      />
    </div>
  )
}

export default CommentSection
