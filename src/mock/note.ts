//+ 笔记/攻略模块Mock数据和路由
import { randomInt, randomItem, randomDate, createPageResponse, successResponse, errorResponse } from './utils'
import { mockUsers } from './user'
import user from '@/store/modules/user'

//+ 分类列表（名称→ID映射）
const CATEGORY_ID_MAP: Record<string, number> = {
  '徒步': 1, '露营': 2, '骑行': 3, '登山': 4, '跑步': 5, '攀岩': 6, '溯溪': 7,
}
const categories = ['徒步', '露营', '骑行', '登山', '跑步', '攀岩', '溯溪', '自驾', '装备', '摄影']

//+ 标签列表
const tags: Record<string, string[]> = {
  '徒步': ['徒步', '户外', '登山', '徒步路线', '徒步装备'],
  '露营': ['露营', '帐篷', '户外露营', '露营美食', '露营装备'],
  '骑行': ['骑行', '自行车', '骑行路线', '长途骑行', '山地车'],
  '登山': ['登山', '雪山', '高山', '登山装备', '登顶'],
  '跑步': ['跑步', '晨跑', '夜跑', '马拉松', '跑步打卡'],
  '攀岩': ['攀岩', '室内攀岩', '户外攀岩', '攀岩装备'],
  '溯溪': ['溯溪', '溪水', '清凉', '户外玩水'],
  '自驾': ['自驾', '自驾游', '公路旅行', '房车'],
  '装备': ['装备', '户外装备', '徒步装备', '露营装备'],
  '摄影': ['摄影', '户外摄影', '风景摄影', '人像摄影']
}

//+ 标题模板
const noteTitles: Record<string, string[]> = {
  '徒步': ['徒步攻略', '徒步日记', '徒步体验', '徒步路线推荐', '徒步装备分享'],
  '露营': ['露营日记', '露营装备', '露营地点推荐', '露营美食', '露营体验'],
  '骑行': ['骑行路线', '骑行日记', '骑行体验', '长途骑行', '骑行装备'],
  '登山': ['登山攻略', '登山日记', '登顶记录', '登山体验', '雪山攀登'],
  '跑步': ['跑步打卡', '跑步日记', '跑步路线', '马拉松训练', '跑步心得'],
  '攀岩': ['攀岩体验', '攀岩训练', '攀岩攻略', '攀岩装备'],
  '溯溪': ['溯溪体验', '溯溪攻略', '溯溪路线'],
  '自驾': ['自驾路线', '自驾游', '公路旅行', '房车旅行'],
  '装备': ['装备分享', '装备推荐', '装备评测'],
  '摄影': ['摄影分享', '摄影攻略', '风景摄影']
}

//+ 内容模板
const contents = [
  '这次的行程非常棒，风景如画，推荐给大家！',
  '分享一下这次的体验，希望对大家有帮助。',
  '详细的攻略来了，包含路线规划和装备推荐。',
  '第一次尝试，感觉非常不错，以后还要再来！',
  '记录一下这次的旅程，留下美好的回忆。',
  '装备分享，性价比很高，适合新手入门。',
  '路线推荐，避开人流高峰，享受宁静时光。',
  '体验分享，从零基础到完成，成就感满满。',
  '详细记录，包含每一天的行程安排。',
  '风景太美了，值得一去再去！'
]

//+ 路线信息模板（攻略专用）
const routeInfos = [
  { distance: '10km', duration: '1天', difficulty: '简单', transport: '徒步' },
  { distance: '15km', duration: '1天', difficulty: '中等', transport: '徒步' },
  { distance: '20km', duration: '2天', difficulty: '中等', transport: '大巴' },
  { distance: '30km', duration: '2天', difficulty: '困难', transport: '自驾' },
  { distance: '50km', duration: '3天', difficulty: '困难', transport: '大巴' },
  { distance: '100km', duration: '3天', difficulty: '困难', transport: '自行车' },
  { distance: '8km', duration: '半天', difficulty: '简单', transport: '徒步' },
  { distance: '12km', duration: '1天', difficulty: '中等', transport: '自驾' }
]

