//+ 编辑资料页（从个人中心进入）
//+ Q4 链路开发：fetchProfileInfo 获取初始值，fetchUpdateProfile 保存
import { useState, useCallback } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { Button, Input, TextArea, Loading } from '@nutui/nutui-react'
import { useDispatch } from 'react-redux'
import HeaderNavBar from '@/components/HeaderNavBar'
import Avatar from '@/components/Avatar'
import { uploadImageAPI } from '@/apis/upload'
import { fetchProfileInfo, fetchUpdateProfile } from '@/store/modules/profile'
import type { ProfileInfo, ProfileUpdate } from '@/types'
import type { AppDispatch } from '@/store'
import './index.less'

//+ 最大长度限制
const MAX_NICKNAME = 20
const MAX_SIGNATURE = 100

//+ 表单状态类型
interface EditFormState {
  avatar: string
  bgImg: string
  nickname: string
  signature: string // 页面展示用"签名"，接口用 bio
}

const EditProfile = () => {
  const dispatch: AppDispatch = useDispatch()

  const [form, setForm] = useState<EditFormState>({
    avatar: '',
    bgImg: '',
    nickname: '',
    signature: ''
  })
  const [submitting, setSubmitting] = useState(false)
  const [loading, setLoading] = useState(false)

  //+ Q4：页面首次进入/显示时，拉取 profile info（真实 thunk 接口）作为初始值
  const loadProfile = useCallback(async () => {
    setLoading(true)
    try {
      const action = await dispatch(fetchProfileInfo())
      const info: ProfileInfo | undefined = (action as any)?.payload
      if (info) {
        setForm({
          avatar: info.avatar || '',
          bgImg: info.bgImg || '',
          nickname: info.nickname || '',
          signature: info.bio || ''
        })
      }
    } catch (err) {
      console.warn('[EditProfile] load profile failed:', err)
    } finally {
      setLoading(false)
    }
  }, [dispatch])

  useDidShow(() => {
    loadProfile()
  })

  //+ 更新单个字段
  const updateField = (field: keyof EditFormState, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  //+ 选择并上传头像
  const handleChangeAvatar = async () => {
    try {
      const chooseRes = await Taro.chooseImage({ count: 1, sizeType: ['compressed'] })
      const filePath = chooseRes.tempFilePaths[0]
      Taro.showLoading({ title: '上传中...' })
      const res = await uploadImageAPI(filePath, 'avatar')
      Taro.hideLoading()
      if (res.code === 0 || res.code === 200) {
        updateField('avatar', res.data.url)
      } else {
        Taro.showToast({ title: res.message || '上传失败', icon: 'none' })
      }
    } catch (err) {
      Taro.hideLoading()
      console.warn('[EditProfile] 头像上传失败:', err)
      Taro.showToast({ title: '上传失败', icon: 'none' })
    }
  }

  //+ 选择并上传背景图
  const handleChangeBgImg = async () => {
    try {
      const chooseRes = await Taro.chooseImage({ count: 1, sizeType: ['compressed'] })
      const filePath = chooseRes.tempFilePaths[0]
      Taro.showLoading({ title: '上传中...' })
      const res = await uploadImageAPI(filePath, 'bg')
      Taro.hideLoading()
      if (res.code === 0 || res.code === 200) {
        updateField('bgImg', res.data.url)
      } else {
        Taro.showToast({ title: res.message || '上传失败', icon: 'none' })
      }
    } catch (err) {
      Taro.hideLoading()
      console.warn('[EditProfile] 背景图上传失败:', err)
      Taro.showToast({ title: '上传失败', icon: 'none' })
    }
  }

  //+ Q4：保存表单（对接 fetchUpdateProfile thunk → 真实接口）
  const handleSave = async () => {
    if (submitting) return

    if (!form.nickname.trim()) {
      Taro.showToast({ title: '昵称不能为空', icon: 'none' })
      return
    }

    setSubmitting(true)
    try {
      // 页面 signature → 接口 bio 字段
      const params: ProfileUpdate = {
        avatar: form.avatar,
        bgImg: form.bgImg,
        nickname: form.nickname.trim(),
        bio: form.signature.trim()
      }
      const action = await dispatch(fetchUpdateProfile(params))
      const ok = (action as any)?.meta?.requestStatus === 'fulfilled'
      if (ok) {
        Taro.showToast({ title: '保存成功', icon: 'success' })
        setTimeout(() => {
          Taro.navigateBack({ delta: 1 })
        }, 800)
      } else {
        Taro.showToast({
          title: (action as any)?.payload || '保存失败',
          icon: 'none'
        })
      }
    } catch (err) {
      console.warn('[EditProfile] save failed:', err)
      Taro.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="edit-profile-page">
      {/* 头部导航栏 */}
      <HeaderNavBar
        title="编辑资料"
        fixed={false}
        cancel={true}
      />

      {loading ? (
        <div className="edit-profile-loading"><Loading>加载中...</Loading></div>
      ) : (
        <div className="form-wrapper">
          {/* 头像模块 */}
          <div className="avatar-section">
            <div className="section-label">头像</div>
            <div className="avatar-upload" onClick={handleChangeAvatar}>
              <Avatar url={form.avatar} size="80" />
            </div>
          </div>

          {/* 背景图模块 */}
          <div className="bg-section">
            <div className="section-label">背景图</div>
            <div className="bg-preview" onClick={handleChangeBgImg}>
              {form.bgImg ? (
                <img src={form.bgImg} alt="背景图" />
              ) : (
                <div className="bg-placeholder">
                  <span className="placeholder-text">点击选择背景图</span>
                </div>
              )}
            </div>
          </div>

          {/* 昵称输入 */}
          <div className="form-section">
            <div className="form-label">昵称</div>
            <Input
              className="form-input"
              type="text"
              placeholder="请输入昵称"
              value={form.nickname}
              maxLength={MAX_NICKNAME}
              onChange={(v) => updateField('nickname', v)}
            />
            <span className="form-count">{form.nickname.length}/{MAX_NICKNAME}</span>
          </div>

          {/* 签名输入 */}
          <div className="form-section column">
            <div className="form-label">签名</div>
            <TextArea
              className="form-textarea"
              placeholder="介绍一下自己吧"
              value={form.signature}
              onChange={(v) => updateField('signature', v)}
              maxLength={MAX_SIGNATURE}
              rows={1}
              showCount={false}
            />
            <span className="form-count right">{form.signature.length}/{MAX_SIGNATURE}</span>
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
      )}
    </div>
  )
}

export default EditProfile
