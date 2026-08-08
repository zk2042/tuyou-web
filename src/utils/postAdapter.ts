//+ 内容列表数据适配器
//+ 统一 ProfilePostItem / GuideListItem / NoteListItem 为 FeedItem（瀑布流卡片通用格式）
import type { FeedItem, ProfilePostItem } from '@/types'

/**
 * ProfilePostItem → FeedItem（Content/Favorite/Like 接口返回的 item 统一转成 NoteList/PostWaterfall 接受的格式）
 * - strategy 类型映射成 guide（前端组件约定为 'note' | 'guide'）
 * - coverImg 转成 images[0]（瀑布流卡片第一张封面）
 * - 单个 tag（字符串）转成 tags（字符串数组）
 * - author → member
 */
export function toFeedItem(item: ProfilePostItem): FeedItem {
  return {
    id: item.id,
    title: item.title,
    images: item.coverImg ? [item.coverImg] : [],
    tags: item.tag ? [item.tag] : [],
    member: {
      nickname: item.author.nickname,
      avatar: item.author.avatar
    },
    likeCount: item.likeCount || 0,
    isLiked: !!item.isLiked,
    type: item.type === 'strategy' ? 'guide' : 'note',
    category: (item as any).category
  }
}

/**
 * 批量转换
 */
export function toFeedList(items: ProfilePostItem[]): FeedItem[] {
  return (items || []).map(toFeedItem)
}
