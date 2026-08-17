//+ 攻略详情页（仅处理攻略 type=guide）
//+ 与笔记详情结构对称，routeInfo 路线信息在此页面内联渲染
//+ 完整点赞/收藏/关注/删除链路（通过 guide 模块 thunk，单次 API 调用）
import HeaderNavBar from '@/components/HeaderNavBar'
import DetailBanner from '@/components/DetailBanner'
import CommentInput, { type CommentInputReplyTarget, type CommentInputSendPayload } from '@/components/CommentInput'
import CommentSection from '@/components/CommentSection'
import Avatar from '@/components/Avatar'
import Button from '@/components/Button'
import { useDispatch, useSelector } from 'react-redux'
import type { RootState, AppDispatch } from '@/store'
import { useEffect, useCallback, useState, useRef, useMemo } from 'react'
import Taro from '@tarojs/taro'
import { Dialog } from '@nutui/nutui-react'
import { fetchGuideDetail, toggleLike as toggleGuideLike, toggleFavorite as toggleGuideFavorite, patchGuideDetail, deleteGuide } from '@/store/modules/guide'
import { toggleProfileFollow } from '@/store/modules/profile'
import { updateFeedItem } from '@/store/modules/home'
import {
  fetchComments, loadMoreComments, createComment,
  toggleCommentLike, deleteComment, fetchReplies,
  resetComments, findCommentById
} from '@/store/modules/comment'
import { COMMENT_TARGET_TYPE } from '@/types'
import { useAuthGuard } from '@/components/AuthRoute'
import { useCommentPolling } from '@/hooks/useCommentPolling'
import './index.less'

