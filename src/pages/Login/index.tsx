//+ 登录页面
//+ 受控表单：用 useState 管理字段值，手写校验，避免 NutUI Form.Item 注入不稳定
//+ 支持密码登录和验证码登录两种方式，底部提供忘记密码/切换模式/立即注册入口
//+ 密码登录：需输入图形验证码（CaptchaInput + useCaptcha），captchaId/captchaCode 回传后端
//+ 验证码登录：仅需短信验证码（CodeInput + useSendCode）
import { Button, Input } from '@nutui/nutui-react'
import { Navigator } from '@tarojs/components'
import { useDispatch } from 'react-redux'
import Taro from '@tarojs/taro'
import { fetchLogin } from '@/store/modules/user'
import type { AppDispatch } from '@/store'
import { useState } from 'react'
import { useSendCode } from '@/hooks/useSendCode'
import { useCaptcha } from '@/hooks/useCaptcha'
import CodeInput from '@/components/CodeInput'
import CaptchaInput from '@/components/CaptchaInput'
//+ 导入公共认证样式
import '@/styles/auth.less'
import './index.less'

type LoginMode = 'password' | 'code'

const Login = () => {
  const dispatch: AppDispatch = useDispatch<AppDispatch>()

  //+ 登录模式：password=密码登录，code=验证码登录
  const [loginMode, setLoginMode] = useState<LoginMode>('password')
  //+ 表单字段（受控）
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  //+ 图形验证码输入值
  const [captchaCode, setCaptchaCode] = useState('')

  //+ 验证码发送逻辑复用
  const { codeSent, codeCountdown, sendCode } = useSendCode('login')
  //+ 图形验证码：自动拉取一次，refresh 可点击图片刷新
  //+ 仅密码登录模式需要，切换到验证码登录时不重复请求（hook 内部 autoFetch 只执行一次）
  const { captchaImage, captchaId, loading: captchaLoading, refresh: refreshCaptcha } = useCaptcha(true)

  //+ 切换登录模式
  const toggleMode = () => {
    setLoginMode((prev) => (prev === 'password' ? 'code' : 'password'))
    //+ 切换到密码模式时确保图形验证码已拉取
    if (loginMode === 'code' && !captchaImage) {
      refreshCaptcha()
    }
    //+ 切换模式时清空图形验证码输入，避免残留
    setCaptchaCode('')
  }

  //+ 登录提交：校验 → 调接口 → 反馈
  const handleSubmit = async () => {
    if (!phone) {
      Taro.showToast({ title: '请输入手机号', icon: 'none' })
      return
    }
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      Taro.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }

    const params: {
      phone: string
      type: 'password' | 'code'
      password?: string
      code?: string
      captcha_id?: string
      captcha?: string
    } = {
      phone,
      type: loginMode === 'code' ? 'code' : 'password',
    }

    if (loginMode === 'code') {
      if (!code) {
        Taro.showToast({ title: '请输入验证码', icon: 'none' })
        return
      }
      if (!/^\d{6}$/.test(code)) {
        Taro.showToast({ title: '请输入6位数字验证码', icon: 'none' })
        return
      }
      params.code = code
    } else {
      if (!password) {
        Taro.showToast({ title: '请输入密码', icon: 'none' })
        return
      }
      //+ 图形验证码校验
      if (!captchaCode) {
        Taro.showToast({ title: '请输入图形验证码', icon: 'none' })
        return
      }
      if (!captchaId) {
        Taro.showToast({ title: '验证码已过期，请刷新', icon: 'none' })
        refreshCaptcha()
        return
      }
      params.password = password
      params.captcha_id = captchaId
      params.captcha = captchaCode
      params.code=""
    }

    const result: any = await dispatch(fetchLogin(params))

    if (result.type === 'user/fetchLogin/fulfilled') {
      Taro.showToast({ title: '登录成功', icon: 'success' })
      setTimeout(() => {
        Taro.redirectTo({ url: '/pages/Home/index' })
      }, 1500)
    } else {
      const errMsg = result.payload || '登录失败，请检查手机号和密码'
      Taro.showToast({ title: errMsg, icon: 'none' })
      //+ 密码登录失败：图形验证码已被后端消费，需刷新避免重复使用
      if (loginMode === 'password') {
        refreshCaptcha()
        setCaptchaCode('')
      }
    }
  }

  return (
    <div className="auth-container">
      {/* logo */}
      <div className="auth-logo">
        <img src="http://192.168.10.7:89/logo.png" alt="logo" />
        <p>探索自然，结伴前行</p>
      </div>

      {/* 表单区域 */}
      <div className="auth-form">
        {/* 手机号 */}
        <div className="auth-form-item">
          <Input
            value={phone}
            onChange={setPhone}
            placeholder="请输入手机号"
            type="tel"
            className="auth-input"
          />
        </div>

        {/* 密码登录模式：密码 + 图形验证码 */}
        {loginMode === 'password' && (
          <>
            <div className="auth-form-item">
              <Input
                value={password}
                onChange={setPassword}
                placeholder="请输入密码"
                type="password"
                className="auth-input"
              />
            </div>
            <CaptchaInput
              value={captchaCode}
              onChange={setCaptchaCode}
              captchaImage={captchaImage}
              loading={captchaLoading}
              onRefresh={refreshCaptcha}
             
            />
          </>
        )}

        {/* 验证码登录模式 */}
        {loginMode === 'code' && (
          <CodeInput
            value={code}
            onChange={setCode}
            codeCountdown={codeCountdown}
            codeSent={codeSent}
            onSendCode={() => sendCode(phone)}
          />
        )}

        {/* 提交按钮 */}
        <Button type="primary" className="auth-submit-btn" onClick={handleSubmit}>
          {loginMode === 'password' ? '登录' : '短信登录'}
        </Button>
      </div>

      {/* 模式切换 + 忘记密码 */}
      <div className="auth-actions">
        <span className="auth-action-text">
          <Navigator url="/forgot-password" className="auth-link-text">
            忘记密码?
          </Navigator>
        </span>
        <span className="auth-action-text" onClick={toggleMode}>
          {loginMode === 'password' ? '短信登录' : '密码登录'}
        </span>
      </div>

      {/* 注册引导 */}
      <div className="auth-link">
        <div className="auth-link-row">
          还没有账号？
          <Navigator url="/register" className="auth-link-text">
            立即注册
          </Navigator>
        </div>
      </div>
    </div>
  )
}

export default Login
