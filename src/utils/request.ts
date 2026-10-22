//+ 请求工具封装，基于Taro.request

import Taro from '@tarojs/taro'
import { getCurrentPageFullPath, goToLogin, isPublicRoute } from '@/router'
import { mockRoutes } from '@/mock'
import { getToken, getRefreshToken, setTokens, clearToken } from './token'

//+ 请求方法类型
type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

//+ 请求配置接口
interface RequestConfig {
  url: string
  method?: Method
  data?: any
  header?: any
  timeout?: number
  //+ AbortController.signal：用于主动丢弃过期请求（性能优化）
  //+ 真实请求：调用 requestTask.abort() 释放连接
  //+ Mock 模式：监听 signal.aborted 提前 reject AbortError
  signal?: AbortSignal | null
  //+ 内部使用：本次请求不再尝试刷新令牌，避免重试后再次 401 造成循环
  skipAuthRefresh?: boolean
}

//+ 响应数据接口
export interface ResponseData<T = any> {
  code: number
  message: string
  data: T
  //+ 标记数据来源：true=Mock 降级，false/undefined=真实后端
  __fromMock?: boolean
}

//+ 默认请求头
const defaultHeader = {
  'content-type': 'application/json',
  'Accept': 'application/json'
}

//+ 是否启用Mock数据
const isMock = process.env.TARO_APP_USE_MOCK === 'true'
//+ 是否允许"真实请求失败 → 降级 Mock"：仅开发/测试环境允许
//+ 生产环境（TARO_APP_ENV=production）一律不降级，让真实错误抛给业务层处理
//+ 否则后端挂了前端会显示假数据（mockFeed/mockUsers 等），掩盖真实故障
const allowFallbackToMock = process.env.TARO_APP_ENV !== 'production'

//+ 401 并发去重：多个请求同时返回 401 时只提示/跳转一次
let isHandlingUnauthorized = false

//+ 统一处理登录失效：清 token → 提示 → 回登录页
//+ 保留当前页面路径，登录成功后由 goAfterLogin 自动回跳
export function handleUnauthorized(): void {
  if (isHandlingUnauthorized) return
  isHandlingUnauthorized = true

  clearToken()

  const currentPath = getCurrentPageFullPath()
  //+ 已经在登录/注册等公开页时，只清 token，不重复提示和跳转
  if (isPublicRoute(currentPath)) {
    isHandlingUnauthorized = false
    return
  }

  Taro.showToast({
    title: '登录已过期，请重新登录',
    icon: 'none',
    duration: 2000
  })

  setTimeout(() => {
    goToLogin(currentPath)
    //+ 跳转完成后复位，允许后续再次处理 401
    setTimeout(() => { isHandlingUnauthorized = false }, 1500)
  }, 500)
}

//+ ========== 双 Token：访问令牌过期后自动刷新 ==========
//+ 刷新接口路径（前台会员）
const REFRESH_TOKEN_PATH = '/auth/refresh'
//+ 这些公开认证接口不触发自动刷新（失败通常与登录态无关）
const REFRESH_EXCLUDE_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/reset-password',
  '/auth/captcha',
  REFRESH_TOKEN_PATH
]

//+ 刷新令牌请求去重：多个请求同时 401 时只发起一次刷新
let refreshTokenPromise: Promise<string | null> | null = null

//+ 是否需要尝试刷新访问令牌
function shouldRefreshAccessToken(url: string): boolean {
  if (!getRefreshToken()) return false
  const path = url.split('?')[0]
  return !REFRESH_EXCLUDE_PATHS.some(exclude => path.endsWith(exclude))
}

//+ 调用刷新接口换取新的令牌对，成功返回新的访问令牌
async function requestNewTokens(): Promise<string | null> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return null

  const baseURL = process.env.TARO_APP_API_BASE || ''
  try {
    const res = await Taro.request({
      url: `${baseURL}${REFRESH_TOKEN_PATH}`,
      method: 'POST',
      header: { ...defaultHeader },
      data: { refresh_token: refreshToken },
      timeout: 15000
    })

    if (res.statusCode !== 200) return null

    const body = res.data as ResponseData<any>
    if (!body || (body.code !== 0 && body.code !== 200) || !body.data) return null

    const accessToken = body.data.access_token || body.data.token
    if (!accessToken) return null

    //+ 刷新令牌随访问令牌一起轮换；后端未返回时保留原刷新令牌
    setTokens(accessToken, body.data.refresh_token || refreshToken)
    return accessToken
  } catch (error) {
    console.warn('[Request] 刷新令牌失败:', error)
    return null
  }
}

