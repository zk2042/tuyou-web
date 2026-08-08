//+ 标签模块API接口封装
//+ 对接后端 /common/tags 接口（发布笔记/攻略时供用户选择标签）
import { get } from '@/utils/request'
import type { Tag } from '@/types'

//+ 获取标签列表
export function getTagsAPI() {
  return get<Tag[]>('/common/tags')
}
