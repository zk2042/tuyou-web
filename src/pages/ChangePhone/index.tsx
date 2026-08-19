//+ 修改手机号页面
//+ 场景：Settings → 修改手机号
//+ 接口：POST /auth/change-phone（需登录，scene=change-phone）
//+ 流程：输入新手机号 → 发送验证码（scene=change-phone）→ 输入验证码 → 提交
import { Button, Input } from '@nutui/nutui-react'
import { useState } from 'react'
import Taro from '@tarojs/taro'
import HeaderNavBar from '@/components/HeaderNavBar'
import { changePhoneAPI } from '@/apis/user'
import { useSendCode } from '@/hooks/useSendCode'
import CodeInput from '@/components/CodeInput'
import { useAuthGuard } from '@/components/AuthRoute'
import '@/styles/auth.less'
import './index.less'

const ChangePhone = () => {
  useAuthGuard()
  const [newPhone, setNewPhone] = useState('')
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)

  //+ 验证码发送逻辑：scene=change-phone，发往新手机号
  const { codeSent, codeCountdown, sendCode } = useSendCode('change-phone')

  const handleSendCode = () => {
    if (!newPhone) {
      Taro.showToast({ title: '请输入新手机号', icon: 'none' })
      return
    }
    if (!/^1[3-9]\d{9}$/.test(newPhone)) {
      Taro.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }
    sendCode(newPhone)
  }

  const handleSubmit = async () => {
    if (!newPhone) {
      Taro.showToast({ title: '请输入新手机号', icon: 'none' })
      return
    }
    if (!/^1[3-9]\d{9}$/.test(newPhone)) {
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

    setSubmitting(true)
    try {
      const res = await changePhoneAPI({ newPhone, code })
      if (res.code === 0 || res.code === 200) {
        Taro.showToast({ title: '修改成功', icon: 'success' })
        setTimeout(() => Taro.navigateBack({ delta: 1 }), 1000)
      } else {
        Taro.showToast({ title: res.message || '修改失败', icon: 'none' })
      }
    } catch (err: any) {
      const msg = err?.message || err?.payload || '修改失败'
      Taro.showToast({ title: typeof msg === 'string' ? msg : '修改失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-container change-phone-page">
      <HeaderNavBar title="修改手机号" backPageNum={1} fixed={false} />

      <div className="auth-form">
        <div className="auth-form-item">
          <Input
            value={newPhone}
            onChange={setNewPhone}
            placeholder="请输入新手机号"
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

export default ChangePhone
