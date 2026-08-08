//+ 活动模块Mock数据和路由
//+ 用户分两类：mockUsers=会员，mockLeaders=领队
import { randomInt, randomItem, randomDate, createPageResponse, successResponse, errorResponse } from './utils'
import { mockUsers, mockLeaders } from './user'

//+ 活动Banner数据
export const mockBanners = [
  {
    id: '1',
    title: '武功山云海露营',
    coverImg: 'https://picsum.photos/seed/banner-camp/800/450',
    currentPeople: 8,
    maxPeople: 20,
    activityStatus: 1
  },
  {
    id: '2',
    title: '楠溪江溯溪一日游',
    coverImg: 'https://picsum.photos/seed/banner-stream/800/450',
    currentPeople: 6,
    maxPeople: 15,
    activityStatus: 1
  },
  {
    id: '3',
    title: '千岛湖环湖骑行',
    coverImg: 'https://picsum.photos/seed/banner-bike/800/450',
    currentPeople: 12,
    maxPeople: 25,
    activityStatus: 1
  },
  {
    id: '4',
    title: '哈巴雪山攀登',
    coverImg: 'https://picsum.photos/seed/banner-mountain/800/450',
    currentPeople: 4,
    maxPeople: 10,
    activityStatus: 1
  },
  {
    id: '5',
    title: '青海湖自驾之旅',
    coverImg: 'https://picsum.photos/seed/banner-drive/800/450',
    currentPeople: 15,
    maxPeople: 30,
    activityStatus: 1
  }
]

//+ 活动类型列表（与 API 文档一致：徒步/露营/骑行/登山/跑步/攀岩/溯溪）
const activityTypes = ['徒步', '露营', '骑行', '登山', '跑步', '攀岩', '溯溪']

//+ 难度等级（与 OpenAPI 枚举一致）
const difficulties = ['入门', '中等', '中高等', '高等']

//+ 活动状态（与 OpenAPI 一致，后端按时间自动计算）
const activityStatusList = ['报名中', '进行中', '已结束']

//+ 地址列表
const addresses = [
  '江西省萍乡市武功山',
  '浙江省温州市楠溪江',
  '浙江省杭州市千岛湖',
  '云南省迪庆州哈巴雪山',
  '青海省海北州青海湖',
  '四川省阿坝州四姑娘山',
  '新疆独库公路',
  '西藏林芝地区'
]

//+ 活动标题模板
const activityTitles = [
  '周末{type}活动',
  '{type}爱好者聚会',
  '新手{type}入门',
  '资深{type}挑战',
  '{type}攻略分享会',
  '{type}装备交流'
]

//+ 生成活动数据（leader 从 mockLeaders 取，members 从 mockUsers 取）
function generateActivity(id: number) {
  const type = randomItem(activityTypes)
  //+ 领队从 mockLeaders 中随机选取，只提取 id/nickname/avatar
  const leader = randomItem(mockLeaders)
  const leaderInfo = {
    id: leader.id,
    nickname: leader.nickname,
    avatar: leader.avatar
  }

  return {
    id: String(id),
    leader: leaderInfo,
    title: activityTitles[randomInt(0, activityTitles.length - 1)].replace('{type}', type),
    coverImg: `https://picsum.photos/seed/activity${id}/400/300`,
    //+ 与 API 文档统一使用 category 字段
    category: type,
    address: randomItem(addresses),
    activityContent: `这是一个关于${type}的精彩活动，欢迎大家报名参加！`,
    startTime: randomDate(14),
    endTime: randomDate(7),
    signUpStart: randomDate(30),
    signUpEnd: randomDate(1),
    maxPeople: randomInt(10, 30),
    currentPeople: randomInt(1, 15),
    price: randomItem([0, 50, 100, 200, 500]),
    difficulty: randomItem(difficulties),
    //+ activityStatus 为字符串（报名中/进行中/已结束）
    activityStatus: randomItem(activityStatusList),
    joined: Math.random() > 0.5,
    //+ 成员从 mockUsers（会员）中随机选取
    members: Array.from({ length: randomInt(1, 5) }, () => {
      const member = mockUsers[randomInt(0, mockUsers.length - 1)]
      return {
        id: member.id,
        nickname: member.nickname,
        avatar: member.avatar
      }
    })
  }
}

//+ 生成活动列表数据
export const mockActivities: ReturnType<typeof generateActivity>[] = Array.from({ length: 20 }, (_, i) => generateActivity(i + 1))

//+ Mock路由映射：活动模块
export const activityMockRoutes: Record<string, (data?: any, url?: string) => any> = {
  //+ 获取首页活动Banner
  'GET /api/v1/activities/banners': () => successResponse(mockBanners),

  //+ 获取活动列表（与 OpenAPI 对齐：按 category 筛选）
  'GET /api/v1/activities': (data) => {
    const page = Number(data?.page) || 1
    const size = Number(data?.size) || 10

    let filteredActivities = [...mockActivities]

    //+ 根据分类筛选：'全部' 或不传 = 不过滤，其他按 category 精确匹配
    const category = data?.category
    if (category && category !== '全部') {
      filteredActivities = filteredActivities.filter(a => a.category === category)
    }

    return successResponse(createPageResponse(filteredActivities, page, size))
  },

  //+ 获取活动详情
  'GET /api/v1/activities/:id': (_, url) => {
    const id = (url as string).split('/').pop() || '1'
    const activity = mockActivities.find(a => a.id === id)
    if (activity) {
      return successResponse(activity)
    }
    return errorResponse('活动不存在')
  },

  //+ 创建活动（仅领队）
  'POST /api/v1/activities': (data) => {
    //+ 创建者为领队（mockLeaders[0]），只提取必要字段
    const creator = mockLeaders[0]
    const newActivity = {
      id: String(mockActivities.length + 1),
      leader: {
        id: creator.id,
        nickname: creator.nickname,
        avatar: creator.avatar
      },
      title: data?.title || '新活动',
      coverImg: data?.coverImg || '',
      category: data?.category || '徒步',
      address: data?.address || '',
      activityContent: data?.activityContent || '',
      startTime: data?.startTime || randomDate(14),
      endTime: data?.endTime || randomDate(7),
      //+ signUpStart/signUpEnd 由后端自动计算，Mock 仅占位
      signUpStart: new Date().toISOString().slice(0, 16).replace('T', ' '),
      signUpEnd: data?.startTime || randomDate(1),
      maxPeople: data?.maxPeople || 20,
      currentPeople: 0,
      price: data?.price || 0,
      difficulty: data?.difficulty || '中等',
      activityStatus: '报名中',
      joined: false,
      members: [] as { id: string; nickname: string; avatar: string }[]
    }
    mockActivities.unshift(newActivity)
    return successResponse(newActivity)
  },

  //+ 报名/取消报名（与 API 文档对齐：返回 isJoined + currentPeople）
  'POST /api/v1/activities/:id/signup': (_, url) => {
    //+ URL 格式 /api/v1/activities/{id}/signup，提取 id 需去掉 /signup 后取末段
    const id = (url as string).replace('/signup', '').split('/').pop() || '1'
    const activity = mockActivities.find(a => a.id === id)
    if (activity) {
      activity.joined = !activity.joined
      activity.currentPeople += activity.joined ? 1 : -1
      return successResponse({
        isJoined: activity.joined,
        currentPeople: activity.currentPeople
      })
    }
    return errorResponse('活动不存在')
  },

  //+ 获取我的活动
  'GET /api/v1/user/activities': () => {
    const myActivities = mockActivities.filter(a => a.joined)
    return successResponse(myActivities)
  }
}
