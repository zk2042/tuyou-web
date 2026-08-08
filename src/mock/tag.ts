//+ 标签模块Mock数据和路由
//+ 对应后端 /common/tags 接口（发布笔记/攻略时供用户选择标签）
import { successResponse } from './utils'

//+ 标签列表（与 PublishNote 原硬编码 ALL_TAGS 保持一致，确保选中态文案无变化）
export const mockTags = [
  { id: 1, tagName: '徒步' },
  { id: 2, tagName: '户外' },
  { id: 3, tagName: '登山' },
  { id: 4, tagName: '徒步路线' },
  { id: 5, tagName: '徒步装备' },
  { id: 6, tagName: '露营' },
  { id: 7, tagName: '帐篷' },
  { id: 8, tagName: '户外露营' },
  { id: 9, tagName: '露营美食' },
  { id: 10, tagName: '露营装备' },
  { id: 11, tagName: '骑行' },
  { id: 12, tagName: '自行车' },
  { id: 13, tagName: '骑行路线' },
  { id: 14, tagName: '长途骑行' },
  { id: 15, tagName: '山地车' },
  { id: 16, tagName: '雪山' },
  { id: 17, tagName: '高山' },
  { id: 18, tagName: '登顶' },
  { id: 19, tagName: '晨跑' },
  { id: 20, tagName: '夜跑' },
  { id: 21, tagName: '马拉松' },
  { id: 22, tagName: '跑步打卡' },
  { id: 23, tagName: '室内攀岩' },
  { id: 24, tagName: '户外攀岩' },
  { id: 25, tagName: '攀岩装备' },
  { id: 26, tagName: '溪水' },
  { id: 27, tagName: '清凉' },
  { id: 28, tagName: '户外玩水' },
  { id: 29, tagName: '自驾游' },
  { id: 30, tagName: '公路旅行' },
  { id: 31, tagName: '房车' },
  { id: 32, tagName: '户外装备' },
  { id: 33, tagName: '装备评测' },
  { id: 34, tagName: '装备推荐' },
  { id: 35, tagName: '户外摄影' },
  { id: 36, tagName: '风景摄影' },
  { id: 37, tagName: '人像摄影' }
]

//+ 标签Mock路由
export const tagMockRoutes: Record<string, (data?: any, url?: string) => any> = {
  //+ 获取标签列表
  'GET /api/v1/common/tags': () => successResponse(mockTags)
}