//+ 刷新访问令牌（并发去重）
export function refreshAccessToken(): Promise<string | null> {
  if (!refreshTokenPromise) {
    refreshTokenPromise = requestNewTokens().finally(() => {
      refreshTokenPromise = null
    })
  }
  return refreshTokenPromise
}

//+ 判断错误是否为 401（兼容 HTTP 401 与 HTTP 200 + code 401）
function isUnauthorizedError(error: any): boolean {
  return error?.code === 401 || error?.statusCode === 401
}

//+ 将响应错误统一转换为带 code/message/data 的 Error，便于业务层与刷新逻辑判断
function createResponseError(res: any): any {
  const body = res?.data
  const err: any = new Error(body?.message || `请求错误 ${res?.statusCode || 0}`)
  //+ 仅业务响应体带 code 时设置 code；纯 HTTP 错误保留 statusCode，交给 Mock 降级逻辑处理
  if (typeof body?.code === 'number') {
    err.code = body.code
    err.data = body.data
  }
  err.statusCode = res?.statusCode
  return err
}

//+ Mock请求处理函数
function mockRequest<T = any>(url: string, method: Method, data?: any, signal?: AbortSignal | null): Promise<ResponseData<T>> {
  return new Promise((resolve, reject) => {
    //+ AbortController：若 signal 已中止，立即 reject
    if (signal?.aborted) {
      const err: any = new DOMException('Aborted', 'AbortError')
      return reject(err)
    }
    //+ 模拟网络延迟
    const timer = setTimeout(() => {
      //+ 使用 method+url 作为键查找匹配的Mock路由
      const key = `${method} ${url}`
      console.log('[Mock] 路由查找:', key)
      
      let mockHandler = mockRoutes[key]
      
      //+ 如果没有精确匹配，尝试参数化路由匹配（如 GET /users/:userId）
      if (!mockHandler) {
        for (const [pattern, handler] of Object.entries(mockRoutes)) {
          if (pattern.includes(':') && matchRoute(pattern, key)) {
            mockHandler = handler
            break
          }
        }
      }
      
      //+ 返回Mock数据或默认错误
      if (mockHandler) {
        const result = mockHandler(data, url)
        //+ 标记数据来源为 Mock
        resolve({ ...result, __fromMock: true } as ResponseData<T>)
      } else {
        console.error('[Mock] 未找到Mock接口:', key)
        resolve({
          code: -1,
          message: '未找到Mock接口',
          data: null as any,
          __fromMock: true
        })
      }
    }, 300 + Math.random() * 500)

    //+ 注册 AbortController 监听：aborted 时清 timer 并抛 AbortError
    if (signal) {
      const onAbort = () => {
        clearTimeout(timer)
        const err: any = new DOMException('Aborted', 'AbortError')
        reject(err)
      }
      signal.addEventListener('abort', onAbort, { once: true })
      //+ 防止回调引用泄漏：timer fire 后移除 abort 监听
      setTimeout(() => signal.removeEventListener('abort', onAbort), 3500)
    }
  })
}

//+ 路由匹配辅助函数（支持 method+url 格式）
function matchRoute(pattern: string, key: string): boolean {
  const [patternMethod, ...patternPathParts] = pattern.split(' ')
  const [keyMethod, ...keyPathParts] = key.split(' ')
  
  //+ 方法必须匹配
  if (patternMethod !== keyMethod) {
    return false
  }
  
  const patternUrl = patternPathParts.join(' ')
  const keyUrl = keyPathParts.join(' ')
  
  const patternParts = patternUrl.split('/')
  const urlParts = keyUrl.split('/')
  
  if (patternParts.length !== urlParts.length) {
    return false
  }
  
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(':') || patternParts[i] === urlParts[i]) {
      continue
    }
    return false
  }
  
  return true
}

//+ 请求拦截器：添加token
function requestInterceptor(config: RequestConfig): RequestConfig {
  const token = getToken()
  if (token) {
    config.header = {
      ...config.header,
      'Authorization': `Bearer ${token}`
    }
  }
  return config
}