//+ 笔记详情模板
export const mockNoteDetailPost: Record<string, any> = {
  
  "id": "1",
  "type": "note",
  "author": {
    "id": "1",
    "nickname": "山林旅人",
    "avatar": "https://picsum.photos/seed/user1-avatar/100/100"
  },
  "title": "骑行路线推荐78",
  "coverImg": "https://picsum.photos/seed/post5-cover/300/400",
  "images": [
    "https://picsum.photos/seed/post5-img1/800/450",
    "https://picsum.photos/seed/post5-img2/800/450",
    "https://picsum.photos/seed/post5-img3/800/450"
  ],
  "videoUrl": "",
  "content": "详细的攻略来了，包含路线规划和装备推荐。",
  "viewCount": 2341,
  "likeCount": 189,
  "collectCount": 76,
  "commentCount": 45,
  "isLiked": false,
  "isFavorited": false,
  "isFollowed": false,
  "category": 3,
  "tags": ["骑行", "自行车", "骑行路线", "长途骑行"],
  "status": 1,
  "publishTime": "2026-04-15T08:30:00",

}

//+ 笔记评论列表模板
export const mockNoteCommentsPost: Record<string, any>[] =[
    {
      "id": "1",
      "member": {
        "id": "5",
        "nickname": "跑步酱",
        "avatar": "https://picsum.photos/seed/runner/100/100"
      },
      "content": "千岛湖环线太美了！沿着湖边骑行，微风拂面，感觉整个人都治愈了。",
      "likeCount": 12,
      "isLiked": false,
      "replyToId": null,
      "createdAt": "2026-04-18T12:00:00",
      "replies": [
        {
          "id": "2",
          "member": {
            "id": "1",
            "nickname": "山林旅人",
            "avatar": "https://picsum.photos/seed/traveler/100/100"
          },
          "content": "镇上租车很方便，我上次去是在淳安县租的公路车，一天才50块。",
          "likeCount": 5,
          "isLiked": false,
          "replyToId": "1",
          "createdAt": "2026-04-18T14:30:00"
        },
        {
          "id": "3",
          "member": {
            "id": "8",
            "nickname": "摄影师小杨",
            "avatar": "https://picsum.photos/seed/photo/100/100"
          },
          "content": "有没有具体的路线推荐？打算五一去。",
          "likeCount": 3,
          "isLiked": false,
          "replyToId": "1",
          "createdAt": "2026-04-18T15:20:00",
          "replies": [
            {
              "id": "4",
              "member": {
                "id": "5",
                "nickname": "跑步酱",
                "avatar": "https://picsum.photos/seed/runner/100/100"
              },
              "content": "推荐从淳安县城出发，沿淳杨线到汾口镇，再走千汾线返回，全程约140公里，风景超棒！",
              "likeCount": 8,
              "isLiked": false,
              "replyToId": "3",
              "createdAt": "2026-04-18T16:45:00"
            }
          ]
        }
      ]
    },
    {
      "id": "5",
      "member": {
        "id": "3",
        "nickname": "晨跑者阿杰",
        "avatar": "https://picsum.photos/seed/jie/100/100"
      },
      "content": "今天在西湖边晨跑，偶遇一群白鹭，感觉像在画中跑步。",
      "likeCount": 8,
      "isLiked": true,
      "replyToId": null,
      "createdAt": "2026-04-18T07:30:00",
      "replies": [
        {
          "id": "6",
          "member": {
            "id": "2",
            "nickname": "西湖渔夫",
            "avatar": "https://picsum.photos/seed/fisher/100/100"
          },
          "content": "苏堤那段路早上特别舒服，我每天在那钓鱼都能看到你们跑步的。",
          "likeCount": 2,
          "isLiked": false,
          "replyToId": "5",
          "createdAt": "2026-04-18T08:10:00"
        },
        {
          "id": "7",
          "member": {
            "id": "10",
            "nickname": "杭漂小陈",
            "avatar": "https://picsum.photos/seed/chen/100/100"
          },
          "content": "几点去人比较少？我也想试试。",
          "likeCount": 1,
          "isLiked": false,
          "replyToId": "5",
          "createdAt": "2026-04-18T08:35:00",
          "replies": [
            {
              "id": "8",
              "member": {
                "id": "3",
                "nickname": "晨跑者阿杰",
                "avatar": "https://picsum.photos/seed/jie/100/100"
              },
              "content": "我是6点到的，人不多，7点以后游客就多起来了。",
              "likeCount": 4,
              "isLiked": false,
              "replyToId": "7",
              "createdAt": "2026-04-18T09:00:00"
            },
            {
              "id": "9",
              "member": {
                "id": "2",
                "nickname": "西湖渔夫",
                "avatar": "https://picsum.photos/seed/fisher/100/100"
              },
              "content": "同意，而且清晨湖面上有雾气，特别有意境。",
              "likeCount": 3,
              "isLiked": false,
              "replyToId": "7",
              "createdAt": "2026-04-18T09:15:00"
            }
          ]
        },
        {
          "id": "10",
          "member": {
            "id": "6",
            "nickname": "跑马达人",
            "avatar": "https://picsum.photos/seed/marathon/100/100"
          },
          "content": "西湖一圈10公里左右，配速5分半的话正好1小时，我每周都刷。",
          "likeCount": 6,
          "isLiked": false,
          "replyToId": "5",
          "createdAt": "2026-04-18T09:30:00"
        }
      ]
    },
    {
      "id": "11",
      "member": {
        "id": "12",
        "nickname": "山野小鹿",
        "avatar": "https://picsum.photos/seed/deer/100/100"
      },
      "content": "周末去爬了黄山，虽然累但云海真的绝了！强烈推荐！",
      "likeCount": 15,
      "isLiked": false,
      "replyToId": null,
      "createdAt": "2026-04-17T20:15:00",
      "replies": [
        {
          "id": "12",
          "member": {
            "id": "7",
            "nickname": "背包客老刘",
            "avatar": "https://picsum.photos/seed/liu/100/100"
          },
          "content": "上下山是徒步还是坐索道？我膝盖不太好。",
          "likeCount": 2,
          "isLiked": false,
          "replyToId": "11",
          "createdAt": "2026-04-17T21:00:00",
          "replies": [
            {
              "id": "13",
              "member": {
                "id": "12",
                "nickname": "山野小鹿",
                "avatar": "https://picsum.photos/seed/deer/100/100"
              },
              "content": "我建议上山索道，下山徒步，这样既保护膝盖又能体验风景。",
              "likeCount": 7,
              "isLiked": false,
              "replyToId": "12",
              "createdAt": "2026-04-17T22:30:00"
            }
          ]
        },
        {
          "id": "14",
          "member": {
            "id": "15",
            "nickname": "旅行摄影师",
            "avatar": "https://picsum.photos/seed/photo2/100/100"
          },
          "content": "住山上还是山下？想看日出的话有什么建议？",
          "likeCount": 4,
          "isLiked": false,
          "replyToId": "11",
          "createdAt": "2026-04-18T08:00:00",
          "replies": [
            {
              "id": "15",
              "member": {
                "id": "12",
                "nickname": "山野小鹿",
                "avatar": "https://picsum.photos/seed/deer/100/100"
              },
              "content": "我住的白云宾馆，位置很好，离光明顶看日出很近，就是价格有点贵。",
              "likeCount": 9,
              "isLiked": true,
              "replyToId": "14",
              "createdAt": "2026-04-18T09:30:00"
            },
            {
              "id": "16",
              "member": {
                "id": "7",
                "nickname": "背包客老刘",
                "avatar": "https://picsum.photos/seed/liu/100/100"
              },
              "content": "也可以住汤口镇，第二天一早再上山，性价比更高。",
              "likeCount": 3,
              "isLiked": false,
              "replyToId": "14",
              "createdAt": "2026-04-18T09:45:00"
            }
          ]
        }
      ]
    },
    {
      "id": "17",
      "member": {
        "id": "9",
        "nickname": "城市骑行者",
        "avatar": "https://picsum.photos/seed/bike/100/100"
      },
      "content": "上海滨江骑行道真的太适合周末休闲骑了！从杨浦到徐汇全程40公里。",
      "likeCount": 10,
      "isLiked": false,
      "replyToId": null,
      "createdAt": "2026-04-17T16:00:00",
      "replies": [
        {
          "id": "18",
          "member": {
            "id": "14",
            "nickname": "浦东小旋风",
            "avatar": "https://picsum.photos/seed/pudong/100/100"
          },
          "content": "南浦大桥那段风景最漂亮，可以看到整个陆家嘴。",
          "likeCount": 6,
          "isLiked": false,
          "replyToId": "17",
          "createdAt": "2026-04-17T17:20:00"
        },
        {
          "id": "19",
          "member": {
            "id": "20",
            "nickname": "新手上路",
            "avatar": "https://picsum.photos/seed/newbie/100/100"
          },
          "content": "求问有没有租车点？还没买自行车。",
          "likeCount": 1,
          "isLiked": false,
          "replyToId": "17",
          "createdAt": "2026-04-17T18:00:00",
          "replies": [
            {
              "id": "20",
              "member": {
                "id": "9",
                "nickname": "城市骑行者",
                "avatar": "https://picsum.photos/seed/bike/100/100"
              },
              "content": "可以在梅赛德斯奔驰文化中心附近租，有很多共享单车和租赁点。",
              "likeCount": 5,
              "isLiked": false,
              "replyToId": "19",
              "createdAt": "2026-04-17T18:40:00"
            },
            {
              "id": "21",
              "member": {
                "id": "14",
                "nickname": "浦东小旋风",
                "avatar": "https://picsum.photos/seed/pudong/100/100"
              },
              "content": "也可以去迪卡侬租，一天才30块钱，很划算。",
              "likeCount": 4,
              "isLiked": false,
              "replyToId": "19",
              "createdAt": "2026-04-17T19:00:00"
            }
          ]
        },
        {
          "id": "22",
          "member": {
            "id": "11",
            "nickname": "夜景追风者",
            "avatar": "https://picsum.photos/seed/night/100/100"
          },
          "content": "晚上骑更美，灯光秀很震撼！不过要注意安全。",
          "likeCount": 7,
          "isLiked": false,
          "replyToId": "17",
          "createdAt": "2026-04-17T19:30:00"
        }
      ]
    },
    {
      "id": "23",
      "member": {
        "id": "16",
        "nickname": "户外小白",
        "avatar": "https://picsum.photos/seed/outdoor/100/100"
      },
      "content": "第一次参加越野跑，10公里差点没坚持下来，但冲线的那一刻太爽了！",
      "likeCount": 20,
      "isLiked": false,
      "replyToId": null,
      "createdAt": "2026-04-16T10:00:00",
      "replies": [
        {
          "id": "24",
          "member": {
            "id": "4",
            "nickname": "越野老张",
            "avatar": "https://picsum.photos/seed/zhang/100/100"
          },
          "content": "第一次能有这个成绩已经很不错了！装备选对了吗？",
          "likeCount": 3,
          "isLiked": false,
          "replyToId": "23",
          "createdAt": "2026-04-16T11:20:00",
          "replies": [
            {
              "id": "25",
              "member": {
                "id": "16",
                "nickname": "户外小白",
                "avatar": "https://picsum.photos/seed/outdoor/100/100"
              },
              "content": "穿的平时跑步的鞋，结果下山的时候打滑了好几次😂",
              "likeCount": 6,
              "isLiked": false,
              "replyToId": "24",
              "createdAt": "2026-04-16T12:00:00"
            },
            {
              "id": "26",
              "member": {
                "id": "4",
                "nickname": "越野老张",
                "avatar": "https://picsum.photos/seed/zhang/100/100"
              },
              "content": "那必须买一双越野鞋，齿纹深的那种，安全第一！",
              "likeCount": 8,
              "isLiked": true,
              "replyToId": "24",
              "createdAt": "2026-04-16T12:30:00"
            }
          ]
        },
        {
          "id": "27",
          "member": {
            "id": "17",
            "nickname": "补给站站长",
            "avatar": "https://picsum.photos/seed/station/100/100"
          },
          "content": "下次可以带点能量胶，到后半程体力跟不上会好很多。",
          "likeCount": 4,
          "isLiked": false,
          "replyToId": "23",
          "createdAt": "2026-04-16T13:00:00",
          "replies": [
            {
              "id": "28",
              "member": {
                "id": "16",
                "nickname": "户外小白",
                "avatar": "https://picsum.photos/seed/outdoor/100/100"
              },
              "content": "好的！已经下单了，还买了盐丸，下次准备充分再去！",
              "likeCount": 5,
              "isLiked": false,
              "replyToId": "27",
              "createdAt": "2026-04-16T14:00:00"
            }
          ]
        },
        {
          "id": "29",
          "member": {
            "id": "18",
            "nickname": "运动康复师",
            "avatar": "https://picsum.photos/seed/rehab/100/100"
          },
          "content": "记得做好拉伸，越野跑对肌肉要求很高，别受伤了。",
          "likeCount": 9,
          "isLiked": false,
          "replyToId": "23",
          "createdAt": "2026-04-16T15:00:00"
        },
        {
          "id": "30",
          "member": {
            "id": "19",
            "nickname": "爬山虎",
            "avatar": "https://picsum.photos/seed/climber/100/100"
          },
          "content": "在哪里跑的呀？下次可以约着一起！",
          "likeCount": 2,
          "isLiked": false,
          "replyToId": "23",
          "createdAt": "2026-04-16T16:00:00",
          "replies": [
            {
              "id": "31",
              "member": {
                "id": "16",
                "nickname": "户外小白",
                "avatar": "https://picsum.photos/seed/outdoor/100/100"
              },
              "content": "杭州西山森林公园，那边路线很多，可以组队！",
              "likeCount": 3,
              "isLiked": false,
              "replyToId": "30",
              "createdAt": "2026-04-16T17:00:00"
            }
          ]
        }
      ]
    }
  ]


