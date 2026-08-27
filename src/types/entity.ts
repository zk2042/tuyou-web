//+ 类型文件（types）模块权衡
//+ 优点：
//+   1. 职责清晰。实体(entity)和接口协议(api)、专项类型(upload)分文件维护，找东西快。
//+   2. 避免单文件膨胀。现在 index.ts 300 行，按模块乘 3 很快就 1000+ 行，编辑体验差、TypeScript 增量编译热点。
//+   3. 循环引用可控。upload 依赖只在 upload.ts，entity 和 api 互不 import。
//+   4. barrel 导出（types/index.ts 做聚合）保持调用方 import { X } from '@/types' 不变，零迁移成本。
//+ 缺点 / 折中：
//+   1. 类型跳转会多一层 barrel，IDE 还能正常追踪但不直观（可用 `import type {} from '@/types/api'` 直接跳）。
//+   2. 跨文件的类型派生（如 entity.Post → api.PageResult<entity.Post>）要在 api.ts import entity.ts，单向依赖即可。
//+   3. 拆分维度要稳定。选 "业务域 + 协议域"（entity/api/upload/activity/note…）不建议按 "每个 interface 一个文件" 过细拆分，import 噪音大。
//+
//+ 本次拆分：
//+   - entity.ts   User/UserPublic/Post/FeedItem/SlideItem/ActivityBanner/Activity/ActivityListItem/
//+                 Comment/InteractionMessage/SystemMessage/Tag/ProfilePostItem/FollowItem/FanItem
//+   - api.ts      UserRole/CATEGORY_MAP/getCategoryName/PageResult/ActivityListResult/
//+                 ProfileInfo/ProfileUpdate/ApiResponse
//+   - upload.ts   UploadType（上传文件的目的场景）
//+   - index.ts    barrel 导出（调用方零改动）

// ========== 业务实体 ==========

//+ 用户账号状态
//+ 0=禁用 1=正常 2=已注销
//+ 后端在用户相关响应中可能返回该字段，前端据此渲染角标/灰化
export type UserStatus = 0 | 1 | 2

//+ 用户信息接口
//+ status 为可选字段：后端在 /personal 等接口可能返回，未返回时按 undefined 处理（视为正常）
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
  //+ 账号状态：0=禁用 1=正常 2=已注销；未返回时为 undefined，前端按正常处理
  status?: UserStatus
}

//+ 用户公开资料接口（含关注状态，角色由 UserRole 枚举说明）
export interface UserPublic extends User {
  isFollowed?: boolean
}

//+ 用户基础信息（通用接口 /member/info 返回）
//+ role 为中文字符串：'领队' 或 '普通会员'
//+ 用于发布活动按钮等需要实时判断角色的场景
export interface MemberInfo {
  id: string
  nickname: string
  avatar: string
  role: '领队' | '普通会员'
}

//+ 用户详情（他人公开资料卡，GET /personal/member/{id} 返回）
//+ 与 User 区别：包含 favoriteCount/leadingCount/isFollowed/isFollower 等专用于他人资料卡展示的字段
//+ nickname/bio 已由后端做敏感词打星处理，前端原样展示即可
//+ status=2 表示已注销，前端标注"已注销"并隐藏关注按钮等可操作项
export interface UserDetail {
  id: string
  nickname: string
  avatar: string
  bio: string
  bgImg: string
  //+ 角色：领队 / 普通会员
  role: '领队' | '普通会员'
  //+ 账号状态：0=禁用 1=正常 2=已注销
  status: UserStatus
  followCount: number
  fansCount: number
  publishCount: number
  //+ 收藏数（他人资料卡专有）
  favoriteCount: number
  //+ 带队次数（普通会员为 0，他人资料卡专有）
  leadingCount: number
  //+ 我是否关注了 TA
  isFollowed: boolean
  //+ TA 是否关注我（用于互关判断）
  isFollower: boolean
}