//+ 响应拦截器：处理错误和数据
//+ 注意：业务错误（code != 0/200）不再在此处 Toast，由业务层（store/页面）统一处理；
//+       401 由 request() 统一尝试刷新令牌，刷新失败后再 Toast + 跳转登录页
function responseInterceptor<T = any>(res: any): Promise<ResponseData<T>> {
  return new Promise((resolve, reject) => {
    if (res.statusCode === 200) {
      const data = res.data as ResponseData<T>
      if (data && (data.code === 0 || data.code === 200)) {
        resolve(data)
      } else {
        //+ 业务错误：构造带 code/message/data 的错误对象，便于刷新令牌与业务层判断
        reject(createResponseError(res))
      }
    } else {
      //+ HTTP 错误：构造标准错误对象，业务层可通过 error.message 获取提示
      reject(createResponseError(res))
    }
  })
}

//+ 发起请求
//+ 策略：先走真实后端，失败自动降级到 Mock（除非全局开启 Mock）
export function request<T = any>(config: RequestConfig): Promise<ResponseData<T>> {
  const { url, method = 'GET', data, header, timeout = 30000, signal, skipAuthRefresh = false } = config

  //+ 本次请求是否携带了访问令牌（决定 401 时是否需要走登录失效流程）
  const hadAuthToken = !!getToken()

  //+ 已中止直接拒绝（避免进入真实请求 / mockRequest）
  if (signal?.aborted) {
    const err: any = new DOMException('Aborted', 'AbortError')
    return Promise.reject(err)
  }

  const baseURL = process.env.TARO_APP_API_BASE || ''
  const fullUrl = url.startsWith('http') ? url : `${baseURL}${url}`
  
  //+ 获取相对路径（用于 Mock 查找）：去掉协议和域名部分
  const basePath = baseURL.replace(/^https?:\/\/[^/]+/, '')
  const relativeUrl = url.startsWith('http') 
    ? url.replace(/^https?:\/\/[^/]+/, '') 
    : `${basePath}${url}`
  
  //+ 如果全局开启 Mock（TARO_APP_USE_MOCK=true），直接返回 Mock 数据
  if (isMock) {
    console.log('[Request] 全局 Mock 模式:', method, relativeUrl, data)
    return mockRequest(relativeUrl, method, data, signal)
  }
  
  //+ 否则先尝试真实请求
  const requestConfig = requestInterceptor({
    url: fullUrl,
    method,
    data,
    header: { ...defaultHeader, ...header },
    timeout
  })

  //+ 真实请求：Taro.request 返回 RequestTask，通过 requestTask.abort() 取消
  let requestTask: any = null
  //+ abort 监听绑定（Promise 构造外先绑定）
  const realRequest = new Promise<ResponseData<T>>((resolve, reject) => {
    //+ signal 已 abort（极短竞态）
    if (signal?.aborted) {
      const err: any = new DOMException('Aborted', 'AbortError')
      return reject(err)
    }
    requestTask = Taro.request(requestConfig as any)
      .then(responseInterceptor)
      .then(resolve, reject)

    if (signal) {
      const onAbort = () => {
        if (requestTask && typeof requestTask.abort === 'function') {
          try { requestTask.abort() } catch (_) { /* ignore */ }
        }
        const err: any = new DOMException('Aborted', 'AbortError')
        reject(err)
      }
      signal.addEventListener('abort', onAbort, { once: true })
      //+ 清理监听（超时兜底）
      setTimeout(() => signal.removeEventListener('abort', onAbort), (timeout || 30000) + 1000)
    }
  })

  return realRequest
    .catch(async (error) => {
      //+ AbortError：直接抛出，不降级 Mock
      if (error?.name === 'AbortError') return Promise.reject(error)

      //+ 401：访问令牌过期/未授权 → 尝试用刷新令牌换新令牌后重试一次
      if (isUnauthorizedError(error)) {
        if (!skipAuthRefresh && hadAuthToken && shouldRefreshAccessToken(url)) {
          const newAccessToken = await refreshAccessToken()
          if (newAccessToken) {
            return request<T>({ ...config, skipAuthRefresh: true })
          }
        }
        //+ 刷新失败（或无需刷新）：统一清 token + Toast + 跳登录页
        if (hadAuthToken) {
          handleUnauthorized()
        }
        return Promise.reject(error)
      }

      //+ 其他业务错误（HTTP 200 但 code != 0/200）：不降级 Mock，直接抛出给业务层处理
      if (error && typeof error.code === 'number') {
        return Promise.reject(error)
      }
      //+ 网络/HTTP 错误（非 200 状态码、超时、连接失败等）：降级到 Mock
      //+ 生产环境禁止降级：后端挂了不能返回假数据，必须把错误抛给业务层
      if (!allowFallbackToMock) {
        console.error('[Request] 真实接口失败（生产环境不降级 Mock）:', method, relativeUrl, error?.message || error)
        return Promise.reject(error)
      }
      console.warn('[Request] 真实接口失败，降级使用 Mock:', method, relativeUrl, error?.message || error)
      return mockRequest<T>(relativeUrl, method, data, signal)
    })
}

