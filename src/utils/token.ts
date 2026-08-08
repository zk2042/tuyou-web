//+ Token管理工具，封装Token的获取、存储和清除
import Taro from '@tarojs/taro'

//+ Token存储的key
const TOKEN_KEY = 'tuyou_token'

//+ 获取Token
export function getToken(): string | null {
  try {
    const token = Taro.getStorageSync(TOKEN_KEY)
    return token || null
  } catch (error) {
    console.error('获取Token失败:', error)
    return null
  }
}

//+ 设置Token
export function setToken(token: string): void {
  try {
    Taro.setStorageSync(TOKEN_KEY, token)
  } catch (error) {
    console.error('设置Token失败:', error)
  }
}

//+ 清除Token
export function clearToken(): void {
  try {
    Taro.removeStorageSync(TOKEN_KEY)
  } catch (error) {
    console.error('清除Token失败:', error)
  }
}

//+ 判断是否已登录
export function isLoggedIn(): boolean {
  return !!getToken()
}