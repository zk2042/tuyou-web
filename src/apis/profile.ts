//+ 个人中心模块API接口封装
//+ 对接后端 /personal/* 系列接口（服务于 Profile/我的 页面）
import { get, put } from '@/utils/request'
import type {
  ProfileInfo,
  ProfileUpdate,
  ProfilePostItem,
  FollowItem,
  FanItem,
  ActivityListItem,
  PageResult
} from '@/types'

//+ 分页请求参数
interface PageParams {
  page: number
  size: number
}

//+ 获取主页信息
export function getProfileInfoAPI() {
  return get<ProfileInfo>('/personal')
}

//+ 编辑个人部分信息
export function updateProfileInfoAPI(params: ProfileUpdate) {
  return put<ProfileInfo>('/personal', params)
}

//+ 获取笔记列表
export function getProfileNotesAPI(params: PageParams) {
  return get<PageResult<ProfilePostItem>>('/personal/notes', params)
}

//+ 获取攻略列表
export function getProfileStrategysAPI(params: PageParams) {
  return get<PageResult<ProfilePostItem>>('/personal/strategys', params)
}

//+ 获取关注列表
export function getProfileFollowAPI(params: PageParams) {
  return get<PageResult<FollowItem>>('/personal/follow', params)
}

//+ 获取粉丝列表
export function getProfileFansAPI(params: PageParams) {
  return get<PageResult<FanItem>>('/personal/fans', params)
}

//+ 获取收藏笔记列表
export function getFavoriteNotesAPI(params: PageParams) {
  return get<PageResult<ProfilePostItem>>('/personal/favorite-note', params)
}

//+ 获取收藏攻略列表
export function getFavoriteStrategysAPI(params: PageParams) {
  return get<PageResult<ProfilePostItem>>('/personal/favorite-strategy', params)
}

//+ 获取点赞笔记列表
export function getLikedNotesAPI(params: PageParams) {
  return get<PageResult<ProfilePostItem>>('/personal/liked-notes', params)
}

//+ 获取点赞攻略列表
export function getLikedStrategysAPI(params: PageParams) {
  return get<PageResult<ProfilePostItem>>('/personal/liked-strategys', params)
}

//+ 发布的活动
export function getPublishActivityAPI(params: PageParams) {
  return get<PageResult<ActivityListItem>>('/personal/publish-activity', params)
}

//+ 参加的活动
export function getJoinActivityAPI(params: PageParams) {
  return get<PageResult<ActivityListItem>>('/personal/join-activity', params)
}
