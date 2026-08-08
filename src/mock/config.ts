//+ 系统配置Mock数据（分类列表、排序列表等）
import { successResponse } from './utils'

//+ 分类列表（后端返回）
export const mockCategories = [
  { id: 'all', name: '全部', sort: 0 },
  { id: 'hiking', name: '徒步', sort: 1 },
  { id: 'camping', name: '露营', sort: 2 },
  { id: 'cycling', name: '骑行', sort: 3 },
  { id: 'climbing', name: '登山', sort: 4 },
  { id: 'running', name: '跑步', sort: 5 },
  { id: 'cliff', name: '攀岩', sort: 6 },
  { id: 'stream', name: '溯溪', sort: 7 },
  { id: 'driving', name: '自驾', sort: 8 },
  { id: 'equipment', name: '装备', sort: 9 },
  { id: 'photography', name: '摄影', sort: 10 }
]

//+ 排序列表（后端返回）
export const mockSorts = [
  { id: 'recommend', name: '推荐', sort: 0 },
  { id: 'newest', name: '最新', sort: 1 },
  { id: 'hottest', name: '最热', sort: 2 }
]

//+ 内容类型列表（后端返回）
export const mockTypes = [
  { id: 'all', name: '全部', sort: 0 },
  { id: 'note', name: '笔记', sort: 1 },
  { id: 'guide', name: '攻略', sort: 2 },
  { id: 'video', name: '视频', sort: 3 }
]

//+ Mock路由映射：配置模块
export const configMockRoutes: Record<string, (data?: any, url?: string) => any> = {
  //+ 获取分类列表
  'GET /api/v1/config/categories': () => successResponse(mockCategories),

  //+ 获取排序列表
  'GET /api/v1/config/sorts': () => successResponse(mockSorts),

  //+ 获取内容类型列表
  'GET /api/v1/config/types': () => successResponse(mockTypes),

  //+ 获取首页全部配置（分类+排序+类型）
  'GET /api/v1/config/home': () => successResponse({
    categories: mockCategories,
    sorts: mockSorts,
    types: mockTypes
  })
}
