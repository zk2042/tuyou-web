//+ 攻略模块Mock数据与路由
//+ 说明：从 mock/note.ts 拆分而来，攻略路由独立维护
//+ 复用：mockPosts（含笔记+攻略共享数据）从 note.ts 导入，保持单一数据源
import { createPageResponse, successResponse, errorResponse, randomDate } from './utils'
import { mockUsers } from './user'
import { mockPosts, getNextPostId, mockNoteCommentsPost } from './note'

//+ 攻略模块Mock路由映射
export const guideMockRoutes: Record<string, (data?: any, url?: string) => any> = {
  //+ 获取攻略列表
  'GET /api/v1/guides': (data) => {
    const page = data?.page || 1
    const size = data?.size || 10
    let filtered = mockPosts.filter(n => n.type === 'guide')
    const category = data?.category
    if (category && category !== '全部') {
      const categoryId = Number(category)
      if (!isNaN(categoryId)) filtered = filtered.filter(n => n.category === categoryId)
    }
    const sort = data?.sort || '推荐'
    if (sort === '最新') filtered.sort((a, b) => new Date(b.publishTime).getTime() - new Date(a.publishTime).getTime())
    else if (sort === '最热') filtered.sort((a, b) => b.viewCount - a.viewCount)
    return successResponse(createPageResponse(filtered, page, size))
  },

  //+ 获取攻略详情
  'GET /api/v1/guides/:id': (_, url) => {
    const id = (url as string).split('/')[2] || '1'
    const guide = mockPosts.find(n => n.id === id && n.type === 'guide') || mockPosts.find(n => n.id === id)
    if (guide) return successResponse(guide)
    return errorResponse('攻略不存在')
  },

  //+ 发布攻略
  'POST /api/v1/guides': (data) => {
    const routeInfo = (data?.distance || data?.duration || data?.difficulty || data?.transport)
      ? {
          distance: data?.distance,
          duration: data?.duration,
          difficulty: data?.difficulty,
          transport: data?.transport
        }
      : undefined
    const newGuide = {
      id: String(getNextPostId()),
      type: 'guide' as const,
      author: mockUsers[0],
      title: data?.title || '新攻略',
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
      routeInfo
    }
    mockPosts.unshift(newGuide as any)
    return successResponse(newGuide)
  },

  //+ 删除攻略
  'DELETE /api/v1/guides/:id': (_, url) => {
    const id = (url as string).split('/')[2] || '1'
    const idx = mockPosts.findIndex(n => n.id === id)
    if (idx >= 0) { mockPosts.splice(idx, 1); return successResponse({ message: '删除成功' }) }
    return errorResponse('攻略不存在')
  },

  //+ 攻略点赞/取消点赞
  'POST /api/v1/guides/:id/like': (_, url) => {
    const id = (url as string).split('/')[2] || '1'
    const guide = mockPosts.find(n => n.id === id)
    if (guide) {
      guide.isLiked = !guide.isLiked
      guide.likeCount += guide.isLiked ? 1 : -1
      return successResponse({ isLiked: guide.isLiked, likeCount: guide.likeCount })
    }
    return errorResponse('攻略不存在')
  },

  //+ 攻略收藏/取消收藏
  'POST /api/v1/guides/:id/favorite': (_, url) => {
    const id = (url as string).split('/')[2] || '1'
    const guide = mockPosts.find(n => n.id === id)
    if (guide) {
      guide.isFavorited = !guide.isFavorited
      guide.collectCount += guide.isFavorited ? 1 : -1
      return successResponse({ isFavorited: guide.isFavorited })
    }
    return errorResponse('攻略不存在')
  },

  //+ 攻略评论列表
  'GET /api/v1/guides/:id/comments': (_, url) => {
    const id = (url as string).split('/')[2] || '1'
    const guide = mockPosts.find(n => n.id === id)
    if (guide) return successResponse(mockNoteCommentsPost)
    return errorResponse('攻略不存在')
  }
}
