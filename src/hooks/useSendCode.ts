//+ 发送验证码 + 倒计时 Hook
//+ 复用于登录、注册、忘记密码三个页面
//+ 内部封装手机号校验、倒计时清理，调用方只需传 scene 与手机号
import { useState, useRef, useCallback, useEffect } from 'react'
import { useDispatch } from 'react-redux'
import Taro from '@tarojs/taro'
import { fetchSendCode } from '@/store/modules/user'
import type { AppDispatch } from '@/store'

//+ 验证码场景类型，与后端接口对齐
type Scene = 'register' | 'login' | 'reset-pwd'

export const useSendCode = (scene: Scene) => {
  const dispatch: AppDispatch = useDispatch<AppDispatch>()
  const [codeSent, setCodeSent] = useState(false)
  const [codeCountdown, setCodeCountdown] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  //+ 组件卸载时清理倒计时定时器，避免内存泄漏
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [])

  //+ 发送验证码：校验手机号 → 调接口 → 成功后启动 60s 倒计时
  const sendCode = useCallback(
    async (phone: string) => {
      if (!phone) {
        Taro.showToast({ title: '请先输入手机号', icon: 'none' })
        return
      }
      if (!/^1[3-9]\d{9}$/.test(phone)) {
        Taro.showToast({ title: '请输入正确的手机号', icon: 'none' })
        return
      }
      //+ 倒计时进行中不允许重复发送
      if (codeCountdown > 0) return

      const result: any = await dispatch(fetchSendCode({ phone, scene }))

      if (result.type === 'user/fetchSendCode/fulfilled') {
        setCodeSent(true)
        Taro.showToast({ title: '验证码已发送', icon: 'success' })
        setCodeCountdown(60)
        timerRef.current = setInterval(() => {
          setCodeCountdown((prev) => {
            if (prev <= 1) {
              if (timerRef.current) clearInterval(timerRef.current)
              return 0
            }
            return prev - 1
          })
        }, 1000)
      } else {
        const errMsg = result.payload || '发送验证码失败'
        Taro.showToast({ title: errMsg, icon: 'none' })
      }
    },
    [dispatch, scene, codeCountdown]
  )

  return { codeSent, codeCountdown, sendCode }
}
