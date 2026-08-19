//+ 修改密码页面
//+ 场景：Settings → 修改密码
//+ 接口：PUT /auth/password（需登录）
//+ 字段：oldPassword / newPassword / confirmPassword
//+ 校验：非空 + 新密码长度≥6 + 两次新密码一致
import { Button, Input } from '@nutui/nutui-react'
import { useState } from 'react'
import Taro from '@tarojs/taro'
import HeaderNavBar from '@/components/HeaderNavBar'
import { updatePasswordAPI } from '@/apis/user'
import { useAuthGuard } from '@/components/AuthRoute'
import '@/styles/auth.less'
import './index.less'

const ChangePassword = () => {
  useAuthGuard()
  const [oldPassword, setOldPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!oldPassword) {
      Taro.showToast({ title: '请输入原密码', icon: 'none' })
      return
    }
    if (!newPassword) {
      Taro.showToast({ title: '请输入新密码', icon: 'none' })
      return
    }
    if (newPassword.length < 6) {
      Taro.showToast({ title: '新密码至少6位', icon: 'none' })
      return
    }
    if (newPassword !== confirmPassword) {
      Taro.showToast({ title: '两次密码不一致', icon: 'none' })
      return
    }
    if (oldPassword === newPassword) {
      Taro.showToast({ title: '新密码不能与原密码相同', icon: 'none' })
      return
    }

    setSubmitting(true)
    try {
      const res = await updatePasswordAPI({ oldPassword, newPassword, confirmPassword })
      if (res.code === 0 || res.code === 200) {
        Taro.showToast({ title: '修改成功', icon: 'success' })
        setTimeout(() => Taro.navigateBack({ delta: 1 }), 1000)
      } else {
        Taro.showToast({ title: res.message || '修改失败', icon: 'none' })
      }
    } catch (err: any) {
      //+ 业务错误（如原密码错误）由响应拦截器 reject ResponseData，此处读取 message
      const msg = err?.message || err?.payload || '修改失败'
      Taro.showToast({ title: typeof msg === 'string' ? msg : '修改失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-container change-password-page">
      <HeaderNavBar title="修改密码" backPageNum={1} fixed={false} />

      <div className="auth-form">
        <div className="auth-form-item">
          <Input
            value={oldPassword}
            onChange={setOldPassword}
            placeholder="请输入原密码"
            type="password"
            className="auth-input"
          />
        </div>
        <div className="auth-form-item">
          <Input
            value={newPassword}
            onChange={setNewPassword}
            placeholder="请输入新密码（至少6位）"
            type="password"
            className="auth-input"
          />
        </div>
        <div className="auth-form-item">
          <Input
            value={confirmPassword}
            onChange={setConfirmPassword}
            placeholder="请确认新密码"
            type="password"
            className="auth-input"
          />
        </div>

        <Button
          type="primary"
          className="auth-submit-btn"
          loading={submitting}
          disabled={submitting}
          onClick={handleSubmit}
        >
          确认修改
        </Button>
      </div>
    </div>
  )
}

export default ChangePassword
