//+ 路由常量定义
export const ROUTE_PATHS = {
  LOGIN: '/pages/Login/index',
  REGISTER: '/pages/Register/index',
  FORGOT_PASSWORD: '/pages/ForgotPassword/index',
  HOME: '/pages/Home/index',
  LOGOUT: '/pages/Logout/index',
  PUBLISH_NOTE: '/pages/PublishNote/index',
  PUBLISH_GUIDE: '/pages/PublishGuide/index',
  PUBLISH_ACTIVITY: '/pages/PublishActivity/index',
  NOTE_DETAIL: '/pages/NoteDetail/index',
  GUIDE_DETAIL: '/pages/GuideDetail/index',
  ACTIVITY_DETAIL: '/pages/ActivityDetail/index',
  SEARCH: '/pages/Search/index',
  ACTIVITY_LIST: '/pages/Activity/index',
  MESSAGE: '/pages/Message/index',
  PROFILE: '/pages/Profile/index',
  EDIT_PROFILE: '/pages/EditProfile/index',
  MY_ACTIVITY: '/pages/MyActivity/index',
  CONTENT: '/pages/Content/index',
  FOLLOW_LIST: '/pages/FollowList/index',
  FOLLOWER_LIST: '/pages/FollowerList/index',
  FAVORITE: '/pages/Favorite/index',
  LIKE: '/pages/Like/index',
  SETTINGS: '/pages/Settings/index'
} as const

//+ H5端路由别名
export const ROUTE_ALIAS = {
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  HOME: '/home',
  LOGOUT: '/logout',
  SEARCH: '/search'
} as const

//+ 路由配置类型
export type RouteKey = keyof typeof ROUTE_PATHS

//+ 需要登录才能访问的路由（默认：全部除 PUBLIC_ROUTES 外都需要登录）
export const AUTH_REQUIRED_ROUTES: RouteKey[] = []

//+ 白名单路由（无需登录即可访问）
export const PUBLIC_ROUTES: RouteKey[] = ['LOGIN', 'REGISTER', 'FORGOT_PASSWORD', 'LOGOUT']

import Taro from '@tarojs/taro'
import { getToken } from '@/utils/token'

//+ 判断是否已登录
export function isAuthenticated(): boolean {
  return !!getToken()
}

//+ 判断路由路径是否属于白名单（基于 path 前缀匹配，兼容 params/query）
//+ 白名单页面：登录 / 注册 / 忘记密码 / 登出
export function isPublicRoute(path: string): boolean {
  const normalized = `/${path.replace(/^\//, '')}`
  const publicPaths = [
    ROUTE_PATHS.LOGIN,
    ROUTE_PATHS.REGISTER,
    ROUTE_PATHS.FORGOT_PASSWORD,
    ROUTE_PATHS.LOGOUT
  ]
  return publicPaths.some(p => normalized.startsWith(p))
}

//+ 获取当前活动页面的完整路径（含 query，用于登录后回跳）
export function getCurrentPageFullPath(): string {
  try {
    const pages = Taro.getCurrentPages()
    if (!pages || pages.length === 0) return ROUTE_PATHS.HOME
    const last = pages[pages.length - 1] as any
    const route: string = last?.route || last?.$taroPath || ''
    const options: Record<string, string> = last?.options || last?.$taroParams || {}
    const params = Object.keys(options)
      .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(options[k])}`)
      .join('&')
    if (!route) return ROUTE_PATHS.HOME
    return params ? `/${route.replace(/^\//, '')}?${params}` : `/${route.replace(/^\//, '')}`
  } catch (_) {
    return ROUTE_PATHS.HOME
  }
}

//+ 判断路由是否需要鉴权
export function requiresAuth(routeKey: RouteKey): boolean {
  return AUTH_REQUIRED_ROUTES.includes(routeKey)
}

//+ 导航到指定页面（保留当前页面）
export function routerNavigateTo(routeKey: RouteKey): Promise<TaroGeneral.CallbackResult> {
  const url: string = ROUTE_PATHS[routeKey]
  return Taro.navigateTo({ url })
}

//+ 重定向到指定页面（关闭当前页面）
export function routerRedirectTo(routeKey: RouteKey): Promise<TaroGeneral.CallbackResult> {
  const url: string = ROUTE_PATHS[routeKey]
  return Taro.redirectTo({ url })
}

//+ 跳转到 tabBar 页面
export function routerSwitchTab(routeKey: RouteKey): Promise<TaroGeneral.CallbackResult> {
  const url: string = ROUTE_PATHS[routeKey]
  return Taro.switchTab({ url })
}

//+ 关闭所有页面，打开到应用内的某个页面
export function routerReLaunch(routeKey: RouteKey): Promise<TaroGeneral.CallbackResult> {
  const url: string = ROUTE_PATHS[routeKey]
  return Taro.reLaunch({ url })
}

//+ 返回上一页
export function routerNavigateBack(delta: number = 1): Promise<TaroGeneral.CallbackResult> {
  return Taro.navigateBack({ delta })
}

//+ 登录成功后跳转：优先跳 redirect 参数来源页，其次首页
//+ 与 goToLogin(redirect) 配对使用
export function goAfterLogin(): Promise<TaroGeneral.CallbackResult> {
  const redirect = Taro.getStorageSync('login_redirect') || ''
  try { Taro.removeStorageSync('login_redirect') } catch (_) { /* ignore */ }
  if (redirect && typeof redirect === 'string') {
    const parsed = String(redirect)
    //+ 跳 tabBar 页：若包含 HOME/ACTIVITY/MESSAGE/PROFILE 前缀则走 switchTab
    const pure = parsed.split('?')[0].replace(/^\//, '')
    const tabMap: Record<string, RouteKey> = {
      'pages/Home/index': 'HOME',
      'pages/Activity/index': 'ACTIVITY_LIST',
      'pages/Message/index': 'MESSAGE',
      'pages/Profile/index': 'PROFILE'
    }
    if (tabMap[pure]) return routerSwitchTab(tabMap[pure])
    //+ 普通页：redirectTo 直接跳到原路径（路径已含 query）
    return Taro.redirectTo({ url: parsed }).catch(() => routerRedirectTo('HOME'))
  }
  return routerRedirectTo('HOME')
}

//+ 跳转到登录页（未登录时）
//+ 可选保存当前页地址，登录后 goAfterLogin 自动回跳
export function goToLogin(redirect?: string): Promise<TaroGeneral.CallbackResult> {
  try {
    if (redirect) {
      Taro.setStorageSync('login_redirect', redirect)
    } else {
      Taro.removeStorageSync('login_redirect')
    }
  } catch (_) { /* ignore */ }

  return routerRedirectTo('LOGIN')
}

//+ 操作级鉴权（用于"扫码进入详情页"场景）
//+ 用法：在需要登录的操作前调用 requireAuth('报名')
//+   - 已登录 → 返回 true，继续执行
//+   - 未登录 → Toast 提示"请先登录后报名"，延迟 1.2s 后跳登录页，返回 false
//+ 与 useAuthGuard 区别：useAuthGuard 是页面级（进入页面就跳），requireAuth 是操作级（浏览放行、操作拦截）
export function requireAuth(action: string = '操作'): boolean {
  if (isAuthenticated()) return true
  Taro.showToast({
    title: `请先登录后${action}`,
    icon: 'none',
    duration: 1500,
  })
  //+ 延迟跳转，让 Toast 先显示；保存当前页路径用于登录后回跳
  setTimeout(() => {
    goToLogin(getCurrentPageFullPath())
  }, 1200)
  return false
}
