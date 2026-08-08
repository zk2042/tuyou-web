//+ 路由常量定义
export const ROUTE_PATHS = {
  LOGIN: '/pages/Login/index',
  REGISTER: '/pages/Register/index',
  FORGOT_PASSWORD: '/pages/ForgotPassword/index',
  HOME: '/pages/Home/index',
  LOGOUT: '/pages/Logout/index',
  NOTE_DETAIL: '/pages/NoteDetail/index',
  GUIDE_DETAIL: '/pages/GuideDetail/index',
  ACTIVITY_DETAIL: '/pages/ActivityDetail/index'
} as const

//+ H5端路由别名
export const ROUTE_ALIAS = {
  LOGIN: '/login',
  REGISTER: '/register',
  FORGOT_PASSWORD: '/forgot-password',
  HOME: '/home',
  LOGOUT: '/logout'
} as const

//+ 路由配置类型
export type RouteKey = keyof typeof ROUTE_PATHS

//+ 需要登录才能访问的路由
export const AUTH_REQUIRED_ROUTES: RouteKey[] = []

//+ 白名单路由（无需登录）
export const PUBLIC_ROUTES: RouteKey[] = ['HOME', 'LOGIN', 'REGISTER', 'FORGOT_PASSWORD', 'LOGOUT']

import Taro from '@tarojs/taro'
import { getToken } from '@/utils/token'

//+ 判断是否已登录
export function isAuthenticated(): boolean {
  return !!getToken()
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

//+ 登录成功后跳转首页
export function goHomeAfterLogin(): Promise<TaroGeneral.CallbackResult> {
  return routerRedirectTo('HOME')
}

//+ 跳转到登录页（未登录时）
export function goToLogin(): Promise<TaroGeneral.CallbackResult> {
  return routerRedirectTo('LOGIN')
}
