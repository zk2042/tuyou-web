//+ 图形验证码 Hook
//+ 封装 GET /auth/captcha 调用，管理 captcha_id + captcha_image 状态
//+ 复用于登录页（密码登录）、注销账号等需要人机校验的场景
//+ 调用方通过 ref/captchaId 读取最新 captcha_id，在提交时回传后端
import { useState, useCallback, useRef, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { getCaptchaAPI } from '@/apis/user'
import type { CaptchaInfo } from '@/apis/user'

export const useCaptcha = (autoFetch = true) => {
  //+ 验证码图片（base64，可直接 <img src=...>）
  const [captchaImage, setCaptchaImage] = useState('')
  //+ 验证码 ID：提交时回传后端用于校验
  const [captchaId, setCaptchaId] = useState('')
  //+ 加载中状态（点击刷新按钮时）
  const [loading, setLoading] = useState(false)
  //+ 用 ref 保存最新 captchaId，避免组件重渲染导致闭包旧值
  const captchaIdRef = useRef('')

  useEffect(() => {
    captchaIdRef.current = captchaId
  }, [captchaId])

  //+ 获取图形验证码：调接口 → 更新图片和 ID
  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getCaptchaAPI()
      const info: CaptchaInfo = res.data
      setCaptchaImage(info.captcha_image)
      setCaptchaId(info.captcha_id)
      captchaIdRef.current = info.captcha_id
      return info
    } catch (err: any) {
      //+ 不抛错给调用方，由 hook 内部统一 Toast
      Taro.showToast({ title: err?.message || '获取验证码失败', icon: 'none' })
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  //+ 自动拉取一次（默认开启，组件挂载即获取）
  useEffect(() => {
    if (autoFetch) {
      refresh()
    }
  }, [autoFetch, refresh])

  return {
    captchaImage,
    captchaId,
    captchaIdRef,
    loading,
    refresh,
  }
}