//+ GET请求
export function get<T = any>(url: string, data?: any, header?: any, signal?: AbortSignal | null): Promise<ResponseData<T>> {
  return request({ url, method: 'GET', data, header, signal })
}

//+ POST请求
export function post<T = any>(url: string, data?: any, header?: any, signal?: AbortSignal | null): Promise<ResponseData<T>> {
  return request({ url, method: 'POST', data, header, signal })
}

//+ PUT请求
export function put<T = any>(url: string, data?: any, header?: any, signal?: AbortSignal | null): Promise<ResponseData<T>> {
  return request({ url, method: 'PUT', data, header, signal })
}

//+ DELETE请求
export function del<T = any>(url: string, data?: any, header?: any, signal?: AbortSignal | null): Promise<ResponseData<T>> {
  return request({ url, method: 'DELETE', data, header, signal })
}

// ========== 文件上传封装 ==========

//+ 上传配置：multipart/form-data 单文件上传
//+ url: 相对路径（如 /upload/image）；baseURL 由统一配置自动拼接
//+ filePath: 本地路径（H5 为 blob:/data: URL，小程序端为临时文件路径）
//+ name: formData 中文件字段名，默认 'file'（后端约定：单图 'file'、视频 'file'，批量图 'files' 需走 H5 fetch）
//+ formData: 附加文本字段（如 type）
//+ header: 额外请求头；Authorization 自动注入，无需手动传
//+ mockFn: Mock 模式 / 失败降级时使用的 Mock 生成函数；文件上传不走 mockRoutes 拦截器（Taro.uploadFile / fetch 不经 request.ts mockRequest）
export interface UploadConfig<T> {
  url: string
  filePath: string
  name?: string
  formData?: Record<string, any>
  header?: any
  mockFn?: (filePath: string) => ResponseData<T>
  //+ 文件名（H5 fetch+FormData 时使用），不传则根据日期+扩展名推断
  fileNameHint?: string
}

//+ 计算全量 URL（含 baseURL 前缀）和相对路径；与 request() 内部逻辑一致
function resolveUrl(url: string): { fullUrl: string; relativeUrl: string } {
  const baseURL = process.env.TARO_APP_API_BASE || ''
  const fullUrl = url.startsWith('http') ? url : `${baseURL}${url}`
  const basePath = baseURL.replace(/^https?:\/\/[^/]+/, '')
  const relativeUrl = url.startsWith('http')
    ? url.replace(/^https?:\/\/[^/]+/, '')
    : `${basePath}${url}`
  return { fullUrl, relativeUrl }
}

//+ 组装 Authorization + 自定义 Header；与 requestInterceptor 行为一致，保持单点维护
function buildAuthHeader(extraHeader?: any): Record<string, string> {
  const token = getToken()
  const header: Record<string, string> = { ...(extraHeader || {}) }
  if (token) header.Authorization = `Bearer ${token}`
  return header
}

//+ 统一解析上传响应体（statusCode 200 且 JSON 可解析，code=0/200 视为成功）
//+ 解析失败 / HTTP 错误 → throw Error；业务错误（code 非 0/200）→ reject 响应数据对象
async function parseUploadResponse<T = any>(
  statusCode: number,
  rawData: string,
  _relativeUrl: string
): Promise<ResponseData<T>> {
  if (statusCode === 401) {
    const err: any = new Error('401 Unauthorized')
    err.code = 401
    err.statusCode = 401
    throw err
  }
  if (statusCode !== 200) {
    const err: any = new Error(`HTTP ${statusCode}`)
    err.statusCode = statusCode
    throw err
  }

  let data: ResponseData<T>
  try {
    data = JSON.parse(rawData) as ResponseData<T>
  } catch {
    throw new Error('响应解析失败')
  }

  if (data.code === 0 || data.code === 200) {
    return data
  }

  //+ 业务错误（含 HTTP 200 + code 401）：构造带 code/message 的错误，由调用方统一处理
  const err: any = new Error(data.message || '上传失败')
  err.code = data.code
  err.statusCode = statusCode
  err.data = data.data
  throw err
}