//+ 生成笔记或攻略
function generatePost(id: number, member: typeof mockUsers[0], isGuide: boolean) {
  //+ id param converted to string in return object
  const category = randomItem(categories)
  const isVideo = !isGuide && Math.random() > 0.7
  const imageCount = isVideo ? 0 : randomInt(1, 5)
  const categoryTags = tags[category] || tags['徒步']
  const titleTemplates = noteTitles[category] || noteTitles['徒步']
  const categoryId = CATEGORY_ID_MAP[category] || 1
  
  //+ 生成图片URL
  const images: string[] = []
  for (let j = 0; j < imageCount; j++) {
    images.push(`https://picsum.photos/seed/post${id}-img${j + 1}/300/400`)
  }
  
  //+ 视频封面图（16:9）
  const videoUrl = isVideo ? `https://picsum.photos/seed/post${id}-video/400/225` : ''
  const coverImg = isVideo 
    ? `https://picsum.photos/seed/post${id}-video/400/225`
    : (images[0] || `https://picsum.photos/seed/post${id}-cover/300/400`)
  
  //+ 生成标签
  const postTags = [category]
  while (postTags.length < randomInt(2, 4)) {
    const tag = randomItem(categoryTags)
    if (!postTags.includes(tag)) {
      postTags.push(tag)
    }
  }
  
  return {
    id: String(id),
    type: isGuide ? 'guide' as const : 'note' as const,
    author: {
      id: member.id,
      nickname: member.nickname,
      avatar: member.avatar
    },
    title: `${randomItem(titleTemplates)}${randomInt(1, 100)}`,
    coverImg,
    images,
    videoUrl,
    content: randomItem(contents),
    viewCount: randomInt(50, 5000),
    likeCount: randomInt(10, 500),
    collectCount: randomInt(5, 200),
    commentCount: randomInt(1, 100),
    isLiked: false,
    isFavorited: false,
    isFollowed: false,
    category: categoryId,
    tags: postTags,
    status: 1,
    publishTime: randomDate(30),
    routeInfo: isGuide ? randomItem(routeInfos) : undefined
  }
}