const GuideDetail = () => {
  useAuthGuard()
  const dispatch: AppDispatch = useDispatch()

  //+ 详情数据（仅攻略）
  const guideDetail = useSelector((state: RootState) => state.guide.guideDetail)
  //+ 当前用户ID（用于判断 isSelf，本人不显示关注按钮）
  const userId = useSelector((state: RootState) => state.user.userInfo?.id || '')

  //+ 路由参数：id（攻略ID）
  const router = Taro.getCurrentInstance().router
  const id = router?.params?.id || ''

  //+ 评论点赞数轮询：15s 一次，只 patch likeCount 变化项，离开详情页自动清理
  useCommentPolling(COMMENT_TARGET_TYPE.GUIDE, id)

  //+ 请求锁 + AbortController：key = `${op}:${id}`，值 = RTK dispatch promise
  //+ promise.abort() 会触发 RTK 内部 signal → 传入 API → request 层 abort 真实请求
  const promiseRef = useRef<Map<string, { abort: () => void }>>(new Map())
  //+ 操作冷却：完成后计时，防止接口响应极快时用户连续点击产生串行无效请求
  const cooldownRef = useRef<Map<string, number>>(new Map())
  const COOLDOWN_MS = 800

  //+ 协调状态：CommentSection 点"回复"时设置 replyTarget → 传入 CommentInput 打开回复模式弹层
  const [replyTarget, setReplyTarget] = useState<CommentInputReplyTarget | null>(null)

  //+ 评论列表（来自 comment store，作为 CommentSection 的单一数据源）
  const commentList = useSelector((state: RootState) => state.comment.list)
  const commentHasMore = useSelector((state: RootState) => state.comment.hasMore)
  const commentLoadingMore = useSelector((state: RootState) => state.comment.loadingMore)

  //+ 删除确认弹窗控制
  const [deleteVisible, setDeleteVisible] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  //+ 离开页面时 abort 所有未完成请求
  useEffect(() => {
    return () => {
      promiseRef.current.forEach(p => p.abort())
      promiseRef.current.clear()
      cooldownRef.current.clear()
    }
  }, [])

  useEffect(() => {
    if (id) {
      dispatch(fetchGuideDetail({ id }))
      //+ 评论列表：切换目标时重置后拉取首页（targetType=2 攻略）
      dispatch(resetComments())
      dispatch(fetchComments({ targetType: COMMENT_TARGET_TYPE.GUIDE, targetId: id }))
    }
  }, [dispatch, id])

  const isVideo = !!guideDetail?.videoUrl
  const authorId = guideDetail?.author?.id || ''
  const isSelf = !!userId && !!authorId && String(userId) === String(authorId)
  const isFollowed = guideDetail?.isFollowed ?? false

  //+ 点赞（guide 模块 thunk → 单次 API；fulfilled 后 store 自动同步详情）
  //+ 同时同步 home store 中对应卡片的点赞状态，返回首页时卡片图标和数字一致
  //+ 性能优化：按资源ID请求锁 + AbortController；pending 阶段 store 已乐观 UI 翻转
  const handleToggleLike = useCallback(async (nextIsLiked: boolean) => {
    if (!guideDetail?.id) return
    const resKey = `like:${guideDetail.id}`
    const cd = cooldownRef.current.get(resKey)
    if (cd && Date.now() < cd) return
    const prev = promiseRef.current.get(resKey)
    if (prev) prev.abort()

    const promise = dispatch(toggleGuideLike(guideDetail.id))
    promiseRef.current.set(resKey, promise)
    let wasAborted = false
    try {
      const action = await promise
      wasAborted = (action as any)?.payload === 'aborted'
      const status = (action as any)?.meta?.requestStatus
      if (status === 'fulfilled') {
        const payload = (action as any)?.payload || {}
        const finalLiked = typeof payload.isLiked === 'boolean' ? payload.isLiked : nextIsLiked
        const finalCount = typeof payload.likeCount === 'number' ? payload.likeCount : (guideDetail.likeCount || 0) + (finalLiked ? 1 : -1)
        dispatch(updateFeedItem({ id: guideDetail.id, patch: { isLiked: finalLiked, likeCount: finalCount } }))
        Taro.showToast({ title: finalLiked ? '点赞成功' : '已取消点赞', icon: 'success' })
      } else if (!wasAborted) {
        Taro.showToast({ title: (action as any)?.payload || '操作失败', icon: 'none' })
      }
    } catch (err) {
      console.warn('[GuideDetail] 点赞失败:', err)
    } finally {
      if (promiseRef.current.get(resKey) === promise) {
        promiseRef.current.delete(resKey)
      }
      if (!wasAborted) {
        const expires = Date.now() + COOLDOWN_MS
        cooldownRef.current.set(resKey, expires)
        setTimeout(() => { if (cooldownRef.current.get(resKey) === expires) cooldownRef.current.delete(resKey) }, COOLDOWN_MS + 50)
      }
    }
  }, [guideDetail, dispatch])

  //+ 收藏（同时同步 home store，保证返回首页后卡片状态一致）
  //+ 性能优化：按资源ID请求锁 + AbortController；pending 阶段已乐观 UI 翻转
  const handleToggleFavorite = useCallback(async (nextIsFavorited: boolean) => {
    if (!guideDetail?.id) return
    const resKey = `fav:${guideDetail.id}`
    const cd = cooldownRef.current.get(resKey)
    if (cd && Date.now() < cd) return
    const prev = promiseRef.current.get(resKey)
    if (prev) prev.abort()

    const promise = dispatch(toggleGuideFavorite(guideDetail.id))
    promiseRef.current.set(resKey, promise)
    let wasAborted = false
    try {
      const action = await promise
      wasAborted = (action as any)?.payload === 'aborted'
      const status = (action as any)?.meta?.requestStatus
      if (status === 'fulfilled') {
        const payload = (action as any)?.payload || {}
        const finalFav = typeof payload.isFavorited === 'boolean' ? payload.isFavorited : nextIsFavorited
        dispatch(updateFeedItem({ id: guideDetail.id, patch: { isFavorited: finalFav } }))
        Taro.showToast({ title: finalFav ? '收藏成功' : '已取消收藏', icon: 'success' })
      } else if (!wasAborted) {
        Taro.showToast({ title: (action as any)?.payload || '操作失败', icon: 'none' })
      }
    } catch (err) {
      console.warn('[GuideDetail] 收藏失败:', err)
    } finally {
      if (promiseRef.current.get(resKey) === promise) {
        promiseRef.current.delete(resKey)
      }
      if (!wasAborted) {
        const expires = Date.now() + COOLDOWN_MS
        cooldownRef.current.set(resKey, expires)
        setTimeout(() => { if (cooldownRef.current.get(resKey) === expires) cooldownRef.current.delete(resKey) }, COOLDOWN_MS + 50)
      }
    }
  }, [guideDetail, dispatch])

  //+ 关注/取消关注（user 模块 thunk，成功后同步到攻略详情的 isFollowed）
  //+ 性能优化：按被关注 userId 请求锁 + AbortController
  //+ 关注/取消关注（统一走 profile/toggleProfileFollow，POST /personal/follow/{id}）
  const handleToggleFollow = useCallback(async (authorUserId: string, nextIsFollowed: boolean) => {
    if (!authorUserId) return
    const resKey = `follow:${authorUserId}`
    const cd = cooldownRef.current.get(resKey)
    if (cd && Date.now() < cd) return
    const prev = promiseRef.current.get(resKey)
    if (prev) prev.abort()

    const promise = dispatch(toggleProfileFollow(authorUserId))
    promiseRef.current.set(resKey, promise)
    let wasAborted = false
    try {
      const action = await promise
      wasAborted = (action as any)?.payload === 'aborted'
      // const action = await dispatch(toggleProfileFollow(authorUserId))
      const ok = (action as any)?.meta?.requestStatus === 'fulfilled'
      if (ok) {
        const payload = (action as any)?.payload || {}
        const finalIsFollowed = typeof payload.isFollowed === 'boolean'
          ? payload.isFollowed
          : nextIsFollowed
        dispatch(patchGuideDetail({ isFollowed: finalIsFollowed }))
        Taro.showToast({ title: finalIsFollowed ? '关注成功' : '已取消关注', icon: 'success' })
      } else if (!wasAborted) {
        Taro.showToast({ title: (action as any)?.payload || '操作失败', icon: 'none' })
      }
    } catch (err) {
      console.warn('[GuideDetail] 关注失败:', err)
    } finally {
      if (promiseRef.current.get(resKey) === promise) {
        promiseRef.current.delete(resKey)
      }
      if (!wasAborted) {
        const expires = Date.now() + COOLDOWN_MS
        cooldownRef.current.set(resKey, expires)
        setTimeout(() => { if (cooldownRef.current.get(resKey) === expires) cooldownRef.current.delete(resKey) }, COOLDOWN_MS + 50)
      }
    }
  }, [dispatch])

  //+ 关注按钮 loading：请求中置灰；user.followLoadingMap 也作为兜底（组件外触发时也能感知）
  const followLoadingMap = useSelector((state: RootState) => state.user.followLoadingMap)
  const followLoading = useMemo(
    () => (!!authorId && promiseRef.current.has(`follow:${authorId}`)) || !!followLoadingMap[authorId],
    [authorId, followLoadingMap]
  )

  //+ 点击关注按钮（本地回调）
  const handleFollowClick = () => {
    if (isSelf || !authorId) return
    handleToggleFollow(authorId, !isFollowed)
  }

  // ---------- 协调：评论系统回复 / 发送链路 ----------

  //+ CommentSection 点"回复" → 设置 replyTarget → CommentInput 自动弹"回复 @XXX"
  const handleRequestReply = useCallback((target: CommentInputReplyTarget) => {
    setReplyTarget(target)
  }, [])

  //+ CommentInput 回复模式下点击关闭 ✕ 或关闭弹层时 → 清空 replyTarget 回到一级模式
  const handleCancelReply = useCallback(() => {
    setReplyTarget(null)
  }, [])

  //+ CommentInput 点击"发送"（一级或回复模式）→ 调用 createComment thunk，成功后 store 自动追加并同步到列表
  //+ 失败时 throw，触发 CommentInput 的"评论失败"提示并保留输入内容
  const handleSendComment = useCallback(async (payload: CommentInputSendPayload) => {
    if (!id) return
    //+ API 入参：replyToId 为一级评论 ID（即 parentCommentId）；回复二级评论时需传 replyToMemberId
    let apiReplyToId: number | undefined
    let replyToMemberId: number | undefined
    if (payload.parentCommentId) {
      apiReplyToId = Number(payload.parentCommentId) || undefined
      //+ 回复二级评论时（replyToId 与 parentCommentId 不同）必传被回复用户 ID
      if (payload.replyToId && payload.replyToId !== payload.parentCommentId) {
        const replied = findCommentById(commentList, payload.replyToId)
        replyToMemberId = replied?.member.id ? Number(replied.member.id) || undefined : undefined
      }
    }
    const action = await dispatch(createComment({
      targetType: COMMENT_TARGET_TYPE.GUIDE,
      targetId: Number(id) || 0,
      content: payload.content,
      replyToId: apiReplyToId,
      replyToMemberId
    }))
    if ((action as any)?.meta?.requestStatus === 'fulfilled') {
      //+ store 已追加新评论 → initData 同步展示；切回一级模式
      setReplyTarget(null)
    } else {
      //+ payload 现为 { code, message } 对象，构造带 code 的 Error 抛给 CommentInput 区分提示
      const payload = (action as any)?.payload as { code: number; message: string } | undefined
      const err = new Error(payload?.message || '发表评论失败')
      ;(err as any).code = payload?.code
      throw err
    }
  }, [dispatch, id, commentList])

  //+ 加载更多一级评论（store 追加 → initData 同步）
  const handleLoadMoreComments = useCallback(async () => {
    await dispatch(loadMoreComments())
  }, [dispatch])

  // ---------- 滑动触底加载（一级评论）----------
  //+ 距底部阈值（px）：提前触发，用户感觉不到停顿
  const BOTTOM_THRESHOLD = 300
  //+ 滚动容器 ref（.guide-detail-content，实际滚动载体）
  const contentRef = useRef<HTMLDivElement | null>(null)
  //+ 正在加载中锁：onScroll 高频触发，防止重复请求
  const loadingLockRef = useRef(false)

  //+ 尝试加载下一页：所有条件满足才调用，否则跳过
  //+ 供 onScroll 和首屏 useEffect 复用
  const tryLoadNextPage = useCallback(async () => {
    if (loadingLockRef.current) return          //+ 同页请求中
    if (!commentHasMore) return                  //+ 没有更多
    if (commentLoadingMore) return               //+ store loadingMore 已在请求
    loadingLockRef.current = true
    try {
      await handleLoadMoreComments()
    } finally {
      loadingLockRef.current = false
    }
  }, [commentHasMore, commentLoadingMore, handleLoadMoreComments])

  //+ 滚动监听：距底部 <= threshold 时触发加载
  const handleScroll = useCallback(() => {
    const el = contentRef.current
    if (!el) return
    const remain = el.scrollHeight - el.scrollTop - el.clientHeight
    if (remain <= BOTTOM_THRESHOLD) {
      void tryLoadNextPage()
    }
  }, [tryLoadNextPage])

  //+ 首屏自动补满：评论数少未撑出滚动条 → 自动加载下一页直到出现滚动条或 hasMore=false
  useEffect(() => {
    const check = () => {
      const el = contentRef.current
      if (!el) return
      if (el.scrollHeight <= el.clientHeight + 1) {
        void tryLoadNextPage()
      }
    }
    const timer = setTimeout(check, 80)
    return () => clearTimeout(timer)
  }, [commentList, commentHasMore, tryLoadNextPage])

  //+ 加载更多二级评论（store 追加到对应一级评论 → initData 同步）
  const handleLoadMoreReplies = useCallback(async (parentId: string): Promise<{ hasMore: boolean }> => {
    const action = await dispatch(fetchReplies({ parentId }))
    if ((action as any)?.meta?.requestStatus === 'fulfilled') {
      return { hasMore: !!(action as any)?.payload?.hasMore }
    }
    throw new Error((action as any)?.payload || '加载回复失败')
  }, [dispatch])

  //+ 评论点赞（失败 throw 触发 CommentSection 回滚）
  //+ 性能优化：操作冷却 + AbortController 丢弃过期请求
  const handleToggleCommentLike = useCallback(async (commentId: string) => {
    const resKey = `commentLike:${commentId}`
    const cd = cooldownRef.current.get(resKey)
    if (cd && Date.now() < cd) return
    const prev = promiseRef.current.get(resKey)
    if (prev) prev.abort()

    const promise = dispatch(toggleCommentLike(commentId))
    promiseRef.current.set(resKey, promise)
    let wasAborted = false
    try {
      const action = await promise
      wasAborted = (action as any)?.payload === 'aborted'
      if ((action as any)?.meta?.requestStatus !== 'fulfilled') {
        if (wasAborted) return
        throw new Error((action as any)?.payload || '操作失败')
      }
    } finally {
      if (promiseRef.current.get(resKey) === promise) {
        promiseRef.current.delete(resKey)
      }
      if (!wasAborted) {
        const expires = Date.now() + COOLDOWN_MS
        cooldownRef.current.set(resKey, expires)
        setTimeout(() => { if (cooldownRef.current.get(resKey) === expires) cooldownRef.current.delete(resKey) }, COOLDOWN_MS + 50)
      }
    }
  }, [dispatch])

  //+ 删除评论（失败 throw 触发 CommentSection 提示）
  const handleDeleteComment = useCallback(async (commentId: string) => {
    const action = await dispatch(deleteComment(commentId))
    if ((action as any)?.meta?.requestStatus !== 'fulfilled') {
      throw new Error((action as any)?.payload || '删除失败')
    }
  }, [dispatch])

  //+ 头部 more 按钮点击：弹出 ActionSheet 选择删除
  const handleMoreClick = useCallback(() => {
    Taro.showActionSheet({
      itemList: ['删除攻略'],
      success: (res) => {
        if (res.tapIndex === 0) {
          setDeleteVisible(true)
        }
      },
      //+ 用户点击取消时 Taro 会触发 fail，静默处理避免 Uncaught (in promise)
      fail: (err) => {
        if (!/cancel/i.test(err.errMsg || '')) {
          console.warn('[GuideDetail] showActionSheet fail:', err)
        }
      }
    })
  }, [])

  //+ 确认删除攻略
  const handleDeleteConfirm = useCallback(async () => {
    if (!id || deleteLoading) return
    setDeleteLoading(true)
    Taro.showLoading({ title: '删除中...', mask: true })
    try {
      const action = await dispatch(deleteGuide(id))
      const ok = (action as any)?.meta?.requestStatus === 'fulfilled'
      Taro.hideLoading()
      if (ok) {
        Taro.showToast({ title: '删除成功', icon: 'success' })
        setDeleteVisible(false)
        //+ 删除成功后返回上一页
        setTimeout(() => {
          Taro.navigateBack({ delta: 1 }).catch(() => {
            Taro.switchTab({ url: '/pages/Home/index' })
          })
        }, 500)
      } else {
        Taro.showToast({ title: (action as any)?.payload || '删除失败', icon: 'none' })
      }
    } catch (err) {
      Taro.hideLoading()
      console.warn('[GuideDetail] 删除失败:', err)
      Taro.showToast({ title: '删除失败', icon: 'none' })
    } finally {
      setDeleteLoading(false)
    }
  }, [id, deleteLoading, dispatch])

  return (
    <div className='guide-detail-container'>
      {/* 顶部标题和返回箭头 */}
      <HeaderNavBar
        title='详情'
        backPageNum={1}
        fixed={false}
        more={!!(guideDetail?.isOwner ?? isSelf)}
        onMoreClick={handleMoreClick}
      />
      <div
        className='guide-detail-content'
        ref={contentRef}
        onScroll={handleScroll}
      >
        {/* 轮播图/视频 */}
        {isVideo
          ? <DetailBanner videoUrl={guideDetail?.videoUrl} />
          : <DetailBanner images={guideDetail?.images} />
        }

        {/* 攻略详情区（内联：标题→作者→路线信息→正文→标签） */}
        <div className="guide-detail-info">
          {/* 标题 */}
          <p className="g-info-title">{guideDetail?.title}</p>

          {/* 头像+昵称+时间+关注 */}
          <div className="g-info-header">
            <div className="g-info-header-left">
              <Avatar url={guideDetail?.author?.avatar || ''} size="small" />
              <div className="g-info-header-left-content">
                <span className="g-nickname">{guideDetail?.author?.nickname || ''}</span>
                <span className="g-publish-time">{(guideDetail?.publishTime || '').split('T')[0]}</span>
              </div>
            </div>
            {!isSelf && authorId && (
              <Button
                content={isFollowed ? '已关注' : '+ 关注'}
                onClick={handleFollowClick}
                isFollowed={isFollowed}
                loading={followLoading}
                disabled={followLoading}
              />
            )}
          </div>

          {/* 路线信息（攻略专属） */}
          {guideDetail?.routeInfo && (
            <div className="g-route-info">
              <p className="g-route-info-title">路线信息</p>
              <div className="g-route-info-grid">
                <div className="g-route-info-item">
                  <span className="g-route-info-label">距离</span>
                  <span className="g-route-info-value">{guideDetail.routeInfo.distance || '-'}</span>
                </div>
                <div className="g-route-info-item">
                  <span className="g-route-info-label">时长</span>
                  <span className="g-route-info-value">{guideDetail.routeInfo.duration || '-'}</span>
                </div>
                <div className="g-route-info-item">
                  <span className="g-route-info-label">难度</span>
                  <span className="g-route-info-value">{guideDetail.routeInfo.difficulty || '-'}</span>
                </div>
                <div className="g-route-info-item">
                  <span className="g-route-info-label">交通</span>
                  <span className="g-route-info-value">{guideDetail.routeInfo.transport || '-'}</span>
                </div>
              </div>
            </div>
          )}

          {/* 正文内容 */}
          <p className="g-info-content">{guideDetail?.content}</p>

          {/* 标签 */}
          <div className="g-info-tags">
            {guideDetail?.tags?.map((tag: string) => (
              <span key={tag} className="g-tag" onClick={() => { }}>
                <span className="g-tag-icon">#</span>{tag}
              </span>
            ))}
          </div>
        </div>

        {/* 评论列表（两级评论展示 + 删除弹层 + 分页加载更多 + 点击回复触发 onRequestReply） */}
        <CommentSection
          contentId={id}
          contentType='guide'
          initData={commentList}
          hasMoreComments={commentHasMore}
          loadingMore={commentLoadingMore}
          onLoadMoreComments={handleLoadMoreComments}
          onLoadMoreReplies={handleLoadMoreReplies}
          onRequestReply={handleRequestReply}
          onToggleCommentLike={handleToggleCommentLike}
          onDeleteComment={handleDeleteComment}
        />

        {/* 底部互动栏：点赞/收藏/转发 + Popup 输入一级评论或回复模式下"回复 @XXX" */}
        <CommentInput
          detail={guideDetail}
          replyTarget={replyTarget}
          onCancelReply={handleCancelReply}
          onSendComment={handleSendComment}
          actions={{
            isLiked: guideDetail?.isLiked,
            likeCount: guideDetail?.likeCount,
            isFavorited: guideDetail?.isFavorited,
            favoriteCount: guideDetail?.collectCount,
            onToggleLike: handleToggleLike,
            onToggleFavorite: handleToggleFavorite
          }}
        />
      </div>

      {/* 删除确认弹窗 */}
      <Dialog
        visible={deleteVisible}
        title='确认删除攻略？'
        content='删除后无法恢复，确定删除该攻略吗？'
        confirmText='删除'
        cancelText='取消'
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteVisible(false)}
      />
    </div>
  )
}

export default GuideDetail
