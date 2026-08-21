//+ 内容瀑布流组件（PostWaterfall）
//+ 布局：Masonry 错落排布（按累计列高分配，非奇偶）
//+ 封面：CoverBox 统一封装，onError 渲染兜底 UI，容器尺寸不受图片加载影响
//+ 渲染：直接渲染 FeedCard，H5/小程序逻辑统一，无离屏回收闪动
import { Loading, Ellipsis } from '@nutui/nutui-react'
import Taro from '@tarojs/taro'
import Tag from '@/components/Tag'
import type { FeedItem } from '@/types'
import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
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
  //+ 是否显示更多按钮（默认 true）
  more?: boolean
}

//+ Masonry 信息区 rem 定义（对应 less）：feed-info padding 0.6rem*2 + title 2行 + margin-bottom 0.4rem + meta 1rem ≈ 4.7rem
//+ 不写死 px，挂载后读取 html fontSize 动态换算，避免 Taro 缩放后 1rem 不是 16px 导致列高分配偏差累积
const INFO_HEIGHT_REM = 4.7
const CARD_GAP_REM = 0.4

/**
 * 计算单张卡片理论总高度（封面响应式高度 + 信息区固定高度）
 * 封面比例：图片 3:4，视频 16:9；封面高度 = 列宽 / 比例
 * infoHeightPx 由调用方动态传入（每次测量列宽时同步读取 html fontSize）
 */
function calcCardHeight(item: FeedItem, colWidth: number, infoHeightPx: number): number {
  const isVideo = typeof item.isVideo === 'boolean' ? item.isVideo : !!item.videoUrl
  //+ 封面高度：图片 colWidth * 4/3，视频 colWidth * 9/16
  const coverHeight = isVideo ? colWidth * 9 / 16 : colWidth * 4 / 3
  return coverHeight + infoHeightPx
}

/**
 * Masonry 砖石算法：遍历 feed，根据列宽计算每张卡片理论高度，放入累计高度更小的列
 * 返回 { left: FeedItem[], right: FeedItem[] }
 */
function masonryDistribute(feed: FeedItem[], colWidth: number, infoHeightPx: number, cardGapPx: number): { left: FeedItem[], right: FeedItem[] } {
  const left: FeedItem[] = []
  const right: FeedItem[] = []
  let leftHeight = 0
  let rightHeight = 0
  for (const item of feed) {
    const h = calcCardHeight(item, colWidth, infoHeightPx)
    if (leftHeight <= rightHeight) {
      left.push(item)
      leftHeight += h + cardGapPx
    } else {
      right.push(item)
      rightHeight += h + cardGapPx
    }
  }
  return { left, right }
}

/**
 * 统一点赞接口（按内容类型分发）
 */
async function toggleLikeByType(item: FeedItem, signal?: AbortSignal): Promise<{ isLiked: boolean, likeCount: number }> {
  const raw = item.type === 'guide'
    ? await toggleGuideLikeAPI(item.id, signal)
    : await toggleNoteLikeAPI(item.id, signal)
  const data: any = (raw as any)?.data ?? raw
  return {
    isLiked: !!data?.isLiked,
    likeCount: typeof data?.likeCount === 'number' ? data.likeCount : (item.likeCount + (data?.isLiked ? 1 : -1))
  }
}

/**
 * 统一收藏接口（按内容类型分发）
 */
async function toggleFavoriteByType(item: FeedItem, signal?: AbortSignal): Promise<{ isFavorited: boolean }> {
  const raw = item.type === 'guide'
    ? await toggleGuideFavoriteAPI(item.id, signal)
    : await toggleNoteFavoriteAPI(item.id, signal)
  const data: any = (raw as any)?.data ?? raw
  return { isFavorited: !!data?.isFavorited }
}

