//+ 验证码输入组件（受控）
//+ 复用于登录、注册、忘记密码页面
//+ 由父组件通过 value/onChange 受控管理验证码值，避免 NutUI Form.Item cloneElement 注入不稳定的问题
import { Input } from '@nutui/nutui-react'

interface CodeInputProps {
  //+ 验证码值
  value: string
  //+ 验证码变更回调
  onChange: (val: string) => void
  //+ 倒计时剩余秒数（>0 表示倒计时中）
  codeCountdown: number
  //+ 是否已发送过验证码（用于切换按钮文案）
  codeSent: boolean
  //+ 点击发送验证码回调
  onSendCode: () => void
}

const CodeInput = ({
  value,
  onChange,
  codeCountdown,
  codeSent,
  onSendCode,
}: CodeInputProps) => {
  return (
    <div className="auth-form-item auth-form-item-code">
      {/* 验证码输入框：受控，值由父组件管理 */}
      <Input
        value={value}
        onChange={onChange}
        placeholder="请输入验证码"
        type="number"
        maxLength={6}
        className="auth-input auth-input-code"
      />
      {/* 发送验证码按钮：绝对定位在输入框右侧（样式由各页面 less 控制） */}
      <div
        className={`send-code-btn ${codeCountdown > 0 ? 'send-code-btn--disabled' : ''}`}
        onClick={onSendCode}
      >
        {codeCountdown > 0 ? `${codeCountdown}s后重发` : codeSent ? '重新发送' : '发送验证码'}
      </div>
    </div>
  )
}

export default CodeInput
