//+ 注册页面
//+ 受控表单：用 useState 管理字段值，手写校验，避免 NutUI Form.Item 注入不稳定
//+ 保留头部 HeaderNavBar、logo、底部"去登录"跳转
import { Button, Input } from '@nutui/nutui-react'
import { Navigator } from '@tarojs/components'
import { useDispatch } from 'react-redux'
import Taro from '@tarojs/taro'
import { fetchRegister } from '@/store/modules/user'
import type { AppDispatch } from '@/store'
import { useState } from 'react'
import { useSendCode } from '@/hooks/useSendCode'
import CodeInput from '@/components/CodeInput'
//+ 封装组件
import HeaderNavBar from '@/components/HeaderNavBar'
//+ 导入公共认证样式
import '@/styles/auth.less'
import './index.less'

const Register = () => {
  const dispatch: AppDispatch = useDispatch<AppDispatch>()

  //+ 表单字段（受控）
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [nickname, setNickname] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  //+ 验证码发送逻辑复用
  const { codeSent, codeCountdown, sendCode } = useSendCode('register')

  //+ 注册提交：校验 → 调接口 → 反馈
  const handleSubmit = async () => {
    if (!phone) {
      Taro.showToast({ title: '请输入手机号', icon: 'none' })
      return
    }
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      Taro.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }
    if (!code) {
      Taro.showToast({ title: '请输入验证码', icon: 'none' })
      return
    }
    if (!/^\d{6}$/.test(code)) {
      Taro.showToast({ title: '请输入6位数字验证码', icon: 'none' })
      return
    }
    if (!nickname) {
      Taro.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }
    if (nickname.length < 2 || nickname.length > 20) {
      Taro.showToast({ title: '昵称长度为2-20个字符', icon: 'none' })
      return
    }
    if (!password) {
      Taro.showToast({ title: '请输入密码', icon: 'none' })
      return
    }
    if (password.length < 6) {
      Taro.showToast({ title: '密码至少6位', icon: 'none' })
      return
    }
    if (!confirmPassword) {
      Taro.showToast({ title: '请确认密码', icon: 'none' })
      return
    }
    if (password !== confirmPassword) {
      Taro.showToast({ title: '两次输入的密码不一致', icon: 'none' })
      return
    }

    const result: any = await dispatch(
      fetchRegister({ phone, code, nickname, password, confirmPassword })
    )

    if (result.type === 'user/fetchRegister/fulfilled') {
      Taro.showToast({ title: '注册成功', icon: 'success' })
      setTimeout(() => {
        Taro.redirectTo({ url: '/pages/Login/index' })
      }, 1500)
    } else {
      const errMsg = result.payload || '注册失败，请重试'
      Taro.showToast({ title: errMsg, icon: 'none' })
    }
  }

  return (
    <div className="auth-container register-container">
      {/* 顶部导航：使用封装的 HeaderNavBar 组件 */}
      <HeaderNavBar title="注册" backPageNum={1} />

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

        {/* 验证码 */}
        <CodeInput
          value={code}
          onChange={setCode}
          codeCountdown={codeCountdown}
          codeSent={codeSent}
          onSendCode={() => sendCode(phone)}
        />

        {/* 昵称 */}
        <div className="auth-form-item">
          <Input
            value={nickname}
            onChange={setNickname}
            placeholder="请输入昵称"
            className="auth-input"
          />
        </div>

        {/* 设置密码 */}
        <div className="auth-form-item">
          <Input
            value={password}
            onChange={setPassword}
            placeholder="请设置密码（至少六位）"
            type="password"
            className="auth-input"
          />
        </div>

        {/* 确认密码 */}
        <div className="auth-form-item">
          <Input
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="请确认密码"
            type="password"
            className="auth-input"
          />
        </div>

        {/* 提交按钮 */}
        <Button type="primary" className="auth-submit-btn" onClick={handleSubmit}>
          注册
        </Button>
      </div>

      {/* 已有账号？去登录 */}
      <div className="auth-link">
        <div className="auth-link-row">
          已有账号？
          <Navigator url="/login" className="auth-link-text">
            去登录
          </Navigator>
        </div>
      </div>
    </div>
  )
}

export default Register
