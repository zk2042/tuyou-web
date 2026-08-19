//+ 注销账号页面
//+ 场景：Settings → 注销账号
//+ 接口：POST /auth/cancel（需登录，scene=cancel-account）
//+ 双重校验：手机号验证码 + 原密码
//+ 成功后：后端置 status=2，前端清登录态并跳登录页
import { Button, Input, Dialog } from '@nutui/nutui-react'
import { useState } from 'react'
import { useDispatch } from 'react-redux'
import Taro from '@tarojs/taro'
import HeaderNavBar from '@/components/HeaderNavBar'
import { cancelAccountAPI } from '@/apis/user'
import { useSendCode } from '@/hooks/useSendCode'
import CodeInput from '@/components/CodeInput'
import { logout } from '@/store/modules/user'
import type { AppDispatch } from '@/store'
import { useAuthGuard } from '@/components/AuthRoute'
import '@/styles/auth.less'
import './index.less'

const CancelAccount = () => {
  useAuthGuard()
  const dispatch: AppDispatch = useDispatch<AppDispatch>()
  //+ 注销需用当前账号手机号发码：从 store userInfo.phone 读取
  //+ 为避免依赖 store 加载时机，提供手机号输入框（与后端 cancel 接口 phone 字段对齐）
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirmVisible, setConfirmVisible] = useState(false)

  //+ 验证码发送：scene=cancel-account，发往当前账号手机号
  const { codeSent, codeCountdown, sendCode } = useSendCode('cancel-account')

  const handleSendCode = () => {
    if (!phone) {
      Taro.showToast({ title: '请输入当前账号手机号', icon: 'none' })
      return
    }
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      Taro.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }
    sendCode(phone)
  }

  const handleSubmit = () => {
    if (!phone) {
      Taro.showToast({ title: '请输入当前账号手机号', icon: 'none' })
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
    if (!password) {
      Taro.showToast({ title: '请输入密码', icon: 'none' })
      return
    }
    setConfirmVisible(true)
  }

  //+ 确认注销：调接口 → 清登录态 → 跳登录页
  const handleConfirmCancel = async () => {
    setConfirmVisible(false)
    setSubmitting(true)
    try {
      const res = await cancelAccountAPI({ phone, code, password })
      if (res.code === 0 || res.code === 200) {
        Taro.showToast({ title: '已注销', icon: 'success' })
        //+ 清登录态：复用 logout reducer（清 token + userInfo + isLoggedIn）
        dispatch(logout())
        setTimeout(() => {
          //+ reLaunch 清空页面栈，避免返回到已注销账号的页面
          Taro.reLaunch({ url: '/pages/Login/index' })
        }, 1500)
      } else {
        Taro.showToast({ title: res.message || '注销失败', icon: 'none' })
      }
    } catch (err: any) {
      const msg = err?.message || err?.payload || '注销失败'
      Taro.showToast({ title: typeof msg === 'string' ? msg : '注销失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-container cancel-account-page">
      <HeaderNavBar title="注销账号" backPageNum={1} fixed={false} />

      <div className="cancel-warning">
        注销后账号将无法登录，所有内容将被标记为"已注销"，且无法恢复。请谨慎操作。
      </div>

      <div className="auth-form">
        <div className="auth-form-item">
          <Input
            value={phone}
            onChange={setPhone}
            placeholder="请输入当前账号手机号"
            type="tel"
            maxLength={11}
            className="auth-input"
          />
        </div>

        <CodeInput
          value={code}
          onChange={setCode}
          codeCountdown={codeCountdown}
          codeSent={codeSent}
          onSendCode={handleSendCode}
        />

        <div className="auth-form-item">
          <Input
            value={password}
            onChange={setPassword}
            placeholder="请输入密码"
            type="password"
            className="auth-input"
          />
        </div>

        <Button
          type="primary"
          className="auth-submit-btn cancel-submit-btn"
          loading={submitting}
          disabled={submitting}
          onClick={handleSubmit}
        >
          确认注销
        </Button>
      </div>

      <Dialog
        visible={confirmVisible}
        title="确认注销账号？"
        content="注销后无法恢复，所有内容将被标记为已注销。"
        confirmText="确认注销"
        cancelText="取消"
        onConfirm={handleConfirmCancel}
        onCancel={() => setConfirmVisible(false)}
      />
    </div>
  )
}

export default CancelAccount
