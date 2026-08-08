//+ 编辑用户信息页（从设置进入）
//+ 功能：编辑传统个人信息（真实姓名、手机、性别、生日等）
//+ 标签使用习惯：NutUI 组件（Button/Input/Picker/DatePicker）+ 原生 HTML
import { useState } from 'react'
import Taro from '@tarojs/taro'
import { Button, Input, Picker, DatePicker } from '@nutui/nutui-react'
import HeaderNavBar from '@/components/HeaderNavBar'
import './index.less'

//+ 性别选项
const GENDER_OPTIONS = [
  [
    { label: '男', value: 'male' },
    { label: '女', value: 'female' },
    { label: '保密', value: 'secret' },
  ]
]

//+ 表单状态类型
interface UserInfoFormState {
  realName: string
  phone: string
  gender: string
  birthday: string
  region: string
  occupation: string
}

//+ 初始数据（模拟当前用户数据）
const initialData: UserInfoFormState = {
  realName: '',
  phone: '138****8888',
  gender: '',
  birthday: '',
  region: '',
  occupation: '',
}

const EditUserInfo = () => {
  const [form, setForm] = useState<UserInfoFormState>(initialData)
  const [submitting, setSubmitting] = useState(false)
  const [genderPickerVisible, setGenderPickerVisible] = useState(false)
  const [birthdayPickerVisible, setBirthdayPickerVisible] = useState(false)

  //+ 更新单个字段
  const updateField = (field: keyof UserInfoFormState, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  //+ 性别选择确认
  const handleGenderConfirm = (_options: any, value: any[]) => {
    updateField('gender', value[0])
    setGenderPickerVisible(false)
  }

  //+ 生日选择确认
  const handleBirthdayConfirm = (_options: any, value: any[]) => {
    const dateStr = `${value[0]}-${String(value[1]).padStart(2, '0')}-${String(value[2]).padStart(2, '0')}`
    updateField('birthday', dateStr)
    setBirthdayPickerVisible(false)
  }

  //+ 保存表单
  const handleSave = async () => {
    if (submitting) return

    //+ 手机号校验
    if (form.phone && !/^1[3-9]\d{9}$/.test(form.phone)) {
      Taro.showToast({ title: '请输入正确的手机号', icon: 'none' })
      return
    }

    setSubmitting(true)
    try {
      //+ 后期对接保存接口
      await new Promise(resolve => setTimeout(resolve, 500))
      Taro.showToast({ title: '保存成功', icon: 'success' })
      setTimeout(() => {
        Taro.navigateBack({ delta: 1 })
      }, 1000)
    } catch (err) {
      Taro.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  //+ 性别显示文本
  const getGenderText = (value: string) => {
    const map: Record<string, string> = { male: '男', female: '女', secret: '保密' }
    return map[value] || ''
  }

  return (
    <div className="edit-userinfo-page">
      <HeaderNavBar title="个人信息" fixed={true} cancel={true} />

      <div className="form-wrapper">
        {/* 真实姓名 */}
        <div className="form-section">
          <div className="form-label">真实姓名</div>
          <Input
            className="form-input"
            type="text"
            placeholder="请输入真实姓名"
            value={form.realName}
            maxLength={20}
            onChange={(v) => updateField('realName', v)}
          />
        </div>

        {/* 手机号 */}
        <div className="form-section">
          <div className="form-label">手机号</div>
          <Input
            className="form-input"
            type="number"
            placeholder="请输入手机号"
            value={form.phone}
            maxLength={11}
            onChange={(v) => updateField('phone', v)}
          />
        </div>

        {/* 性别 */}
        <div className="form-section" onClick={() => setGenderPickerVisible(true)}>
          <div className="form-label">性别</div>
          <div className={`form-picker-display ${!form.gender ? 'placeholder' : ''}`}>
            {getGenderText(form.gender) || '请选择性别'}
          </div>
          <Picker
            visible={genderPickerVisible}
            title="选择性别"
            options={GENDER_OPTIONS}
            value={form.gender ? [form.gender] : []}
            onConfirm={handleGenderConfirm}
            onCancel={() => setGenderPickerVisible(false)}
            onClose={() => setGenderPickerVisible(false)}
          />
        </div>

        {/* 生日 */}
        <div className="form-section" onClick={() => setBirthdayPickerVisible(true)}>
          <div className="form-label">生日</div>
          <div className={`form-picker-display ${!form.birthday ? 'placeholder' : ''}`}>
            {form.birthday || '请选择生日'}
          </div>
          <DatePicker
            visible={birthdayPickerVisible}
            title="选择生日"
            type="date"
            value={form.birthday ? new Date(form.birthday) : undefined}
            endDate={new Date()}
            onConfirm={handleBirthdayConfirm}
            onCancel={() => setBirthdayPickerVisible(false)}
            onClose={() => setBirthdayPickerVisible(false)}
          />
        </div>

        {/* 地区 */}
        <div className="form-section">
          <div className="form-label">地区</div>
          <Input
            className="form-input"
            type="text"
            placeholder="请输入所在地区"
            value={form.region}
            maxLength={50}
            onChange={(v) => updateField('region', v)}
          />
        </div>

        {/* 职业 */}
        <div className="form-section">
          <div className="form-label">职业</div>
          <Input
            className="form-input"
            type="text"
            placeholder="请输入职业"
            value={form.occupation}
            maxLength={30}
            onChange={(v) => updateField('occupation', v)}
          />
        </div>
      </div>

      {/* 底部保存按钮 */}
      <div className="submit-bar">
        <Button
          type="primary"
          block
          loading={submitting}
          disabled={submitting}
          onClick={handleSave}
        >
          {submitting ? '保存中...' : '保存'}
        </Button>
      </div>
    </div>
  )
}

export default EditUserInfo
