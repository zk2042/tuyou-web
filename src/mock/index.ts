//+ Mock数据汇总入口
//+ 合并所有模块的Mock路由

import { userMockRoutes } from './user'
import { noteMockRoutes } from './note'
import { guideMockRoutes } from './guide'
import { activityMockRoutes } from './activity'
import { configMockRoutes } from './config'
import { homeMockRoutes } from './home'
import { tagMockRoutes } from './tag'
import { profileMockRoutes } from './profile'

//+ 合并所有Mock路由
export const mockRoutes: Record<string, (data?: any, url?: string) => any> = {
  ...userMockRoutes,
  ...noteMockRoutes,
  ...guideMockRoutes,
  ...activityMockRoutes,
  ...configMockRoutes,
  ...homeMockRoutes,
  ...tagMockRoutes,
  ...profileMockRoutes
}
// 上方：合并所有模块的Mock路由处理器（函数），用于统一注册Mock接口
// 下方：重新导出各模块的Mock数据对象，供其他模块直接引用数据本身
// 区别在于：上方是"路由"（定义接口如何响应），下方是"数据"（实际的模拟数据内容）
// 上方的mockRoutes是给HTTP请求拦截器（如axios拦截器或Mock中间件）使用的，用于在开发阶段拦截前端发出的API请求，并根据请求URL匹配对应的Mock路由处理器，返回模拟数据代替真实的后端接口响应

//+ 重新导出各模块的Mock数据供其他模块使用
export { mockUsers, mockLeaders } from './user'
export { mockPosts ,mockNoteDetailPost,mockNoteCommentsPost} from './note'
export { mockBanners, mockActivities } from './activity'
export { mockCategories, mockSorts, mockTypes } from './config'
export { mockSlides, mockFeed } from './home'
export { mockTags } from './tag'
export * from './utils'
