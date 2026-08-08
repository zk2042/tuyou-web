//+ 社区首页API接口封装
import { get } from '@/utils/request'

//+ 获取首页轮播（从笔记、攻略、活动中查询is_slide=1的内容）
export function getSlidesAPI() {
  return get('/slides')
}

//+ 获取Feed流列表（笔记/攻略混合瀑布流）
export function getFeedAPI(params: {
  category?: number
  sort?: string
  page: number
  size: number
}) {
  return get('/feed', params)
}
