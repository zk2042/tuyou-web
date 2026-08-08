//+ 笔记详情页（仅处理笔记 type=note）
//+ 攻略详情请见 /pages/GuideDetail（独立模块，不复用本页）
//+ Q8：完整点赞/收藏/关注链路（通过 note 模块 thunk，单次 API 调用）
import HeaderNavBar from '@/components/HeaderNavBar'
import DetailBanner from '@/components/DetailBanner'
import DetailInfo from '@/components/DetailInfo'
import CommentInput from '@/components/CommentInput'
import { useDispatch, useSelector } from 'react-redux'
import type { RootState, AppDispatch } from '@/store'
import { useEffect, useCallback } from 'react'
import Taro from '@tarojs/taro'
import { fetchNoteDetail, toggleLike as toggleNoteLike, toggleFavorite as toggleNoteFavorite, patchNoteDetail } from '@/store/modules/note'
import { toggleFollow } from '@/store/modules/user'
import { updateFeedItem } from '@/store/modules/home'
import './index.less'
const NoteDetail = () => {
  const dispatch: AppDispatch = useDispatch()

  //+ 详情数据（仅笔记）
  const noteDetail = useSelector((state: RootState) => state.note.noteDetail)
  //+ 当前用户ID（用于判断 isSelf，本人不显示关注按钮）
  const userId = useSelector((state: RootState) => state.user.userInfo?.id || '')

  //+ 路由参数：id（笔记ID）
  const router = Taro.getCurrentInstance().router
  const id = router?.params?.id || ''

  useEffect(() => {

    if (id) {
      dispatch(fetchNoteDetail({ id, type: 'note' }))
    }
  }, [dispatch, id])

  const isVideo = !!noteDetail?.videoUrl
  const authorId = noteDetail?.author?.id || ''
  const isSelf = !!userId && !!authorId && String(userId) === String(authorId)

  //+ Q8：点赞（note 模块 thunk → 单次 API；fulfilled 后 store 自动同步详情）
  //+ 问题1修复：同时同步 home store 中对应卡片的点赞状态，返回首页时卡片图标和数字一致
  const handleToggleLike = useCallback(async (nextIsLiked: boolean) => {
    if (!noteDetail?.id) return
    try {
      const action = await dispatch(toggleNoteLike(noteDetail.id))
      const ok = (action as any)?.meta?.requestStatus === 'fulfilled'
      if (ok) {
        const payload = (action as any)?.payload || {}
        const finalLiked = typeof payload.isLiked === 'boolean' ? payload.isLiked : nextIsLiked
        const finalCount = typeof payload.likeCount === 'number' ? payload.likeCount : (noteDetail.likeCount || 0) + (finalLiked ? 1 : -1)
        dispatch(updateFeedItem({ id: noteDetail.id, patch: { isLiked: finalLiked, likeCount: finalCount } }))
      }
      Taro.showToast({ title: nextIsLiked ? '点赞成功' : '已取消点赞', icon: 'success' })
    } catch (err) {
      console.warn('[NoteDetail] 点赞失败:', err)
    }
  }, [noteDetail, dispatch])

  //+ Q8：收藏（同时同步 home store，保证返回首页后卡片状态一致）
  const handleToggleFavorite = useCallback(async (nextIsFavorited: boolean) => {
    if (!noteDetail?.id) return
    try {
      const action = await dispatch(toggleNoteFavorite(noteDetail.id))
      const ok = (action as any)?.meta?.requestStatus === 'fulfilled'
      if (ok) {
        const payload = (action as any)?.payload || {}
        const finalFav = typeof payload.isFavorited === 'boolean' ? payload.isFavorited : nextIsFavorited
        dispatch(updateFeedItem({ id: noteDetail.id, patch: { isFavorited: finalFav } }))
      }
      Taro.showToast({ title: nextIsFavorited ? '收藏成功' : '已取消收藏', icon: 'success' })
    } catch (err) {
      console.warn('[NoteDetail] 收藏失败:', err)
    }
  }, [noteDetail, dispatch])

  //+ Q8：关注/取消关注（user 模块 thunk，成功后同步到笔记详情的 isFollowed）
  const handleToggleFollow = useCallback(async (authorUserId: string, nextIsFollowed: boolean) => {
    if (!authorUserId) return
    try {
      const action = await dispatch(toggleFollow(authorUserId))
      const ok = (action as any)?.meta?.requestStatus === 'fulfilled'
      if (ok) {
        const payload = (action as any)?.payload || {}
        const finalIsFollowed = typeof payload.isFollowed === 'boolean'
          ? payload.isFollowed
          : nextIsFollowed
        dispatch(patchNoteDetail({ isFollowed: finalIsFollowed }))
        Taro.showToast({ title: finalIsFollowed ? '关注成功' : '已取消关注', icon: 'success' })
      } else {
        Taro.showToast({ title: (action as any)?.payload || '操作失败', icon: 'none' })
      }
    } catch (err) {
      console.warn('[NoteDetail] 关注失败:', err)
    }
  }, [dispatch])

  return (
    <div className='note-detail-container'>
      {/* 顶部标题和返回箭头 */}
      <HeaderNavBar title='详情' backPageNum={1} fixed={false} />
      <div className='note-detail-content'>
        {/* 轮播图/视频 */}
       
      {isVideo
        ? <DetailBanner  videoUrl={noteDetail?.videoUrl} />
        : <DetailBanner  images={noteDetail?.images} />
      }
     
      
      {/* 笔记详情（含点赞/收藏/关注） */}
      <DetailInfo
        detail={noteDetail}
        actions={{
          isFollowed: noteDetail?.isFollowed,
          isSelf,
          authorId,
          onToggleFollow: handleToggleFollow,
        }}
      />

      {/* 评论 */}
      <CommentInput 
        detail={noteDetail}
        actions={{
          isLiked: noteDetail?.isLiked,
          likeCount: noteDetail?.likeCount,
          isFavorited: noteDetail?.isFavorited,
          favoriteCount: noteDetail?.collectCount,

          
          onToggleLike: handleToggleLike,
          onToggleFavorite: handleToggleFavorite
        }}
      />
      </div>
      
    </div>
  )
}

export default NoteDetail