//+ 活动报名人（GET /personal/publish-activity 列表项的 participants 数组元素）
//+ phone 仅领队（发布者本人）可见，非领队接口不返回该字段
export interface Participant {
  id: string
  avatar: string
  //+ 昵称（后端已做敏感词打星处理）
  nickname: string
  //+ 手机号明文，仅领队可见；非领队调用时该字段为 undefined
  phone?: string
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
  //+ 是否为本人发布（后端判断，true=显示头部 more + 删除操作入口）
  isOwner: boolean
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
  //+ 是否为视频（来自后端字段；优先级高于 videoUrl 判断）
  //+ 视频→封面 16:9；非视频→封面 3:4
  isVideo?: boolean
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
export interface Activity {
  id: string
  leader: {
    id: string
    nickname: string
    avatar: string
    //+ 领队个性签名（详情接口返回，可能很长，前端用 Ellipsis 截断）
    bio?: string
  
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
  //+ 是否已关注该活动（详情接口返回）
  isFollowed?: boolean
  //+ 活动微信群二维码图片地址
  //+ 仅"当前用户已报名"时详情接口返回；未报名/未登录返回 null/undefined
  //+ 详情页"已报名"下方二维码区块据此渲染
  wechatQR?: string
  members?: {
    id: string
    nickname: string
    avatar: string
  }[]
  //+ 是否为本人发布（true=显示头部 more + 删除操作入口）
  isOwner: boolean
}

//+ 活动列表项（与 OpenAPI GET /activities 响应 list 项对齐）
//+ activityStatus 为字符串：报名中/进行中/已结束
//+ participants 仅在"我发布的活动"接口（GET /personal/publish-activity）返回，全量报名人数组
//+ 其他活动列表接口不返回 participants，按 undefined 处理
export interface ActivityListItem {
  id: string
  leader: {
    id: string
    nickname: string
    avatar: string
    //+ 领队个性签名（列表接口若返回则展示）
    bio?: string
  }
  title: string
  coverImg: string
  category: string
  address: string
  startTime: string
  endTime: string
  signUpStart: string
  signUpEnd: string
  price: number
  maxPeople: number
  currentPeople: number
  difficulty: string
  activityStatus: string
  joined: boolean
  //+ 是否为本人发布（true=显示头部 more + 删除操作入口）
  isOwner: boolean
  //+ 报名人列表（仅 GET /personal/publish-activity 返回，全量；含手机号明文，仅领队可见）
  //+ 其他列表接口不返回该字段，使用时需判空
  participants?: Participant[]
}

//+ 评论数据结构（两级）
//+ 一级评论：replyToId=null，replyToName=null，可能有 replies 数组（二级评论）
//+ 二级评论：replyToId 指向父评论 id；若回复另一个二级评论则 replyToName 为被回复人昵称（渲染"A @ B"格式）
//+ canDelete：由后端结合"评论本人/内容作者"权限返回
//+ member.status：评论人账号状态（后端可能返回，0=禁用 2=已注销），用于在昵称右侧渲染角标
export interface Comment {
  id: string
  member: {
    id: string
    nickname: string
    avatar: string
    //+ 账号状态：后端可能返回，未返回时为 undefined（按正常处理）
    status?: UserStatus
  }
  content: string
  likeCount: number
  isLiked: boolean
  replyToId: string | null
  replyToName: string | null
  createdAt: string
  canDelete: boolean
  //+ 该一级评论下二级评论总数（后端返回，供"展开X条回复"使用；二级评论无此字段）
  replyCount?: number
  replies?: Comment[]
}

//+ 互动消息数据结构
//+ 互动消息（对齐 GET /messages/interactions 响应）
//+ 文档原始字段：id/msgType/content/sendTime/isRead/sender
//+ 前端兼容字段：type/member/targetTitle/createdAt/read/replyCount/replies
//+ 由 API 适配层 normalizeInteraction 从原始字段映射出来，组件层继续用兼容字段
export interface InteractionMessage {
  id: string
  //+ --- 文档字段 ---
  msgType: number
  content: string
  sendTime: string
  isRead: number
  sender: { id: string; nickname: string; avatar: string } | null
  //+ --- 前端兼容字段（API 适配层填充） ---
  type: 'like' | 'favorite' | 'follow' | 'comment'
  member: { id: string; nickname: string; avatar: string }
  targetTitle: string
  createdAt: string
  read: boolean
  replyCount: number
  //+ 评论消息的回复列表（仅 type='comment' 时有值，后端 comment.replies 映射）
  //+ sender: 'me'=我发出的回复，'you'=对方发给我的
  replies?: { id: string; sender: 'me' | 'you'; content: string }[]
}

//+ 系统消息（对齐 GET /messages/system 响应）
export interface SystemMessage {
  id: string
  //+ --- 文档字段 ---
  msgType: number
  content: string
  sendTime: string
  isRead: number
  sender: { id: string; nickname: string; avatar: string } | null
  //+ --- 前端兼容字段 ---
  type: 'system'
  createdAt: string
  read: boolean
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
  //+ 是否为视频（true=封面比例 16:9，false=原比例 3:4）
  isVideo: boolean
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
