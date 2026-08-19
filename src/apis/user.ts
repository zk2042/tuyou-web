//+ 导入请求工具
import { get, post, put } from '@/utils/request'
import type { MemberInfo, UserDetail } from '@/types'

//+ 验证码场景枚举
//+ register=注册 login=登录 reset-pwd=重置密码 change-phone=更换手机号 cancel-account=注销账号
export type SmsScene = 'register' | 'login' | 'reset-pwd' | 'change-phone' | 'cancel-account'

//+ 图形验证码响应（GET /auth/captcha 返回）
//+ captcha_id 用于后续登录请求回传，captcha_image 为 base64 图片可直接渲染
export interface CaptchaInfo {
  captcha_id: string
  captcha_image: string
}

//+ ========== 认证模块 ==========

//+ 发送验证码
//+ scene 枚举：register/login/reset-pwd/change-phone/cancel-account
export function sendCodeAPI(params: {
  phone: string
  scene: SmsScene
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
//+ type 为 "password" 时需传 password + captchaId + captchaCode（图形验证码）
//+ type 为 "code" 时需传 code（短信验证码，无需图形验证码）
export function loginAPI(params: {
  phone: string
  password?: string
  code?: string
  type?: 'password' | 'code'
  //+ 密码登录需回传图形验证码 ID 与用户输入值（来自 GET /auth/captcha）
  captcha_id?: string
  captcha?: string
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

//+ 修改密码（需登录）
//+ 场景：个人中心 → 设置 → 修改密码
export function updatePasswordAPI(params: {
  oldPassword: string
  newPassword: string
  confirmPassword: string
}) {
  return put('/auth/password', params)
}

//+ 修改手机号（需登录）
//+ 场景：个人中心 → 设置 → 修改手机号
//+ 发码场景 scene=change-phone，code 为发往新手机号的验证码
export function changePhoneAPI(params: {
  newPhone: string
  code: string
}) {
  return post('/auth/change-phone', params)
}

//+ 注销账号（需登录）
//+ 双重校验：手机号验证码 + 原密码
//+ 成功后账号置 status=2、token 清除，前端需清登录态跳登录页
export function cancelAccountAPI(params: {
  phone: string
  code: string
  password: string
}) {
  return post('/auth/cancel', params)
}

//+ 获取图形验证码
//+ 用于登录页密码登录方式下的人机校验
//+ captcha_id 在登录请求时回传给后端，captcha_image 为 base64 图片可直接 <img src=...>
export function getCaptchaAPI() {
  return get<CaptchaInfo>('/auth/captcha')
}

//+ ========== 用户模块 ==========

//+ 健康检查接口
export function healthCheck() {
  return get('/health')
}

//+ 获取用户基础信息（通用接口 /member/info，含 role 字段判断领队/会员）
//+ 用于：发布活动按钮的角色判断、app 启动刷新全局 userInfo 头像/昵称等场景
//+ 注意：/user/profile 接口后端不存在，统一改用 /member/info
export function getMemberInfoAPI(signal?: AbortSignal | null) {
  return get<MemberInfo>('/member/info', undefined, undefined, signal)
}

//+ 获取他人公开资料卡（GET /personal/member/{id}）
//+ 用于：关注/粉丝/评论/报名人等所有带头像处点击头像弹出用户资料卡
//+ nickname/bio 已由后端做敏感词打星处理；status=2 表示已注销
export function getUserDetailAPI(userId: string, signal?: AbortSignal | null) {
  return get<UserDetail>(`/personal/member/${userId}`, undefined, undefined, signal)
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
export function toggleFollowAPI(memberId: string, signal?: AbortSignal | null) {
  return post(`/members/${memberId}/follow`, undefined, undefined, signal)
}