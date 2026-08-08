//+ 请求工具封装，基于Taro.request

import Taro from '@tarojs/taro'
import { getToken } from './token'
import { mockRoutes } from '@/mock'

//+ 请求方法类型
type Method = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

//+ 请求配置接口
interface RequestConfig {
  url: string
  method?: Method
  data?: any
  header?: any
  timeout?: number
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

//+ Mock请求处理函数
function mockRequest<T = any>(url: string, method: Method, data?: any): Promise<ResponseData<T>> {
  return new Promise((resolve) => {
    //+ 模拟网络延迟
    setTimeout(() => {
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
//+ 注意：业务错误（code != 0/200）不再在此处 Toast，由业务层（store/页面）统一处理
function responseInterceptor<T = any>(res: any): Promise<ResponseData<T>> {
  return new Promise((resolve, reject) => {
    if (res.statusCode === 200) {
      const data = res.data as ResponseData<T>
      if (data.code === 0 || data.code === 200) {
        resolve(data)
      } else {
        //+ 业务错误：透传完整的响应数据，由业务层处理 Toast
        reject(data)
      }
    } else if (res.statusCode === 401) {
      //+ 未授权，清除token并跳转登录
      Taro.showToast({
        title: '登录已过期，请重新登录',
        icon: 'none'
      })
      Taro.redirectTo({ url: '/pages/Login/index' })
      reject(res)
    } else {
      //+ HTTP 错误：构造标准错误对象，业务层可通过 error.message 获取提示
      const err = new Error(`请求错误 ${res.statusCode}`)
      reject(err)
    }
  })
}

//+ 发起请求
//+ 策略：先走真实后端，失败自动降级到 Mock（除非全局开启 Mock）
export function request<T = any>(config: RequestConfig): Promise<ResponseData<T>> {
  const { url, method = 'GET', data, header, timeout = 30000 } = config
  
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
    return mockRequest(relativeUrl, method, data)
  }
  
  //+ 否则先尝试真实请求
  const requestConfig = requestInterceptor({
    url: fullUrl,
    method,
    data,
    header: { ...defaultHeader, ...header },
    timeout
  })

  return Taro.request(requestConfig)
    .then(responseInterceptor)
    .catch((error) => {
      //+ 业务错误（HTTP 200 但 code != 0/200）：responseInterceptor reject 的是响应数据对象 {code, message, data}
      //+ 此类错误不应降级 Mock，直接抛出给业务层处理（如报名满员、不在报名时间等）
      if (error && typeof error.code === 'number') {
        return Promise.reject(error)
      }
      //+ 网络/HTTP 错误（非 200 状态码、超时、连接失败等）：降级到 Mock
      console.warn('[Request] 真实接口失败，降级使用 Mock:', method, relativeUrl, error?.message || error)
      return mockRequest<T>(relativeUrl, method, data)
    })
}

//+ GET请求
export function get<T = any>(url: string, data?: any, header?: any): Promise<ResponseData<T>> {
  return request({ url, method: 'GET', data, header })
}

//+ POST请求
export function post<T = any>(url: string, data?: any, header?: any): Promise<ResponseData<T>> {
  return request({ url, method: 'POST', data, header })
}

//+ PUT请求
export function put<T = any>(url: string, data?: any, header?: any): Promise<ResponseData<T>> {
  return request({ url, method: 'PUT', data, header })
}

//+ DELETE请求
export function del<T = any>(url: string, data?: any, header?: any): Promise<ResponseData<T>> {
  return request({ url, method: 'DELETE', data, header })
}