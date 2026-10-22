//+ Token管理工具，封装访问令牌/刷新令牌的获取、存储和清除
import Taro from '@tarojs/taro'

//+ 访问令牌存储的key（沿用旧 key，兼容已登录用户）
const TOKEN_KEY = 'tuyou_token'
//+ 刷新令牌存储的key
const REFRESH_TOKEN_KEY = 'tuyou_refresh_token'

//+ 获取访问令牌
export function getToken(): string | null {
  try {
    const token = Taro.getStorageSync(TOKEN_KEY)
    return token || null
  } catch (error) {
    console.error('获取Token失败:', error)
    return null
  }
}

//+ 获取刷新令牌
export function getRefreshToken(): string | null {
  try {
    const token = Taro.getStorageSync(REFRESH_TOKEN_KEY)
    return token || null
  } catch (error) {
    console.error('获取刷新Token失败:', error)
    return null
  }
}

//+ 设置访问令牌（保留给只拿到单个 token 的旧调用方）
export function setToken(token: string): void {
  try {
    Taro.setStorageSync(TOKEN_KEY, token)
  } catch (error) {
    console.error('设置Token失败:', error)
  }
}

//+ 同时保存访问令牌与刷新令牌；刷新令牌为空时清除旧值，避免残留上一会话的令牌
export function setTokens(accessToken: string, refreshToken?: string): void {
  try {
    Taro.setStorageSync(TOKEN_KEY, accessToken)
    if (refreshToken) {
      Taro.setStorageSync(REFRESH_TOKEN_KEY, refreshToken)
    } else {
      Taro.removeStorageSync(REFRESH_TOKEN_KEY)
    }
  } catch (error) {
    console.error('设置Token失败:', error)
  }
}

//+ 清除访问令牌与刷新令牌
export function clearToken(): void {
  try {
    Taro.removeStorageSync(TOKEN_KEY)
    Taro.removeStorageSync(REFRESH_TOKEN_KEY)
  } catch (error) {
    console.error('清除Token失败:', error)
  }
}

//+ 判断是否已登录（任一令牌存在即视为有登录态）
export function isLoggedIn(): boolean {
  return !!getToken() || !!getRefreshToken()
}
