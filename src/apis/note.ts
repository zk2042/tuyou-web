//+ 笔记API接口封装
import { get, post } from '@/utils/request'

//+ 获取笔记列表（瀑布流）
export function getNotesAPI(params: {
  category?: number
  sort?: string
  type?: string
  page: number
  size: number
}) {
  return get('/notes', params)
}

//+ 获取笔记详情
//+ type为后端检索字段：笔记/攻略，用于获取对应类型的详情数据
export function getNoteDetailAPI(id: string, type?: string) {
  return get(`/notes/${id}`, { type })
}

//+ 发布笔记
export function createNoteAPI(params: {
  title: string
  content: string
  images?: string[]
  videoUrl?: string
  category?: number
  tags?: string[]
}) {
  return post('/notes', params)
}

//+ 点赞/取消点赞
export function toggleNoteLikeAPI(id: string) {
  return post(`/notes/${id}/like`)
}

//+ 收藏/取消收藏
export function toggleNoteFavoriteAPI(id: string) {
  return post(`/notes/${id}/favorite`)
}

//+ 获取笔记评论列表
export function getNoteCommentsAPI(id: string) {
  return get(`/notes/${id}/comments`)
}