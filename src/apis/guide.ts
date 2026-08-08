//+ 攻略API接口封装（对齐笔记API结构）
import { get, post, del } from '@/utils/request'

//+ 获取攻略列表
export function getGuidesAPI(params: {
  category?: number
  sort?: string
  page: number
  size: number
}) {
  return get('/guides', params)
}

//+ 获取攻略详情
export function getGuideDetailAPI(id: string) {
  return get(`/guides/${id}`)
}

//+ 发布攻略
export function createGuideAPI(params: {
  title: string
  content: string
  images?: string[]
  videoUrl?: string
  category?: number
  tags?: string[]
  // 攻略专属字段（路线信息）
  distance?: string
  duration?: string
  difficulty?: string
  transport?: string
}) {
  return post('/guides', params)
}

//+ 删除攻略
export function deleteGuideAPI(id: string) {
  return del(`/guides/${id}`)
}

//+ 点赞/取消点赞攻略
export function toggleGuideLikeAPI(id: string) {
  return post(`/guides/${id}/like`)
}

//+ 收藏/取消收藏攻略
export function toggleGuideFavoriteAPI(id: string) {
  return post(`/guides/${id}/favorite`)
}

//+ 获取攻略评论列表
export function getGuideCommentsAPI(id: string) {
  return get(`/guides/${id}/comments`)
}
