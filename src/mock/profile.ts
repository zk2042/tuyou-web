//+ 个人中心模块Mock数据和路由
//+ 对应后端 /personal/* 系列接口（服务于 Profile/我的 系列页面）
import { createPageResponse, successResponse } from './utils'

//+ 当前登录用户（作者信息）
const me = {
  id: '13',
  nickname: '山鹰队长',
  avatar: 'https://picsum.photos/seed/profile-me/100/100'
}

//+ 主页信息
export const mockProfileInfo = {
  id: '1',
  nickname: '山鹰队长',
  avatar: 'https://picsum.photos/seed/profile-me/100/100',
  bio: '十年户外领队经验，带你走遍大好河山',
  bgImg: 'https://picsum.photos/seed/profile-bg/750/300',
  publishCount: 28,
  followCount: 18,
  fansCount: 65
}

//+ 标题/标签素材
const noteTitles = [
  '哈巴雪山攀登：人生第一座5396米',
  '武功山两日徒步日记',
  '青海湖环湖骑行体验',
  '千岛湖露营周末',
  '黄山云海日出记录',
  '泰山夜爬攻略分享',
  '川西自驾游记',
  '城市夜跑打卡路线',
  '溯溪清凉一夏',
  '室内攀岩新手指南'
]
const strategyTitles = [
  '青海湖环湖骑行攻略',
  '若尔盖草原露营攻略',
  '哈巴雪山攀登攻略',
  '武功山徒步路线攻略',
  '川西自驾路书',
  '黄山两日游攻略'
]
const tagNames = ['徒步', '露营', '骑行', '登山', '跑步', '攀岩', '溯溪', '自驾']

//+ 生成笔记/攻略列表项
function genPost(id: number, type: 'note' | 'strategy') {
  const titles = type === 'note' ? noteTitles : strategyTitles
  return {
    id: String(id),
    type,
    author: { ...me },
    coverImg: `https://picsum.photos/seed/${type}-${id}/300/400`,
    title: titles[id % titles.length],
    tag: tagNames[id % tagNames.length],
    likeCount: 100 + (id * 7) % 400,
    isLiked: id % 3 === 0
  }
}

//+ 生成用户列表项（关注/粉丝共用，同时含 followeeId/followerId 字段）
function genUser(id: number, isFollowed: boolean) {
  return {
    followeeId: String(id),
    followerId: String(id),
    nickname: `户外玩家${id}`,
    avatar: `https://picsum.photos/seed/user-${id}/100/100`,
    bio: '热爱大自然，享受户外时光',
    isFollowed
  }
}

//+ 生成活动列表项
function genActivity(id: number, joined: boolean) {
  const titles = ['武功山两日徒步', '青海湖骑行活动', '千岛湖露营聚会', '哈巴雪山攀登', '城市夜跑团']
  const addresses = ['江西萍乡', '青海海北', '浙江淳安', '云南迪庆', '杭州西湖']
  const difficulties = ['简单', '中等', '困难']
  const statuses = ['报名中', '进行中', '已结束']
  return {
    id: String(id),
    leader: { ...me },
    title: titles[id % titles.length],
    coverImg: `https://picsum.photos/seed/activity-${id}/400/225`,
    category: tagNames[id % tagNames.length],
    address: addresses[id % addresses.length],
    startTime: '2026-08-15 08:00:00',
    endTime: '2026-08-16 18:00:00',
    signUpEnd: '2026-08-13 08:00:00',
    price: 200 + (id * 50) % 300,
    maxPeople: 20,
    currentPeople: 5 + (id * 3) % 15,
    difficulty: difficulties[id % difficulties.length],
    activityStatus: statuses[id % statuses.length],
    joined
  }
}

//+ 批量生成各列表数据（数量与接口文档示例 total 对齐，便于验证分页）
const mockProfileNotes = Array.from({ length: 28 }, (_, i) => genPost(i + 1, 'note'))
const mockProfileStrategys = Array.from({ length: 12 }, (_, i) => genPost(i + 1, 'strategy'))
const mockFollowList = Array.from({ length: 18 }, (_, i) => genUser(i + 1, true))
const mockFansList = Array.from({ length: 65 }, (_, i) => genUser(i + 1, i % 2 === 0))
const mockFavoriteNotes = Array.from({ length: 8 }, (_, i) => genPost(i + 1, 'note'))
const mockFavoriteStrategys = Array.from({ length: 5 }, (_, i) => genPost(i + 1, 'strategy'))
const mockLikedNotes = Array.from({ length: 28 }, (_, i) => genPost(i + 1, 'note'))
const mockLikedStrategys = Array.from({ length: 12 }, (_, i) => genPost(i + 1, 'strategy'))
const mockPublishActivity = Array.from({ length: 5 }, (_, i) => genActivity(i + 1, true))
const mockJoinActivity = Array.from({ length: 3 }, (_, i) => genActivity(i + 1, true))

//+ 分页读取辅助：从 data 取 page/size，返回标准分页响应
function paged(items: any[], data?: any) {
  const page = Number(data?.page) || 1
  const size = Number(data?.size) || 10
  return successResponse(createPageResponse(items, page, size))
}

//+ 个人中心Mock路由（key 与 request.ts 的 relativeUrl 对齐：/api/v1 + /personal/*）
export const profileMockRoutes: Record<string, (data?: any, url?: string) => any> = {
  //+ 获取主页信息
  'GET /api/v1/personal': () => successResponse(mockProfileInfo),
  //+ 编辑个人信息
  'PUT /api/v1/personal': (data) => successResponse({ ...mockProfileInfo, ...data }),

  //+ 笔记/攻略列表
  'GET /api/v1/personal/notes': (data) => paged(mockProfileNotes, data),
  'GET /api/v1/personal/strategys': (data) => paged(mockProfileStrategys, data),

  //+ 关注/粉丝列表
  'GET /api/v1/personal/follow': (data) => paged(mockFollowList, data),
  'GET /api/v1/personal/fans': (data) => paged(mockFansList, data),

  //+ 收藏列表
  'GET /api/v1/personal/favorite-note': (data) => paged(mockFavoriteNotes, data),
  'GET /api/v1/personal/favorite-strategy': (data) => paged(mockFavoriteStrategys, data),

  //+ 点赞列表
  'GET /api/v1/personal/liked-notes': (data) => paged(mockLikedNotes, data),
  'GET /api/v1/personal/liked-strategys': (data) => paged(mockLikedStrategys, data),

  //+ 活动列表
  'GET /api/v1/personal/publish-activity': (data) => paged(mockPublishActivity, data),
  'GET /api/v1/personal/join-activity': (data) => paged(mockJoinActivity, data)
}
