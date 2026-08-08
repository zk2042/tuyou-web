//+ 活动API接口封装（与 OpenAPI 文档对齐）
import { get, post, del } from '@/utils/request'
import type { ActivityListResult } from '@/types'

//+ 获取活动Banner（首页活动入口轮播）
export function getActivityBannersAPI() {
  return get('/activities/banners')
}

//+ 获取活动列表
//+ category 不传=全部，传中文字符串（徒步/露营/骑行/登山/跑步/攀岩/溯溪）
export function getActivityListAPI(params: {
  category?: string
  page: number
  size: number
}) {
  return get<ActivityListResult>('/activities', params)
}

//+ 兼容旧命名（部分代码可能引用 getActivitiesAPI）
export const getActivitiesAPI = getActivityListAPI

//+ 获取活动详情
export function getActivityDetailAPI(id: string) {
  return get(`/activities/${id}`)
}

//+ 创建活动（仅领队，与 API 文档 POST /activities 对齐）
//+ 字段使用 category（非 activityType），signUpStart/signUpEnd 由后端自动计算
export function createActivityAPI(params: {
  title: string
  category: string
  coverImg: string
  address: string
  startTime: string
  endTime: string
  price: number
  maxPeople: number
  difficulty: string
  activityContent: string
}) {
  return post('/activities', params)
}

//+ 报名/取消报名，返回 { isJoined, currentPeople }
export function toggleActivitySignupAPI(id: string) {
  return post(`/activities/${id}/signup`)
}

//+ 删除活动（领队）
export function deleteActivityAPI(id: string) {
  return del(`/activities/${id}`)
}

//+ 获取我的活动
export function getMyActivitiesAPI() {
  return get('/user/activities')
}
