//+ 文件上传API封装
//+ 对接后端 POST /upload/image（单张）和 POST /upload/images（批量）
//+ 策略与 request.ts 一致：先走真实后端，失败降级 Mock
import Taro from '@tarojs/taro'
import { getToken } from '@/utils/token'
import type { ResponseData } from '@/utils/request'

//+ 图片用途类型
export type UploadType = 'avatar' | 'cover' | 'note' | 'activity' | 'bg'

//+ 是否全局启用 Mock
const isMock = process.env.TARO_APP_USE_MOCK === 'true'

//+ Mock 上传：返回模拟图片URL
//+ 如果是本地 blob/data URL，直接返回（开发预览用）；否则用 picsum 占位图
function mockUploadImage(filePath: string): ResponseData<{ url: string }> {
  const url = filePath.startsWith('blob:') || filePath.startsWith('data:')
    ? filePath
    : `https://picsum.photos/seed/${Date.now()}/800/450`
  return {
    code: 0,
    message: '成功',
    data: { url },
    __fromMock: true
  }
}

//+ 上传单张图片
//+ filePath: Taro.chooseImage 返回的 tempFilePath，或 H5 下的 blob URL
//+ type: 图片用途，传给后端做分类存储
export async function uploadImageAPI(
  filePath: string,
  type?: UploadType
): Promise<ResponseData<{ url: string }>> {
  //+ Mock 模式：直接返回模拟 URL
  if (isMock) {
    console.log('[Upload] Mock 模式：上传图片')
    return mockUploadImage(filePath)
  }

  try {
    const baseURL = process.env.TARO_APP_API_BASE || ''
    const token = getToken()
    const uploadRes = await Taro.uploadFile({
      url: `${baseURL}/upload/image`,
      filePath,
      name: 'file',
      formData: type ? { type } : {},
      header: token ? { Authorization: `Bearer ${token}` } : {}
    })
    const data = JSON.parse(uploadRes.data)
    if (data.code === 0 || data.code === 200) {
      return { ...data, __fromMock: false }
    }
    throw new Error(data.message || '上传失败')
  } catch (err: any) {
    //+ 真实上传失败，降级 Mock
    console.warn('[Upload] 真实上传失败，降级 Mock:', err?.message || err)
    return mockUploadImage(filePath)
  }
}

//+ 批量上传图片（逐个上传，收集结果）
//+ filePaths: 图片路径数组
//+ maxCount: 最多上传数量（默认5，与后端限制一致）
export async function uploadImagesAPI(
  filePaths: string[],
  type?: UploadType,
  maxCount = 5
): Promise<ResponseData<{ urls: string[] }>> {
  const targetPaths = filePaths.slice(0, maxCount)
  const urls: string[] = []

  for (const filePath of targetPaths) {
    const res = await uploadImageAPI(filePath, type)
    if (res.code === 0 || res.code === 200) {
      urls.push(res.data.url)
    }
  }

  return {
    code: 0,
    message: '成功',
    data: { urls },
    __fromMock: isMock
  }
}

//+ Mock 上传视频：返回模拟视频URL
//+ 如果是本地 blob/data URL，直接返回（开发预览用）；否则用示例视频地址
function mockUploadVideo(filePath: string): ResponseData<{ url: string }> {
  const url = filePath.startsWith('blob:') || filePath.startsWith('data:')
    ? filePath
    : `https://www.w3schools.com/html/mov_bbb.mp4`
  return {
    code: 0,
    message: '成功',
    data: { url },
    __fromMock: true
  }
}

//+ 上传单个视频
//+ filePath: Taro.chooseVideo 返回的 tempFilePath，或 H5 下的 blob URL
//+ type: 视频用途（复用 UploadType，发布笔记传 'note'）
export async function uploadVideoAPI(
  filePath: string,
  type?: UploadType
): Promise<ResponseData<{ url: string }>> {
  //+ Mock 模式：直接返回模拟 URL
  if (isMock) {
    console.log('[Upload] Mock 模式：上传视频')
    return mockUploadVideo(filePath)
  }

  try {
    const baseURL = process.env.TARO_APP_API_BASE || ''
    const token = getToken()
    const uploadRes = await Taro.uploadFile({
      url: `${baseURL}/upload/video`,
      filePath,
      name: 'file',
      formData: type ? { type } : {},
      header: token ? { Authorization: `Bearer ${token}` } : {}
    })
    const data = JSON.parse(uploadRes.data)
    if (data.code === 0 || data.code === 200) {
      return { ...data, __fromMock: false }
    }
    throw new Error(data.message || '上传失败')
  } catch (err: any) {
    //+ 真实上传失败，降级 Mock
    console.warn('[Upload] 视频真实上传失败，降级 Mock:', err?.message || err)
    return mockUploadVideo(filePath)
  }
}
