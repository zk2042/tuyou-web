//+ 搜索API接口封装（对接真实后端接口）
//+ 热门搜索：GET /hot-searches
//+ 全量搜索（内容/活动统一接口）：GET /search，通过 type=content/activity 区分
//+ 搜索历史：GET /search/history、DELETE /search/history（全部）、DELETE /search/history/:id（单条）
import { get, del } from '@/utils/request'
import type { FeedItem, ActivityListItem, PageResult } from '@/types'

//+ 搜索历史项
export interface SearchHistoryItem {
  id: string
  keyword: string
}

//+ 获取热门搜索关键词
//+ GET /hot-searches → data: string[]
export function getHotKeywordsAPI() {
  return get<string[]>('/hot-searches')
}

//+ 全量搜索（内容：笔记+攻略）
//+ GET /search?keyword=xxx&type=content&page=1&size=10
export function searchContentAPI(params: {
  keyword: string
  page: number
  size: number
}) {
  return get<PageResult<FeedItem>>('/search', {
    keyword: params.keyword,
    type: 'content',
    page: String(params.page),
    size: String(params.size)
  })
}

//+ 全量搜索（活动）
//+ GET /search?keyword=xxx&type=activity&page=1&size=10
export function searchActivitiesAPI(params: {
  keyword: string
  page: number
  size: number
}) {
  return get<PageResult<ActivityListItem>>('/search', {
    keyword: params.keyword,
    type: 'activity',
    page: String(params.page),
    size: String(params.size)
  })
}

//+ 获取搜索历史列表
//+ GET /search/history → data: SearchHistoryItem[]
export function getSearchHistoryAPI() {
  return get<SearchHistoryItem[]>('/search/history')
}

//+ 清空全部搜索历史
//+ DELETE /search/history
export function clearSearchHistoryAPI() {
  return del<null>('/search/history')
}

//+ 删除单条搜索历史
//+ DELETE /search/history/:id
export function deleteSearchHistoryItemAPI(id: string) {
  return del<null>(`/search/history/${id}`)
}
