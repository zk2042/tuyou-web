//+ 社区首页Mock数据和路由
//+ 包含轮播（slides）和Feed流（feed）接口
import { randomInt, randomItem, createPageResponse, successResponse } from './utils'

//+ 轮播数据（从笔记、攻略、活动三张表查询is_slide=1的内容）
export const mockSlides = [
  //图片后面都变成16比9的图片
  {
    id: '1',
    type: 'note' as const,
    title: '四姑娘山大峰登顶记：三天两夜的雪山之旅',
    cover: 'https://picsum.photos/seed/slide1/800/450',
    tag: '登山'
  },
  {
    id: '2',
    type: 'guide' as const,
    title: '川藏线自驾终极攻略：318国道15天全记录',
    cover: 'https://picsum.photos/seed/slide2/800/450',
    tag: '自驾'
  },
  {
    id: '3',
    type: 'activity' as const,
    title: '武功山云海露营 · 周末两日',
    cover: 'https://picsum.photos/seed/slide3/800/450',
    tag: '露营',
    signUpStart: '2026-04-20 00:00',
    currentPeople: 5,
    maxPeople: 20
  },
  {
    id: '4',
    type: 'note' as const,
    title: '千岛湖环湖骑行：120公里的风景之旅',
    cover: 'https://picsum.photos/seed/slide4/800/450',
    tag: '骑行'
  },
  {
    id: '5',
    type: 'guide' as const,
    title: '楠溪江溯溪攻略：夏日清凉好去处',
    cover: 'https://picsum.photos/seed/slide5/800/450',
    tag: '溯溪'
  }
]

//+ Feed流数据（笔记/攻略混合列表，包含图片和视频两种内容）
//+ 生成模拟数据
const nicknames = ['山林旅人', '露营达人', '骑行发烧友', '登山爱好者', '跑步达人', '攀岩玩家', '溯溪探索者', '自驾游侠']
//+ 分类ID映射：1=徒步 2=露营 3=骑行 4=登山 5=跑步 6=攀岩 7=溯溪
const categoryList = [
  { id: 1, name: '徒步' },
  { id: 2, name: '露营' },
  { id: 3, name: '骑行' },
  { id: 4, name: '登山' },
  { id: 5, name: '跑步' },
  { id: 6, name: '攀岩' },
  { id: 7, name: '溯溪' },
]
const noteTitles = [
  '周末徒步记', '露营装备分享', '骑行路线推荐', '登山攻略', '跑步打卡',
  '攀岩体验', '溯溪一日游', '自驾日记', '摄影技巧', '装备评测'
]

//+ 生成Feed数据
function generateFeedItem(id: string, type: 'note' | 'guide') {
  const nickname = randomItem(nicknames)
  const cat = randomItem(categoryList)

  const title = `${randomItem(noteTitles)}${randomInt(1, 100)}`
  //+ 约25%概率为视频内容
  const isVideo = Math.random() < 0.25
  const imgCount = isVideo ? 0 : randomInt(1, 5)
  //+ 图片用3:4比例，视频用16:9比例
  const images = Array.from({ length: imgCount }, (_, i) =>
    `https://picsum.photos/seed/feed-${id}-img${i}/300/400`
  )
  const videoUrl = isVideo ? `https://picsum.photos/seed/feed-${id}-video/400/225` : undefined
  const tags = [cat.name, randomItem(['技巧', '分享', '攻略', '体验'])]

  return {
    id,
    title,
    images,
    videoUrl,
    tags,
    member: {
      nickname,
      avatar: `https://picsum.photos/seed/avatar-${id}/100/100`
    },
    likeCount: randomInt(10, 500),
    isLiked: Math.random() < 0.3,
    type,
    category: cat.id,
  }
}

//+ 生成所有Feed数据
let feedId = 1
export const mockFeed: ReturnType<typeof generateFeedItem>[] = []

//+ 生成笔记（含图片和视频）
for (let i = 0; i < 30; i++) {
  mockFeed.push(generateFeedItem(String(feedId++), 'note'))
}

//+ 生成攻略（含图片和视频）
for (let i = 0; i < 25; i++) {
  mockFeed.push(generateFeedItem(String(feedId++), 'guide'))
}

//+ Mock路由映射：首页模块
export const homeMockRoutes: Record<string, (data?: any, url?: string) => any> = {
  //+ 获取首页轮播
  'GET /api/v1/slides': () => successResponse(mockSlides),

  //+ 获取Feed流列表
  'GET /api/v1/feed': (data) => {
    const page = data?.page || 1
    const size = data?.size || 10

    let filteredFeed = [...mockFeed]

    //+ 根据分类筛选（后端按数字ID精确匹配）
    const category = data?.category
    if (category && category !== '全部') {
      //+ category参数是数字字符串（如\"1\"），需要转为数字比较
      const categoryId = Number(category)
      if (!isNaN(categoryId)) {
        filteredFeed = filteredFeed.filter(item => item.category === categoryId)
      }
    }

    //+ 排序
    const sort = data?.sort || '推荐'
    if (sort === '最新') {
      //+ 最新：不做特殊处理，保持生成顺序
    } else if (sort === '最热') {
      filteredFeed.sort((a, b) => b.likeCount - a.likeCount)
    }

    return successResponse(createPageResponse(filteredFeed, page, size))
  }
}