//+ CoverBox：封面容器，维持 aspect-ratio；图片 onError 渲染兜底 UI，容器尺寸不受图片加载影响
const CoverBox = ({
  item,
  isVideo
}: {
  item: FeedItem
  isVideo: boolean
}) => {
  const coverImg = item.images[0] || ''
  const [imgError, setImgError] = useState(false)

  //+ 切换 item 时重置错误状态（同 item 切图也需处理）
  useEffect(() => {
    setImgError(false)
  }, [coverImg])

  return (
    <div className={`feed-cover ${isVideo ? 'cover-video-box' : 'cover-image-box'}`}>
      {!imgError && coverImg ? (
        <img
          //+ 视频封面统一用 coverImg（第一张图），videoUrl 不是图片，不应作为 img src
          src={coverImg}
          alt={item.title}
          className={isVideo ? 'cover-video' : 'cover-image'}
          onError={() => setImgError(true)}
        />
      ) : (
        //+ 兜底 UI：封面加载失败/链接为空时渲染提示，不使用 alt 文字避免撑开盒子
        <div className='cover-fallback'>
          <span>{isVideo ? '视频封面' : '图片'}加载失败</span>
        </div>
      )}
      {/* 左上角分类标签：取 tags[0] */}
      {item.tags.length > 0 ? (
        <div className='feed-tag-wrapper'>
          <Tag tagName={item.tags[0]} />
        </div>
      ) : null}
      {/* 视频播放图标（居中） */}
      {isVideo && (
        <div className='feed-play-icon'>
          <span>▶</span>
        </div>
      )}
    </div>
  )
}

