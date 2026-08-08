//+ 公共类型定义，与API文档一致

//+ 用户角色：member=普通会员，leader=领队
export type UserRole = 'member' | 'leader'

//+ 用户信息接口
export interface User {
  id: string
  phone: string
  nickname: string
  avatar: string
  bio: string
  bgImg: string
  memberType: number
  publishCount: number
  followCount: number
  fansCount: number
  //+ 用户角色（会员/领队）
  role?: UserRole
}

//+ 用户公开资料接口（含关注状态）
export interface UserPublic extends User {
  isFollowed?: boolean
}

//+ 分类ID→名称映射（后端返回数字ID，前端映射为中文）
export const CATEGORY_MAP: Record<number, string> = {
  1: '徒步',
  2: '露营',
  3: '骑行',
  4: '登山',
  5: '跑步',
  6: '攀岩',
  7: '溯溪',
}

//+ 根据分类ID获取名称
export function getCategoryName(categoryId?: number): string {
  if (!categoryId) return ''
  return CATEGORY_MAP[categoryId] || ''
}

//+ Post数据结构（笔记/攻略详情）
//+ 笔记和攻略共用此结构，通过 type 区分（'note'/'guide'）
//+ 攻略额外包含 routeInfo
export interface Post {
  id: string
  type: 'note' | 'guide'
  author: {
    id: string
    nickname: string
    avatar: string
  }
  title: string
  coverImg: string
  images: string[]
  videoUrl?: string
  content: string
  viewCount: number
  likeCount: number
  collectCount: number
  commentCount: number
  isLiked: boolean
  isFavorited: boolean
  isFollowed: boolean
  category: number
  tags: string[]
  status: number
  publishTime: string
  routeInfo?: {
    distance: string
    duration: string
    difficulty: string
    transport: string
  }
}

//+ Feed流数据结构（首页瀑布流列表项）
//+ type字段值：note（笔记）/ guide（攻略）
export interface FeedItem {
  id: string
  title: string
  images: string[]
  videoUrl?: string
  tags: string[]
  member: {
    id?: string
    nickname: string
    avatar: string
  }
  likeCount: number
  collectCount?: number
  isLiked: boolean
  isFavorited?: boolean
  type: 'note' | 'guide'
  category?: number
}

//+ 轮播数据结构（首页轮播项）
//+ type字段值：note（笔记）/ guide（攻略）/ activity（活动）
export interface SlideItem {
  id: string
  type: 'note' | 'guide' | 'activity'
  title: string
  cover: string
  tag: string
  //+ 活动专属字段
  signUpStart?: string
  currentPeople?: number
  maxPeople?: number
}

//+ 活动Banner数据结构（活动页轮播入口）
export interface ActivityBanner {
  id: string
  title: string
  coverImg: string
  currentPeople: number
  maxPeople: number
  activityStatus: number
}


//+ 活动数据结构（详情，与 API 文档 GET /activities/{id} 响应对齐）
//+ 详情和列表均使用 category 字段（API 文档统一）
export interface Activity {
  id: string
  leader: {
    id: string
    nickname: string
    avatar: string
  }
  title: string
  coverImg: string
  category: string
  address: string
  activityContent: string
  startTime: string
  endTime: string
  signUpStart: string
  signUpEnd: string
  maxPeople: number
  currentPeople: number
  price: number
  difficulty: string
  //+ 活动状态：报名中/进行中/已结束（详情接口需展示状态标签）
  activityStatus?: string
  joined: boolean
  members?: {
    id: string
    nickname: string
    avatar: string
  }[]
}

//+ 活动列表项（与 OpenAPI GET /activities 响应 list 项对齐）
//+ activityStatus 为字符串：报名中/进行中/已结束
export interface ActivityListItem {
  id: string
  leader: {
    id: string
    nickname: string
    avatar: string
  }
  title: string
  coverImg: string
  category: string
  address: string
  startTime: string
  endTime: string
  signUpEnd: string
  price: number
  maxPeople: number
  currentPeople: number
  difficulty: string
  activityStatus: string
  joined: boolean
}

//+ 活动列表分页响应 data 结构
export interface ActivityListResult {
  list: ActivityListItem[]
  total: number
  page: number
  size: number
  total_page: number
}

//+ 评论数据结构
export interface Comment {
  id: string
  member: {
    id: string
    nickname: string
    avatar: string
  }
  content: string
  likeCount: number
  isLiked: boolean
  replyToId: string | null
  createdAt: string
  replies?: Comment[]
}

//+ 互动消息数据结构
export interface InteractionMessage {
  id: string
  type: 'like' | 'comment' | 'follow' | 'reply'
  member: {
    id: string
    nickname: string
    avatar: string
  }
  content: string
  targetTitle: string
  createdAt: string
  read: boolean
  replyCount: number
}

//+ 系统消息数据结构
export interface SystemMessage {
  id: string
  type: 'system'
  content: string
  createdAt: string
  read: boolean
}

//+ 分页响应数据结构
export interface PageResult<T> {
  list: T[]
  total: number
  page: number
  size: number
  total_page: number
}

//+ 个人主页信息（GET /personal 返回）
export interface ProfileInfo {
  id: string
  nickname: string
  avatar: string
  bio: string
  bgImg: string
  publishCount: number
  followCount: number
  fansCount: number
}

//+ 编辑个人信息请求参数（PUT /personal body）
export interface ProfileUpdate {
  avatar: string
  nickname: string
  bio: string
  bgImg: string
}

//+ 个人主页笔记/攻略列表项（type: note/strategy）
export interface ProfilePostItem {
  id: string
  type: 'note' | 'strategy'
  author: {
    id: string
    nickname: string
    avatar: string
  }
  coverImg: string
  title: string
  tag: string
  likeCount: number
  isLiked: boolean
}

//+ 关注列表项（followeeId=被关注者ID）
export interface FollowItem {
  followeeId: string
  nickname: string
  avatar: string
  bio: string
  isFollowed: boolean
}

//+ 粉丝列表项（followerId=粉丝ID）
export interface FanItem {
  followerId: string
  nickname: string
  avatar: string
  bio: string
  isFollowed: boolean
}

//+ 标签（发布笔记/攻略时供用户选择）
export interface Tag {
  id: number
  tagName: string
}

//+ 统一响应数据结构
export interface ApiResponse<T = any> {
  code: number
  message: string
  data: T
}