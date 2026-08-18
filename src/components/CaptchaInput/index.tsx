//+ 图形验证码输入组件（受控）
//+ 复用于登录页（密码登录）、注销账号等人机校验场景
//+ 复用 auth-form-item / auth-input 全局样式，与 CodeInput 视觉一致
//+ 由父组件通过 value/onChange 受控管理用户输入值，captchaImage/loading/refresh 由 useCaptcha 提供
import { Input } from '@nutui/nutui-react'

interface CaptchaInputProps {
  //+ 用户输入的图形验证码值
  value: string
  //+ 输入值变更回调
  onChange: (val: string) => void
  //+ 图形验证码图片（base64，由 useCaptcha 提供）
  captchaImage: string
  //+ 是否正在加载新验证码（由 useCaptcha 提供）
  loading: boolean
  //+ 点击验证码图片/刷新按钮回调（由 useCaptcha 的 refresh 提供）
  onRefresh: () => void
}

const CaptchaInput = ({
  value,
  onChange,
  captchaImage,
  loading,
  onRefresh,
}: CaptchaInputProps) => {
  return (
    <div className="auth-form-item auth-form-item-captcha">
      {/* 验证码输入框：受控，值由父组件管理 */}
      <Input
        value={value}
        onChange={onChange}
        placeholder="请输入图形验证码"
        type="text"
        maxLength={6}
        className="auth-input auth-input-captcha"
      />
      {/* 验证码图片区域：点击刷新；loading 时显示占位文案 */}
      <div
        className={`captcha-image-btn ${loading ? 'captcha-image-btn--loading' : ''}`}
        onClick={onRefresh}
      >
        {loading ? (
          <span className="captcha-loading-text">加载中...</span>
        ) : captchaImage ? (
          <img src={captchaImage} alt="点击刷新验证码" className="captcha-img" />
        ) : (
          <span className="captcha-loading-text">点击获取</span>
        )}
      </div>
    </div>
  )
}

export default CaptchaInput