//+ 渲染单个Feed卡片
const FeedCard = ({
  item,
  onToggleLike,
  actionType = 'like',
  onToggleFavorite
}: {
  item: FeedItem
  onToggleLike?: PostWaterfallProps['onToggleLike']
  actionType?: 'like' | 'favorite'
  onToggleFavorite?: PostWaterfallProps['onToggleFavorite']
}) => {
  //+ 判断是否为视频内容：优先后端字段 isVideo，其次降级用 videoUrl 推断
  const isVideo = typeof item.isVideo === 'boolean' ? item.isVideo : !!item.videoUrl

  //+ 点赞状态（乐观更新，避免刷新整个列表）
  const [localLiked, setLocalLiked] = useState<boolean>(item.isLiked)
  const [localLikeCount, setLocalLikeCount] = useState<number>(item.likeCount || 0)
  const [liking, setLiking] = useState(false)

  //+ 收藏状态（仅 showFavorite=true 时使用）
  const [localFav, setLocalFav] = useState<boolean>(!!item.isFavorited)
  const [faving, setFaving] = useState(false)

  //+ AbortController：丢弃同资源过期请求（按 item.id 粒度）
  const likeAbortRef = useRef<AbortController | null>(null)
  const favAbortRef = useRef<AbortController | null>(null)
  //+ 操作冷却：完成后计时，防止接口响应极快时用户连续点击产生串行无效请求
  const likeCooldownRef = useRef<number>(0)
  const favCooldownRef = useRef<number>(0)
  const COOLDOWN_MS = 800

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

  //+ 卸载时 abort 未完成请求
  useEffect(() => {
    return () => {
      likeAbortRef.current?.abort()
      favAbortRef.current?.abort()
    }
  }, [])

  //+ 点赞/取消点赞（阻止冒泡，不触发卡片跳转）
  //+ 性能优化：请求锁(liking flag) + AbortController 丢弃过期 + API 失败回滚乐观值
  const handleLikeClick = async (e: any) => {
    e.stopPropagation()
    if (liking) return
    //+ 操作冷却
    if (Date.now() < likeCooldownRef.current) return
    //+ Abort 上一次同资源未完成请求
    likeAbortRef.current?.abort()
    const ac = new AbortController()
    likeAbortRef.current = ac

    const oldLiked = localLiked
    const oldCount = localLikeCount
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
      const { isLiked, likeCount } = await toggleLikeByType(item, ac.signal)
      setLocalLiked(isLiked)
      setLocalLikeCount(likeCount)
    } catch (err: any) {
      //+ AbortError：被主动丢弃，不回滚（最新 pending 已在 store/UI 侧处理）
      if (err?.name === 'AbortError') return
      //+ 失败回滚乐观值
      setLocalLiked(oldLiked)
      setLocalLikeCount(oldCount)
    } finally {
      if (likeAbortRef.current === ac) {
        likeAbortRef.current = null
      }
      setLiking(false)
      if (!ac.signal.aborted) {
        likeCooldownRef.current = Date.now() + COOLDOWN_MS
      }
    }
  }

  //+ 收藏/取消收藏（右上角；阻止冒泡）
  //+ 性能优化：请求锁(faving flag) + AbortController 丢弃过期 + API 失败回滚乐观值
  const handleFavClick = async (e: any) => {
    e.stopPropagation()
    if (faving) return
    //+ 操作冷却
    if (Date.now() < favCooldownRef.current) return
    favAbortRef.current?.abort()
    const ac = new AbortController()
    favAbortRef.current = ac

    const oldFav = localFav
    setFaving(true)
    try {
      const newFav = !localFav
      setLocalFav(newFav)
      onToggleFavorite?.(item, newFav)
      const { isFavorited } = await toggleFavoriteByType(item, ac.signal)
      setLocalFav(isFavorited)
    } catch (err: any) {
      if (err?.name === 'AbortError') return
      setLocalFav(oldFav)
    } finally {
      if (favAbortRef.current === ac) {
        favAbortRef.current = null
      }
      setFaving(false)
      if (!ac.signal.aborted) {
        favCooldownRef.current = Date.now() + COOLDOWN_MS
      }
    }
  }

  //+ 点击跳转详情（note→NoteDetail, guide→GuideDetail）
  const handleClick = () => {
    const pagePath = item.type === 'guide'
      ? '/pages/GuideDetail/index'
      : '/pages/NoteDetail/index'
    Taro.navigateTo({ url: `${pagePath}?id=${item.id}&type=${item.type}` })
  }

  return (
    <div className='feed-item' onClick={handleClick}>
      <CoverBox item={item} isVideo={isVideo} />
      <div className='feed-info'>
        <Ellipsis className='feed-title' content={item.title} rows={2} />
        <div className='feed-meta'>
          <img
            className='user-avatar'
            src={item.member?.avatar || ''}
            alt={item.member?.nickname || '匿名'}
          />
          <span className='user-name'>{item.member?.nickname || '匿名'}</span>
          {actionType === 'favorite' ? (
            //+ 收藏模式：底部右侧显示收藏图标（替代点赞图标），点击取消收藏
            <span className={`feed-likes ${localFav ? 'is-faved' : ''}`} onClick={handleFavClick}>
              <span className='like-icon'> {localFav ? '⭐' : '☆'} </span>
            </span>
          ) : (
            //+ 默认点赞模式：♥/♡ + 点赞数
            <span className={`feed-likes ${localLiked ? 'is-liked' : ''}`} onClick={handleLikeClick}>
              <span className='like-icon'> {localLiked ? '♥' : '♡'} </span> {localLikeCount}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

//+ Feed列表组件（语义化主名：PostWaterfall）
//+ 注：onItemClick / showFavorite / more 保留在 Props 接口供外部传入兼容，但内部不再使用（FeedCard 自行处理点击与收藏图标）
export function PostWaterfall({
  feed,
  loading = false,
  hasMore = false,
  onLoadMore,
  emptyText = '暂无内容',
  onToggleLike,
  actionType = 'like',
  onToggleFavorite
}: PostWaterfallProps) {
  //+ 列宽 ref：挂载后从 DOM 获取真实列宽，用于 Masonry 分配
  const containerRef = useRef<HTMLDivElement>(null)
  const [colWidth, setColWidth] = useState(0)
  //+ html fontSize（1rem=?px）：动态读取用于 rem→px 换算，避免 Taro 缩放偏差导致列高分配误差累积
  const [remPx, setRemPx] = useState(16)

  //+ 测量：同时读取列宽 + html fontSize（Taro 根据视口动态设置 1rem）
  const measureLayout = useCallback(() => {
    //+ html fontSize：H5 取 documentElement.style.fontSize 计算值，SSR/小程序兜底 16
    const htmlEl = typeof document !== 'undefined' ? document.documentElement : null
    const computedFontSize = htmlEl ? parseFloat(getComputedStyle(htmlEl).fontSize) : NaN
    const currentRemPx = Number.isFinite(computedFontSize) && computedFontSize > 0 ? computedFontSize : 16
    setRemPx(currentRemPx)

    const el = containerRef.current
    if (!el) return
    //+ 容器内宽 - gap（动态换算 CARD_GAP_REM），再平分两列
    const cardGapPx = CARD_GAP_REM * currentRemPx
    const containerWidth = el.clientWidth
    if (containerWidth > 0) {
      setColWidth(Math.floor((containerWidth - cardGapPx) / 2))
    }
  }, [])

  //+ 挂载后测量 + 监听 resize/orientationchange 重排 Masonry
  useEffect(() => {
    measureLayout()
    const handleResize = () => measureLayout()
    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleResize)
    }
  }, [measureLayout])

  //+ Masonry 分配：列宽 / remPx / feed 变化时重新计算
  const { leftColumn, rightColumn } = useMemo(() => {
    //+ 入口过滤脏数据：member 为 null 的项不进入渲染流程，避免 FeedCard 内访问 null.avatar 崩溃
    const safeFeed = feed.filter(item => item && item.member)
    if (colWidth === 0) {
      //+ 列宽未就绪：退化为奇偶分配，避免首屏空白（轻微布局抖动，方案固有代价）
      const left = safeFeed.filter((_, i) => i % 2 === 0)
      const right = safeFeed.filter((_, i) => i % 2 === 1)
      return { leftColumn: left, rightColumn: right }
    }
    const infoHeightPx = INFO_HEIGHT_REM * remPx
    const cardGapPx = CARD_GAP_REM * remPx
    const { left, right } = masonryDistribute(safeFeed, colWidth, infoHeightPx, cardGapPx)
    return { leftColumn: left, rightColumn: right }
  }, [feed, colWidth, remPx])

  //+ 渲染单列卡片（共用逻辑，避免重复）
  //+ 已移除 VirtualItem 离屏回收：直接渲染 FeedCard，H5/小程序逻辑统一，消除闪动
  const renderColumn = (items: FeedItem[]) => {
    return items.map(item => (
      <FeedCard
        key={`${item.type}_${item.id}`}
        item={item}
        onToggleLike={onToggleLike}
        actionType={actionType}
        onToggleFavorite={onToggleFavorite}
      />
    ))
  }

  //+ 加载中且无数据
  if (loading && feed.length === 0) {
    return (
      <div className='note-list-loading'>
        <Loading>加载中...</Loading>
      </div>
    )
  }

  //+ 空状态
  if (feed.length === 0) {
    return (
      <div className='note-list-empty'>
        <p>{emptyText}</p>
      </div>
    )
  }

  return (
    <div className='note-list-container'>
      {/* Masonry 瀑布流布局：按累计列高分配，两列直接渲染 FeedCard */}
      <div className='waterfall-container' ref={containerRef}>
        <div className='waterfall-column'>
          {renderColumn(leftColumn)}
        </div>
        <div className='waterfall-column'>
          {renderColumn(rightColumn)}
        </div>
      </div>

      {/* 加载更多（备用：默认由上拉触发，此处保留手动兜底） */}
      {hasMore && onLoadMore && (
        <div className='note-list-load-more' onClick={onLoadMore}>
          {loading ? <Loading>加载中...</Loading> : <span>加载更多</span>}
        </div>
      )}

      {/* 没有更多 */}
      {!hasMore && feed.length > 0 && (
        <div className='note-list-no-more'>
          <span>已加载全部</span>
        </div>
      )}
    </div>
  )
}

//+ 兼容原组件名 NoteList（其他 import NoteList 的页面不改也能继续用）
export const NoteList = PostWaterfall
export default PostWaterfall
