//+ 内容瀑布流组件（原 NoteList 语义化重命名为 PostWaterfall，支持笔记/攻略混合）
//+ 卡片布局：封面（Tag左上角 + 收藏/视频图标）+ 标题 + 头像昵称点赞
//+ 图片 3:4 比例，视频 16:9 比例，严格两列布局
import { Loading } from '@nutui/nutui-react'
import Taro from '@tarojs/taro'
import Tag from '@/components/Tag'
import type { FeedItem } from '@/types'
import { useState, useEffect } from 'react'
import { toggleNoteLikeAPI, toggleNoteFavoriteAPI } from '@/apis/note'
import { toggleGuideLikeAPI, toggleGuideFavoriteAPI } from '@/apis/guide'
import './index.less'

//+ 组件Props接口
export interface PostWaterfallProps {
  //+ Feed流数据
  feed: FeedItem[]
  //+ 加载状态
  loading?: boolean
  //+ 是否还有更多
  hasMore?: boolean
  //+ 加载更多回调（可选；Q7 由页面 useReachBottom 触发，此处仅做展示 fallback）
  onLoadMore?: () => void
  //+ 点击卡片回调（不传时内部自动跳 NoteDetail/GuideDetail）
  onItemClick?: (item: FeedItem) => void
  //+ 空状态文案
  emptyText?: string
  //+ 点赞切换成功回调（用于我的点赞列表取消后移除项）
  onToggleLike?: (item: FeedItem, newIsLiked: boolean, newLikeCount: number) => void
  //+ 底部右侧操作图标类型：'like'（默认，♥/♡+点赞数）| 'favorite'（⭐/☆，点击取消收藏，用于我的收藏页替代点赞图标）
  actionType?: 'like' | 'favorite'
  //+ 是否显示右上角收藏图标（默认 false；actionType='favorite' 时自动隐藏，避免重复）
  showFavorite?: boolean
  //+ 收藏切换成功回调（用于我的收藏列表取消收藏后移除项）
  onToggleFavorite?: (item: FeedItem, newIsFavorited: boolean) => void
}

/**
 * 统一点赞接口（按内容类型分发）
 */
async function toggleLikeByType(item: FeedItem): Promise<{ isLiked: boolean; likeCount: number }> {
  const raw = item.type === 'guide'
    ? await toggleGuideLikeAPI(item.id)
    : await toggleNoteLikeAPI(item.id)
  const data: any = (raw as any)?.data ?? raw
  return {
    isLiked: !!data?.isLiked,
    likeCount: typeof data?.likeCount === 'number' ? data.likeCount : (item.likeCount + (data?.isLiked ? 1 : -1))
  }
}

/**
 * 统一收藏接口（按内容类型分发）
 */
async function toggleFavoriteByType(item: FeedItem): Promise<{ isFavorited: boolean }> {
  const raw = item.type === 'guide'
    ? await toggleGuideFavoriteAPI(item.id)
    : await toggleNoteFavoriteAPI(item.id)
  const data: any = (raw as any)?.data ?? raw
  return { isFavorited: !!data?.isFavorited }
}