//+ 文件上传：multipart/form-data
//+ 策略（与 apis/upload.ts 当前方案对齐）：
//+   1. TARO_APP_USE_MOCK=true → 直接调用 mockFn
//+   2. H5 端 + filePath 为 blob:/data: → fetch + FormData（避开 Taro.uploadFile H5 blob 缺陷）
//+   3. 其他端（小程序） → Taro.uploadFile
//+   4. 真实上传失败（非业务错误） → 调用 mockFn 降级；若调用方未传 mockFn 则抛出错误
export async function upload<T = any>(config: UploadConfig<T>): Promise<ResponseData<T>> {
  const {
    url,
    filePath,
    name = 'file',
    formData,
    header,
    mockFn,
    fileNameHint
  } = config

  const { fullUrl, relativeUrl } = resolveUrl(url)
  const hadAuthToken = !!getToken()

  //+ 全局 Mock 模式：直接调用 mockFn（上传不走 mockRoutes）
  if (isMock) {
    console.log('[Upload] Mock 模式:', relativeUrl)
    if (!mockFn) {
      const err: any = new Error('上传Mock未配置mockFn')
      err.code = -1
      throw err
    }
    return { ...mockFn(filePath), __fromMock: true }
  }

  //+ H5 端：blob:/data: URL 用 fetch + FormData（Taro.uploadFile 在 H5 处理 blob 有缺陷）
  const isH5Blob =
    typeof window !== 'undefined' &&
    typeof fetch === 'function' &&
    typeof FormData !== 'undefined' &&
    (filePath.startsWith('blob:') || filePath.startsWith('data:'))

  const performUpload = async (): Promise<ResponseData<T>> => {
    const authHeader = buildAuthHeader(header)

    if (isH5Blob) {
      const blob = await fetch(filePath).then(r => r.blob())
      const fd = new FormData()
      //+ 提取文件名：优先 fileNameHint，其次从 blob.type 猜扩展名，最后兜底 .bin
      let filename = fileNameHint?.trim()
      if (!filename) {
        const ext = blob.type?.includes('video')
          ? 'mp4'
          : blob.type?.includes('image') ? 'jpg' : 'bin'
        filename = `${name}_${Date.now()}.${ext}`
      }
      fd.append(name, blob, filename)
      if (formData) {
        for (const [k, v] of Object.entries(formData)) {
          if (v != null) fd.append(k, String(v))
        }
      }

      const res = await fetch(fullUrl, {
        method: 'POST',
        headers: authHeader, //+ fetch 会自动补 multipart boundary，不手动加 Content-Type
        body: fd
      })
      const text = await res.text()
      return await parseUploadResponse<T>(res.status, text, relativeUrl)
    }

    //+ 非 H5 / 非 blob 路径（小程序端 tempFilePath 是真实文件路径）
    const uploadRes = await Taro.uploadFile({
      url: fullUrl,
      filePath,
      name,
      formData,
      header: authHeader
    })
    return await parseUploadResponse<T>(uploadRes.statusCode, uploadRes.data, relativeUrl)
  }

  try {
    return await performUpload()
  } catch (err: any) {
    //+ 401：尝试刷新访问令牌后重试一次
    if (isUnauthorizedError(err)) {
      if (hadAuthToken && shouldRefreshAccessToken(url)) {
        const newAccessToken = await refreshAccessToken()
        if (newAccessToken) {
          try {
            return await performUpload()
          } catch (retryErr: any) {
            err = retryErr
          }
        }
      }
      //+ 刷新失败（或无需刷新）：统一清 token + Toast + 跳登录页
      if (hadAuthToken) {
        handleUnauthorized()
      }
      return Promise.reject(err)
    }

    //+ 其他业务错误（{code, message}）：不降级 Mock，透传
    if (err && typeof err.code === 'number') {
      return Promise.reject(err)
    }
    //+ 网络/HTTP/解析错误：若有 mockFn 则降级
    //+ 生产环境禁止降级（与 request 函数保持一致）
    if (mockFn && allowFallbackToMock) {
      console.warn('[Upload] 真实上传失败，降级 Mock:', relativeUrl, err?.message || err)
      return { ...mockFn(filePath), __fromMock: true }
    }
    throw err
  }
}