//+ 生成所有笔记和攻略数据
let postId = 1
export const mockPosts: ReturnType<typeof generatePost>[] = []

//+ 共享自增ID（供攻略模块 mock 复用，避免跨模块修改 let 导出）
export function getNextPostId() {
  return postId++
}

//+ 为每个用户生成笔记和攻略
mockUsers.forEach(member => {
  //+ 生成笔记（1-10个）
  const noteCount = randomInt(1, 10)
  for (let i = 0; i < noteCount; i++) {
    mockPosts.push(generatePost(postId++, member, false))
  }

  //+ 生成攻略（1-10个）
  const guideCount = randomInt(1, 10)
  for (let i = 0; i < guideCount; i++) {
    mockPosts.push(generatePost(postId++, member, true))
  }
})

//+ Mock路由映射：笔记模块
export const noteMockRoutes: Record<string, (data?: any, url?: string) => any> = {
  //+ 获取笔记/攻略列表（瀑布流）

  'GET /api/v1/notes': (data) => {
    const page = data?.page || 1
    const size = data?.size || 10
    
    //+ 使用动态生成的mockPosts数据
    let filteredPosts = [...mockPosts]
    
    //+ 根据分类筛选
    const category = data?.category
    if (category && category !== '全部') {
      const categoryId = Number(category)
      if (!isNaN(categoryId)) {
        filteredPosts = filteredPosts.filter(n => n.category === categoryId)
      }
    }
    
    //+ 根据类型筛选（type为后端检索字段：note/guide）
    const type = data?.type
    if (type && type !== '全部') {
      if (type === '视频') {
        //+ 视频筛选：有videoUrl的笔记
        filteredPosts = filteredPosts.filter(n => n.videoUrl)
      } else {
        filteredPosts = filteredPosts.filter(n => n.type === type)
      }
    }
    
    //+ 排序
    const sort = data?.sort || '推荐'
    if (sort === '最新') {
      filteredPosts.sort((a, b) => new Date(b.publishTime).getTime() - new Date(a.publishTime).getTime())
    } else if (sort === '最热') {
      filteredPosts.sort((a, b) => b.viewCount - a.viewCount)
    }
    
    return successResponse(createPageResponse(filteredPosts, page, size))
  },

  //+ 获取笔记详情
  'GET /api/v1/notes/:id': (_, url) => {
    const id = (url as string).split('/').pop() || '1'
    const mockNote = mockNoteDetailPost
    if (mockNote) {
      console.log("成功获取笔记详情",mockNote)
      return successResponse(mockNote)
    }
    console.log("笔记不存在",id)
    return errorResponse('笔记不存在')
  },

  //+ 发布笔记
  'POST /api/v1/notes': (data) => {
    const newPost = {
      id: String(postId++),
      type: 'note' as const,
      author: mockUsers[0],
      title: data?.title || '新笔记',
      coverImg: data?.images?.[0] || '',
      images: data?.images || [],
      videoUrl: data?.videoUrl || '',
      content: data?.content || '',
      viewCount: 0,
      likeCount: 0,
      collectCount: 0,
      commentCount: 0,
      isLiked: false,
      isFavorited: false,
      isFollowed: false,
      category: data?.category || 1,
      tags: data?.tags || [],
      status: 1,
      publishTime: randomDate(0),
      routeInfo: undefined
    }
    mockPosts.unshift(newPost)
    return successResponse(newPost)
  },

  //+ 笔记点赞/取消点赞
  'POST /api/v1/notes/:id/like': (_, url) => {
    const id = (url as string).split('/')[2] || '1'
    const note = mockPosts.find(n => n.id === id)
    if (note) {
      note.isLiked = !note.isLiked
      note.likeCount += note.isLiked ? 1 : -1
      return successResponse({
        isLiked: note.isLiked,
        likeCount: note.likeCount
      })
    }
    return errorResponse('笔记不存在')
  },

  //+ 笔记收藏/取消收藏
  'POST /api/v1/notes/:id/favorite': (_, url) => {
    const id = (url as string).split('/')[2] || '1'
    const note = mockPosts.find(n => n.id === id)
    if (note) {
      note.isFavorited = !note.isFavorited
      note.collectCount += note.isFavorited ? 1 : -1
      return successResponse({
        isFavorited: note.isFavorited
      })
    }
    return errorResponse('笔记不存在')
  },

  //+ 获取笔记评论列表
  'GET /api/v1/notes/:id/comments': (_, url) => {
    const id = (url as string).split('/').pop() || '1'
    const mockNote = mockPosts.find(n => n.id === id)
    if (mockNote) {
      return successResponse(mockNoteCommentsPost)
    }
    return errorResponse('笔记不存在')
  },

  //+ 攻略相关路由已拆分到 src/mock/guide.ts
}
