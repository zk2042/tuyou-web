//+ 导入请求工具
import { get, post, put } from '@/utils/request'

//+ ========== 认证模块 ==========

//+ 发送验证码
export function sendCodeAPI(params: {
  phone: string
  scene: 'register' | 'login' | 'reset-password'
}) {
  return post('/auth/send-code', params)
}

//+ 注册请求（新增 code + confirmPassword）
export function registerAPI(params: {
  phone: string
  code: string
  nickname: string
  password: string
  confirmPassword: string
}) {
  return post('/auth/register', params)
}

//+ 登录请求（支持密码登录和验证码登录）
//+ type 为 "password" 时需传 password
//+ type 为 "code" 时需传 code
export function loginAPI(params: {
  phone: string
  password?: string
  code?: string
  type?: 'password' | 'code'
}) {
  return post('/auth/login', params)
}

//+ 重置密码
export function resetPasswordAPI(params: {
  phone: string
  code: string
  newPassword: string
  confirmPassword: string
}) {
  return post('/auth/reset-password', params)
}

//+ ========== 用户模块 ==========

//+ 健康检查接口
export function healthCheck() {
  return get('/health')
}

//+ 获取用户信息
export function getUserProfileAPI() {
  return get('/user/profile')
}

//+ 更新用户资料
export function updateUserProfileAPI(params: {
  nickname?: string
  bio?: string
  avatar?: string
  bgImg?: string
}) {
  return put('/user/profile', params)
}

//+ 更新用户设置
export function updateUserSettingsAPI(params: {
  notificationEnabled?: boolean
}) {
  return put('/user/settings', params)
}

//+ 获取指定用户公开资料
export function getUserInfoAPI(userId: string) {
  return get(`/users/${userId}`)
}

//+ 退出登录
export function logoutAPI() {
  return post('/auth/logout')
}

//+ ========== 关注模块 ==========

//+ 关注/取消关注（切换式，返回最新关注状态）
export function toggleFollowAPI(memberId: string) {
  return post(`/members/${memberId}/follow`)
}