// ========== 批量文件上传封装 ==========

//+ 批量上传配置（multipart/form-data 多文件一次提交）
//+ 目前仅 H5 端支持真正批量；非 H5 调用方要自行逐张调用 upload() 兜底
//+ url: 如 /upload/images
//+ filePaths: 本地路径数组（H5 须为 blob:/data: URL；否则抛错给调用方兜底）
//+ name: formData 中多文件字段名，后端约定 'files'
//+ formData: 附加文本字段
//+ mockFn: Mock/降级函数，参数是 filePaths；返回 ResponseData<{ urls: string[] }> 或调用方自定义结构
export interface BatchUploadConfig<T> {
  url: string
  filePaths: string[]
  name?: string
  formData?: Record<string, any>
  header?: any
  mockFn?: (filePaths: string[]) => ResponseData<T>
}

//+ 批量上传：H5 端 fetch + FormData 一次提交多文件
//+ 非 H5 blob 路径（如小程序临时文件路径）：调用方传 mockFn 的降级路径会触发；未传则 throw 'not-supported'
export async function uploadBatch<T = any>(config: BatchUploadConfig<T>): Promise<ResponseData<T>> {
  const { url, filePaths, name = 'files', formData, header, mockFn } = config
  const { fullUrl, relativeUrl } = resolveUrl(url)
  const hadAuthToken = !!getToken()

  //+ 全局 Mock
  if (isMock) {
    console.log('[Upload] Mock 模式（批量）:', relativeUrl)
    if (!mockFn) {
      const err: any = new Error('批量上传Mock未配置mockFn')
      err.code = -1
      throw err
    }
    return { ...mockFn(filePaths), __fromMock: true }
  }

  const isH5 =
    typeof window !== 'undefined' &&
    typeof fetch === 'function' &&
    typeof FormData !== 'undefined'

  const performUpload = async (): Promise<ResponseData<T>> => {
    if (!isH5) {
      //+ 非 H5：Taro 暂无原生批量上传 API，抛错让调用方兜底（逐张走 upload）
      throw new Error('batch-not-supported')
    }

    //+ H5：校验每一项都是 blob:/data:，否则抛错给调用方逐张兜底
    const allBlob = filePaths.every(
      fp => fp.startsWith('blob:') || fp.startsWith('data:')
    )
    if (!allBlob) throw new Error('not-all-blob')

    const fd = new FormData()
    for (let i = 0; i < filePaths.length; i++) {
      const fp = filePaths[i]
      const blob = await fetch(fp).then(r => r.blob())
      const ext = blob.type?.includes('image') ? 'jpg' : 'bin'
      fd.append(name, blob, `file_${Date.now()}_${i}.${ext}`)
    }
    if (formData) {
      for (const [k, v] of Object.entries(formData)) {
        if (v != null) fd.append(k, String(v))
      }
    }

    const res = await fetch(fullUrl, {
      method: 'POST',
      headers: buildAuthHeader(header),
      body: fd
    })
    const text = await res.text()
    return await parseUploadResponse<T>(res.status, text, relativeUrl)
  }

  try {
    return await performUpload()
  } catch (err: any) {
    //+ 401：尝试刷新访问令牌后重试一次
    if (isUnauthorizedError(err)) {
      if (hadAuthToken && shouldRefreshAccessToken(url)) {
        const newAccessToken = await refreshAccessToken()
        if (newAccessToken) {
          try {
            return await performUpload()
          } catch (retryErr: any) {
            err = retryErr
          }
        }
      }
      if (hadAuthToken) {
        handleUnauthorized()
      }
      return Promise.reject(err)
    }

    if (err && typeof err.code === 'number') return Promise.reject(err)
    //+ 生产环境禁止降级（与 request/upload 保持一致）
    if (mockFn && allowFallbackToMock) {
      console.warn('[Upload] 批量上传失败，降级 Mock:', relativeUrl, err?.message || err)
      return { ...mockFn(filePaths), __fromMock: true }
    }
    throw err
  }
}