//+ 渲染单个Feed卡片
const FeedCard = ({
  item,
  onClick,
  onToggleLike,
  actionType = 'like',
  showFavorite = false,
  onToggleFavorite
}: {
  item: FeedItem
  onClick?: () => void
  onToggleLike?: PostWaterfallProps['onToggleLike']
  actionType?: 'like' | 'favorite'
  showFavorite?: boolean
  onToggleFavorite?: PostWaterfallProps['onToggleFavorite']
}) => {
  //+ 封面图：第一张图片作为封面
  const coverImg = item.images[0] || ''
  //+ 判断是否为视频内容
  const isVideo = !!item.videoUrl

  //+ 点赞状态（乐观更新，避免刷新整个列表）
  const [localLiked, setLocalLiked] = useState<boolean>(item.isLiked)
  const [localLikeCount, setLocalLikeCount] = useState<number>(item.likeCount || 0)
  const [liking, setLiking] = useState(false)

  //+ 收藏状态（仅 showFavorite=true 时使用）
  const [localFav, setLocalFav] = useState<boolean>(!!item.isFavorited)
  const [faving, setFaving] = useState(false)

  //+ 问题1修复：当外部 prop（从详情返回时从 store 同步回来）变化时，同步到本地 state，避免陈旧乐观值
  useEffect(() => {
    setLocalLiked(item.isLiked)
  }, [item.isLiked])
  useEffect(() => {
    if (typeof item.likeCount === 'number') {
      setLocalLikeCount(item.likeCount)
    }
  }, [item.likeCount])
  useEffect(() => {
    setLocalFav(!!item.isFavorited)
  }, [item.isFavorited])

  //+ 点赞/取消点赞（阻止冒泡，不触发卡片跳转）
  const handleLikeClick = async (e: any) => {
    e.stopPropagation()
    if (liking) return
    setLiking(true)
    try {
      const newLiked = !localLiked
      //+ 乐观更新 UI
      setLocalLiked(newLiked)
      const optimisticCount = localLikeCount + (newLiked ? 1 : -1)
      setLocalLikeCount(optimisticCount)
      //+ 通知调用方（例如"我的点赞"列表可以立刻移除项）
      onToggleLike?.(item, newLiked, optimisticCount)
      //+ 异步调用 API（用真实返回值校准最终 count）
      try {
        const { isLiked, likeCount } = await toggleLikeByType(item)
        setLocalLiked(isLiked)
        setLocalLikeCount(likeCount)
      } catch (_err) { /* 乐观成功，API 失败时无感知 */ }
    } finally {
      setLiking(false)
    }
  }

  //+ 收藏/取消收藏（右上角；阻止冒泡）
  const handleFavClick = async (e: any) => {
    e.stopPropagation()
    if (faving) return
    setFaving(true)
    try {
      const newFav = !localFav
      setLocalFav(newFav)
      onToggleFavorite?.(item, newFav)
      try {
        const { isFavorited } = await toggleFavoriteByType(item)
        setLocalFav(isFavorited)
      } catch (_err) { /* 忽略 */ }
    } finally {
      setFaving(false)
    }
  }

  //+ 点击跳转详情（note→NoteDetail, guide→GuideDetail）
  const handleClick = () => {
    // if (onClick) {
    //   onClick()
    //   return
    // }
    const pagePath = item.type === 'guide'
      ? '/pages/GuideDetail/index'
      : '/pages/NoteDetail/index'
    Taro.navigateTo({ url: `${pagePath}?id=${item.id}&type=${item.type}` })
  }

  return (
    <div className="feed-item" onClick={handleClick}>
      <div className="feed-cover">
        <img
          //+ 问题2修复：视频封面统一用 coverImg（第一张图），videoUrl 不是图片，不应作为 img src
          src={coverImg}
          alt={item.title}
          className={isVideo ? 'cover-video' : 'cover-image'}
        />
        {/* 左上角分类标签：取 tags[0] */}
        {item.tags.length > 0 && (
          <div className="feed-tag-wrapper">
            <Tag tagName={item.tags[0]} />
          </div>
        )}
        {/* 右上角收藏图标（仅 showFavorite=true 且 actionType!='favorite' 时显示；favorite 模式下收藏图标已移到底部） */}
        {showFavorite && actionType !== 'favorite' && (
          <div className="feed-favorite-wrapper" onClick={handleFavClick}>
            <span className={`iconfont ${localFav ? 'icon-shoucangfill feed-fav-fill' : 'icon-shoucang feed-fav-empty'}`}></span>
          </div>
        )}
        {/* 视频播放图标（居中） */}
        {isVideo && (
          <div className="feed-play-icon">
            <span>▶</span>
          </div>
        )}
      </div>
      <div className="feed-info">
        <div className="feed-title">{item.title}</div>
        <div className="feed-meta">
          <img
            className="user-avatar"
            src={item.member.avatar}
            alt={item.member.nickname}
          />
          <span className="user-name">{item.member.nickname}</span>
          {actionType === 'favorite' ? (
            //+ 收藏模式：底部右侧显示收藏图标（替代点赞图标），点击取消收藏
            <span className={`feed-likes ${localFav ? 'is-faved' : ''}`} onClick={handleFavClick}>
              <span className="like-icon"> {localFav ? '⭐' : '☆'} </span>
            </span>
          ) : (
            //+ 默认点赞模式：♥/♡ + 点赞数
            <span className={`feed-likes ${localLiked ? 'is-liked' : ''}`} onClick={handleLikeClick}>
              <span className="like-icon"> {localLiked ? '♥' : '♡'} </span> {localLikeCount}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

//+ Feed列表组件（语义化主名：PostWaterfall）
export function PostWaterfall({
  feed,
  loading = false,
  hasMore = false,
  onLoadMore,
  onItemClick,
  emptyText = '暂无内容',
  onToggleLike,
  actionType = 'like',
  showFavorite = false,
  onToggleFavorite
}: PostWaterfallProps) {
  //+ 加载中且无数据
  if (loading && feed.length === 0) {
    return (
      <div className="note-list-loading">
        <Loading>加载中...</Loading>
      </div>
    )
  }

  //+ 空状态
  if (feed.length === 0) {
    return (
      <div className="note-list-empty">
        <p>{emptyText}</p>
      </div>
    )
  }

  return (
    <div className="note-list-container">
      {/* 瀑布流布局 */}
      <div className="waterfall-container">
        <div className="waterfall-column">
          {feed.filter((_, i) => i % 2 === 0).map(item => (
            <FeedCard
              key={item.id}
              item={item}
              onClick={() => onItemClick?.(item)}
              onToggleLike={onToggleLike}
              actionType={actionType}
              showFavorite={showFavorite}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
        <div className="waterfall-column">
          {feed.filter((_, i) => i % 2 === 1).map(item => (
            <FeedCard
              key={item.id}
              item={item}
              onClick={() => onItemClick?.(item)}
              onToggleLike={onToggleLike}
              actionType={actionType}
              showFavorite={showFavorite}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      </div>

      {/* 加载更多（备用：默认由上拉触发，此处保留手动兜底） */}
      {hasMore && onLoadMore && (
        <div className="note-list-load-more" onClick={onLoadMore}>
          {loading ? <Loading>加载中...</Loading> : <span>加载更多</span>}
        </div>
      )}

      {/* 没有更多 */}
      {!hasMore && feed.length > 0 && (
        <div className="note-list-no-more">
          <span>已加载全部</span>
        </div>
      )}
    </div>
  )
}

//+ 兼容原组件名 NoteList（其他 import NoteList 的页面不改也能继续用）
export const NoteList = PostWaterfall
export default PostWaterfall
