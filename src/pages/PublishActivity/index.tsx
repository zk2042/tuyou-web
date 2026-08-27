//+ 发布活动页
//+ 按《活动模块开发文档》实现完整表单：
//+ 封面上传 + 标题 + 类型 + 开始/结束时间 + 地点 + 费用 + 人数 + 难度 + 活动介绍
//+ 标签使用习惯：NutUI 组件（Input/Picker/DatePicker/TextArea/Button）+ 原生 HTML（div）
//+ 模块化链路：页面 → dispatch(uploadImage thunk) → upload store → apis/upload.ts → request.ts
import { useState, useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import Taro, { useDidHide } from '@tarojs/taro'
import { Button, TextArea, Input, Picker, DatePicker } from '@nutui/nutui-react'
import { Category, IconFont } from '@nutui/icons-react'
import HeaderNavBar from '@/components/HeaderNavBar'
import RichEditor from '@/components/RichEditor'
import { htmlToText, isHtmlEmpty } from '@/utils/html'
import { createActivityAPI } from '@/apis/activity'
import { uploadImageAPI } from '@/apis/upload'
import {
  uploadImage,
  resetImage as resetUploadImage,
  resetUpload,
  clearUploadError
} from '@/store/modules/upload'
import { CATEGORY_MAP } from '@/types'
import type { RootState, AppDispatch } from '@/store'
import { useAuthGuard } from '@/components/AuthRoute'
import './index.less'

//+ 活动类型选项：复用 types/api.ts 的 CATEGORY_MAP 值，避免双份硬编码导致漂移
const TYPE_OPTIONS = Object.values(CATEGORY_MAP)
//+ 难度选项
const DIFFICULTY_OPTIONS = ['入门', '中等', '中高等', '高等']

//+ 表单字段类型
interface FormState {
  coverImg: string
  title: string
  category: string
  startTime: string
  endTime: string
  address: string
  price: string
  maxPeople: string
  difficulty: string
  activityContent: string
  //+ 微信群二维码图片地址（领队发布时必填，报名成功后展示给已报名用户）
  wechatQR: string
}

const initialForm: FormState = {
  coverImg: '',
  title: '',
  category: '',
  startTime: '',
  endTime: '',
  address: '',
  price: '',
  maxPeople: '',
  difficulty: '',
  activityContent: '',
  wechatQR: ''
}

//+ datetime-local 值转提交格式 YYYY-MM-DD HH:mm
const formatDateTime = (localValue: string) => {
  if (!localValue) return ''
  return localValue.replace('T', ' ')
}

//+ 解析 datetime-local 字符串为 Date 对象，供 DatePicker 使用
const parseDate = (str: string): Date | null => {
  if (!str) return null
  const normalized = str.replace('T', ' ')
  const d = new Date(normalized)
  return isNaN(d.getTime()) ? null : d
}

//+ 将 DatePicker 返回的值数组格式化为 datetime-local 字符串
//+ DatePicker type="datetime" 时 selectedValue 为 [year, month, day, hour, minute]
const formatPickerDate = (values: (string | number)[]): string => {
  if (!values || values.length < 5) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  const [y, m, d, h, min] = values
  return `${y}-${pad(Number(m))}-${pad(Number(d))}T${pad(Number(h))}:${pad(Number(min))}`
}

const PublishActivity = () => {
  useAuthGuard()
  const dispatch: AppDispatch = useDispatch()
  //+ 从 upload store 读取封面图上传状态与结果
  const { imageStatus, lastImageUrl, error: uploadError } = useSelector(
    (state: RootState) => state.upload
  )

  //+ 离开页面时清空 upload 缓存，防止下次进入误读上次结果
  useDidHide(() => {
    dispatch(resetUpload())
  })

  const [form, setForm] = useState<FormState>(initialForm)
  //+ 提交中 Loading 状态（防重复提交）
  const [submitting, setSubmitting] = useState(false)
  //+ 二维码独立上传中状态（不走 upload store，避免与封面 store 状态冲突）
  const [qrUploading, setQrUploading] = useState(false)
  //+ Picker / DatePicker 弹窗可见性控制
  const [typePickerVisible, setTypePickerVisible] = useState(false)
  const [difficultyPickerVisible, setDifficultyPickerVisible] = useState(false)
  const [startTimePickerVisible, setStartTimePickerVisible] = useState(false)
  const [endTimePickerVisible, setEndTimePickerVisible] = useState(false)

  //+ Picker 选项格式：二维数组，每项为 { label, value }
  const typePickerOptions = [TYPE_OPTIONS.map(opt => ({ label: opt, value: opt }))]
  const difficultyPickerOptions = [DIFFICULTY_OPTIONS.map(opt => ({ label: opt, value: opt }))]

  //+ DatePicker 日期范围
  const minDate = new Date()
  const maxDate = new Date(minDate.getFullYear() + 2, 11, 31)

  //+ 更新单个字段
  const updateField = (field: keyof FormState, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  //+ 封面上传成功 → 写回 form.coverImg；失败 → toast 提示
  //+ 通过 useEffect 监听 upload store 的 imageStatus 变化，与 PublishNote 同样的链路
  useEffect(() => {
    if (imageStatus === 'success' && lastImageUrl) {
      updateField('coverImg', lastImageUrl)
      dispatch(resetUploadImage())
    } else if (imageStatus === 'error' && uploadError) {
      Taro.showToast({ title: uploadError, icon: 'none' })
      dispatch(clearUploadError())
    }
  }, [imageStatus, lastImageUrl, uploadError])

  //+ 封面图上传：选择图片 → dispatch(uploadImage) → store 完成后 useEffect 写回 form
  //+ type 固定为 'activity'（与后端联调、业务分流目录一致），不要改 'cover'
  const handleUploadCover = async () => {
    if (imageStatus === 'loading') return
    try {
      const chooseRes = await Taro.chooseImage({ count: 1, sizeType: ['compressed'] })
      const filePath = chooseRes.tempFilePaths[0]
      dispatch(uploadImage({ filePath, type: 'activity' }))
    } catch (err) {
      console.warn('[PublishActivity] 选择图片失败:', err)
    }
  }

  //+ 删除封面图
  const handleRemoveCover = () => {
    updateField('coverImg', '')
  }

  //+ 微信群二维码上传：直接调 uploadImageAPI（不走 upload store，避免与封面状态冲突）
  //+ type 仍为 'activity'，与后端业务分流目录一致
  const handleUploadQR = async () => {
    if (qrUploading) return
    try {
      const chooseRes = await Taro.chooseImage({ count: 1, sizeType: ['compressed'] })
      const filePath = chooseRes.tempFilePaths[0]
      setQrUploading(true)
      const res = await uploadImageAPI(filePath, 'activity')
      if (res.code === 0 || res.code === 200) {
        updateField('wechatQR', res.data.url)
      } else {
        Taro.showToast({ title: res.message || '二维码上传失败', icon: 'none' })
      }
    } catch (err: any) {
      Taro.showToast({ title: err?.message || '二维码上传失败', icon: 'none' })
    } finally {
      setQrUploading(false)
    }
  }

  //+ 删除微信群二维码
  const handleRemoveQR = () => {
    updateField('wechatQR', '')
  }

  //+ 活动类型 Picker 确认
  const handleTypeConfirm = (_options: any, value: any[]) => {
    updateField('category', String(value[0]))
    setTypePickerVisible(false)
  }

  //+ 难度 Picker 确认
  const handleDifficultyConfirm = (_options: any, value: any[]) => {
    updateField('difficulty', String(value[0]))
    setDifficultyPickerVisible(false)
  }

  //+ 开始时间 DatePicker 确认
  const handleStartTimeConfirm = (_options: any, value: any[]) => {
    updateField('startTime', formatPickerDate(value))
    setStartTimePickerVisible(false)
  }

  //+ 结束时间 DatePicker 确认
  const handleEndTimeConfirm = (_options: any, value: any[]) => {
    updateField('endTime', formatPickerDate(value))
    setEndTimePickerVisible(false)
  }

  //+ 表单校验
  const validateForm = (): boolean => {
    if (!form.coverImg) {
      Taro.showToast({ title: '请上传活动封面图', icon: 'none' })
      return false
    }
    if (!form.wechatQR) {
      Taro.showToast({ title: '请上传微信群二维码', icon: 'none' })
      return false
    }
    if (!form.title.trim() || form.title.length > 50) {
      Taro.showToast({ title: '请输入活动标题（1-50字）', icon: 'none' })
      return false
    }
    if (!form.category) {
      Taro.showToast({ title: '请选择活动类型', icon: 'none' })
      return false
    }
    if (!form.startTime) {
      Taro.showToast({ title: '请选择开始时间', icon: 'none' })
      return false
    }
    //+ API 文档：startTime 必须晚于当前时间 + 48小时（signUpEnd = startTime - 48h 需为未来时间）
    const now = new Date()
    const start = new Date(form.startTime)
    const diffStartHours = (start.getTime() - now.getTime()) / (1000 * 60 * 60)
    if (diffStartHours <= 48) {
      Taro.showToast({ title: '开始时间需晚于当前时间48小时以上', icon: 'none' })
      return false
    }
    if (!form.endTime) {
      Taro.showToast({ title: '请选择结束时间', icon: 'none' })
      return false
    }
    //+ API 文档：endTime 只需晚于 startTime（无 48h 差值要求）
    const end = new Date(form.endTime)
    if (end.getTime() <= start.getTime()) {
      Taro.showToast({ title: '结束时间必须晚于开始时间', icon: 'none' })
      return false
    }
    if (!form.address.trim()) {
      Taro.showToast({ title: '请输入活动地点', icon: 'none' })
      return false
    }
    const priceNum = Number(form.price)
    if (form.price === '' || isNaN(priceNum) || priceNum < 0) {
      Taro.showToast({ title: '请输入有效费用（≥0）', icon: 'none' })
      return false
    }
    const maxNum = Number(form.maxPeople)
    if (form.maxPeople === '' || isNaN(maxNum) || maxNum < 1) {
      Taro.showToast({ title: '请输入有效人数上限（≥1）', icon: 'none' })
      return false
    }
    if (!form.difficulty) {
      Taro.showToast({ title: '请选择难度等级', icon: 'none' })
      return false
    }
    if (htmlToText(form.activityContent).length > 2000) {
      Taro.showToast({ title: '活动介绍不能超过2000字', icon: 'none' })
      return false
    }
    if (isHtmlEmpty(form.activityContent)) {
      Taro.showToast({ title: '请输入活动介绍', icon: 'none' })
      return false
    }
    //+ 封面正在上传中不允许提交
    if (imageStatus === 'loading') {
      Taro.showToast({ title: '封面上传中，请稍候', icon: 'none' })
      return false
    }
    //+ 二维码正在上传中不允许提交
    if (qrUploading) {
      Taro.showToast({ title: '二维码上传中，请稍候', icon: 'none' })
      return false
    }
    return true
  }

  //+ 提交发布
  const handleSubmit = async () => {
    if (submitting) return
    if (!validateForm()) return

    setSubmitting(true)
    try {
      const res = await createActivityAPI({
        title: form.title.trim(),
        category: form.category,
        coverImg: form.coverImg,
        address: form.address.trim(),
        startTime: formatDateTime(form.startTime),
        endTime: formatDateTime(form.endTime),
        price: Number(form.price),
        maxPeople: Number(form.maxPeople),
        difficulty: form.difficulty,
        activityContent: form.activityContent,
        wechatQR: form.wechatQR
      })

      if (res.code === 0 || res.code === 200) {
        Taro.showToast({ title: '发布成功', icon: 'success' })
        //+ 发布成功后清空上传缓存
        dispatch(resetUpload())
        setTimeout(() => {
          //+ 三级降级返回：优先 navigateBack，其次 window.history.back()，最后 redirectTo 首页
          //+ 兼容 H5 环境下刷新、停留久后 Taro 内部 pageStack 丢失的问题
          const pages = Taro.getCurrentPages()
          if (pages.length > 1) {
            Taro.navigateBack({ delta: 1 }).catch(() => {
              //+ navigateBack 失败（如页面栈异常）
              if (typeof window !== 'undefined' && window.history.length > 1) {
                window.history.back()
              } else {
                Taro.redirectTo({ url: '/pages/Home/index' })
              }
            })
          } else {
            //+ 页面栈仅剩 1 层（可能是直接访问此页）
            if (typeof window !== 'undefined' && window.history.length > 1) {
              window.history.back()
            } else {
              Taro.redirectTo({ url: '/pages/Home/index' })
            }
          }
        }, 1500)
      } else {
        Taro.showToast({ title: res.message || '发布失败，请重试', icon: 'none' })
      }
    } catch (err: any) {
      Taro.showToast({ title: err?.message || '发布失败，请重试', icon: 'none' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="publish-activity-page">
      <HeaderNavBar title="发起活动" backPageNum={1} fixed={false} cancel={true} />

      <div className="form-wrapper">
        {/* 封面图上传 */}
        <div className="cover-section">
          <div className="upload-label">活动封面</div>

          {form.coverImg ? (
            <div className="cover-preview">
              <img className="cover-img" src={form.coverImg} alt="封面预览" />
              <div className="cover-remove" onClick={handleRemoveCover}>×</div>
            </div>
          ) : (
            <div className="cover-upload" onClick={handleUploadCover}>
              {imageStatus === 'loading' ? (
                <span className="uploading-text">上传中...</span>
              ) : (
                <div className="cover-placeholder">
                  <IconFont name="xiangji" fontClassName="iconfont" classPrefix="icon" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* 微信群二维码上传（领队必填，报名成功后展示给已报名用户） */}
        <div className="qr-section">
          <div className="upload-label">
            微信群二维码
            <span className="upload-hint">报名用户可见，用于扫码进群</span>
          </div>

          {form.wechatQR ? (
            <div className="qr-preview">
              <img className="qr-img" src={form.wechatQR} alt="二维码预览" />
              <div className="qr-remove" onClick={handleRemoveQR}>×</div>
            </div>
          ) : (
            <div className="qr-upload" onClick={handleUploadQR}>
              {qrUploading ? (
                <span className="uploading-text">上传中...</span>
              ) : (
                <div className="qr-placeholder">
                  <IconFont name="xiangji" fontClassName="iconfont" classPrefix="icon" />
                </div>
              )}
            </div>
          )}
        </div>

        {/* 标题 */}
        <div className="field-section">
          <div className="field-label">标题</div>
          <Input
            className="field-input"
            type="text"
            placeholder="给你的活动起个名字"
            value={form.title}
            maxLength={50}
            onChange={(v) => updateField('title', v)}
          />
          <span className="field-count">{form.title.length}/50</span>
        </div>

        {/* 类型 - 使用 NutUI Picker */}
        <div className="field-section" onClick={() => setTypePickerVisible(true)}>
          <div className="field-label">类型</div>
          <div className={`field-picker-display ${!form.category ? 'placeholder' : ''}`}>
            {form.category || '选择活动类型'}
          </div>
          <Picker
            visible={typePickerVisible}
            title="选择活动类型"
            options={typePickerOptions}
            value={form.category ? [form.category] : [TYPE_OPTIONS[0]]}
            onConfirm={handleTypeConfirm}
            onCancel={() => setTypePickerVisible(false)}
            onClose={() => setTypePickerVisible(false)}
          />
        </div>

        {/* 开始时间 - 使用 NutUI DatePicker */}
        <div className="field-section" onClick={() => setStartTimePickerVisible(true)}>
          <div className="field-label">开始时间</div>
          <div className={`field-picker-display ${!form.startTime ? 'placeholder' : ''}`}>
            {form.startTime ? formatDateTime(form.startTime) : '选择开始时间'}
          </div>
          <DatePicker
            visible={startTimePickerVisible}
            title="选择开始时间"
            type="datetime"
            value={parseDate(form.startTime) || undefined}
            startDate={minDate}
            endDate={maxDate}
            onConfirm={handleStartTimeConfirm}
            onCancel={() => setStartTimePickerVisible(false)}
            onClose={() => setStartTimePickerVisible(false)}
          />
        </div>

        {/* 结束时间 - 使用 NutUI DatePicker */}
        <div className="field-section" onClick={() => setEndTimePickerVisible(true)}>
          <div className="field-label">结束时间</div>
          <div className={`field-picker-display ${!form.endTime ? 'placeholder' : ''}`}>
            {form.endTime ? formatDateTime(form.endTime) : '选择结束时间'}
          </div>
          <DatePicker
            visible={endTimePickerVisible}
            title="选择结束时间"
            type="datetime"
            value={parseDate(form.endTime) || undefined}
            startDate={minDate}
            endDate={maxDate}
            onConfirm={handleEndTimeConfirm}
            onCancel={() => setEndTimePickerVisible(false)}
            onClose={() => setEndTimePickerVisible(false)}
          />
        </div>

        {/* 地点 */}
        <div className="field-section">
          <div className="field-label">地点</div>
          <Input
            className="field-input"
            type="text"
            placeholder="活动集合地点"
            value={form.address}
            maxLength={100}
            onChange={(v) => updateField('address', v)}
          />
        </div>

        {/* 费用 */}
        <div className="field-section">
          <div className="field-label">费用（元）</div>
          <Input
            className="field-input"
            type="number"
            placeholder="例如：免费/200/人"
            value={form.price}
            onChange={(v) => updateField('price', v)}
          />
        </div>

        {/* 人数上限 */}
        <div className="field-section">
          <div className="field-label">人数上限</div>
          <Input
            className="field-input"
            type="digit"
            placeholder="例如：20"
            value={form.maxPeople}
            onChange={(v) => updateField('maxPeople', v)}
          />
        </div>

        {/* 难度 - 使用 NutUI Picker */}
        <div className="field-section" onClick={() => setDifficultyPickerVisible(true)}>
          <div className="field-label">难度</div>
          <div className={`field-picker-display ${!form.difficulty ? 'placeholder' : ''}`}>
            {form.difficulty || '选择难度等级'}
          </div>
          <Picker
            visible={difficultyPickerVisible}
            title="选择难度等级"
            options={difficultyPickerOptions}
            value={form.difficulty ? [form.difficulty] : [String(difficultyPickerOptions[0][0].value)]}
            onConfirm={handleDifficultyConfirm}
            onCancel={() => setDifficultyPickerVisible(false)}
            onClose={() => setDifficultyPickerVisible(false)}
          />
        </div>

        {/* 活动介绍（所见即所得富文本） */}
        <div className="field-section column activity-section">
          <div className="field-label activity-title">
            活动介绍
          </div>
          <RichEditor
            value={form.activityContent}
            onChange={(v) => updateField('activityContent', v)}
            maxLength={2000}
            minHeight="400px"
          />
        </div>
         {/* 底部固定提交按钮 */}
      <div className="submit-bar">
        <Button
          type="primary"
          block
          loading={submitting}
          disabled={submitting || imageStatus === 'loading' || qrUploading}
          onClick={handleSubmit}
        >
          {submitting ? '发布中...' : '发布活动'}
        </Button>
      </div>
      </div>

     
    </div>
  )
}

export default PublishActivity
