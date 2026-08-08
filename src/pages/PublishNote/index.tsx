//+ 发布笔记页
//+ 笔记字段：媒体类型切换（图片1-5张 / 视频1个）+ 标题 + 分类 + 标签 + 正文内容
//+ 标签使用习惯：NutUI 组件（Input/Picker/TextArea/Button/Tag）+ 原生 HTML（div/img/span）
import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import Taro, { useDidShow } from '@tarojs/taro'
import { Video } from '@tarojs/components'
import { Button, TextArea, Input, Picker, Tabs } from '@nutui/nutui-react'
import { IconFont } from '@nutui/icons-react'
import HeaderNavBar from '@/components/HeaderNavBar'
import { createNoteAPI } from '@/apis/note'
import { uploadImageAPI, uploadVideoAPI } from '@/apis/upload'
import { fetchTags } from '@/store/modules/tag'
import { CATEGORY_MAP } from '@/types'
import type { RootState, AppDispatch } from '@/store'
import './index.less'

//+ 最大图片数量
const MAX_IMAGES = 5
//+ 最大标签数量（1-3个）
const MAX_TAGS = 3
//+ 标题/内容长度限制
const MAX_TITLE = 50
const MAX_CONTENT = 2000

//+ 媒体类型：图片 或 视频（互斥）
type MediaType = 'image' | 'video'

//+ 分类选项（从 CATEGORY_MAP 生成，value 为数字 ID 的字符串形式供 Picker 使用）
const CATEGORY_OPTIONS = [
  Object.entries(CATEGORY_MAP).map(([id, name]) => ({ label: name, value: id }))
]

//+ 表单字段类型
interface FormState {
  title: string
  category: number
  tags: string[]
  images: string[]
  videoUrl: string
  noteContent: string
}

const initialForm: FormState = {
  title: '',
  category: 0,
  tags: [],
  images: [],
  videoUrl: '',
  noteContent: ''
}

const PublishNote = () => {
  const dispatch: AppDispatch = useDispatch()
  //+ 从 tag store 获取标签列表（替代原硬编码 ALL_TAGS）
  const { tags: tagList, loading: tagLoading } = useSelector((state: RootState) => state.tag)
  //+ 标签选项：将 Tag[] 转为字符串数组供渲染与选中
  const tagOptions = tagList.map(t => t.tagName)

  //+ 页面显示时加载标签（已加载则不重复请求）
  useDidShow(() => {
    if (!tagList.length && !tagLoading) {
      dispatch(fetchTags())
    }
  })

  const [form, setForm] = useState<FormState>(initialForm)
  //+ 提交中 Loading 状态（防重复提交）
  const [submitting, setSubmitting] = useState(false)
  //+ 图片上传中状态
  const [uploading, setUploading] = useState(false)
  //+ 视频上传中状态
  const [videoUploading, setVideoUploading] = useState(false)
  //+ 分类 Picker 弹窗可见性
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false)
  //+ 媒体类型（图片/视频互斥），默认图片
  const [mediaType, setMediaType] = useState<MediaType>('image')

  //+ 通用字段更新（泛型，支持 string/number/string[] 等类型）
  const updateField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  //+ 多图上传：选择图片 → 逐个上传 → 收集 URL
  const handleUploadImages = async () => {
    const remaining = MAX_IMAGES - form.images.length
    if (remaining <= 0) {
      Taro.showToast({ title: `最多上传${MAX_IMAGES}张图片`, icon: 'none' })
      return
    }

    try {
      const chooseRes = await Taro.chooseImage({ count: remaining, sizeType: ['compressed'] })
      const filePaths = chooseRes.tempFilePaths

      setUploading(true)
      const newUrls: string[] = []
      for (const filePath of filePaths) {
        const res = await uploadImageAPI(filePath, 'note')
        if (res.code === 0 || res.code === 200) {
          newUrls.push(res.data.url)
        }
      }

      if (newUrls.length > 0) {
        updateField('images', [...form.images, ...newUrls])
      }
      if (newUrls.length < filePaths.length) {
        Taro.showToast({ title: `${filePaths.length - newUrls.length}张上传失败`, icon: 'none' })
      }
    } catch (err) {
      console.warn('[PublishNote] 图片上传失败:', err)
      Taro.showToast({ title: '图片上传失败', icon: 'none' })
    } finally {
      setUploading(false)
    }
  }

  //+ 删除单张图片
  const handleRemoveImage = (index: number) => {
    updateField('images', form.images.filter((_, i) => i !== index))
  }

  //+ 媒体类型切换：清空对方媒体内容（图片↔视频互斥）
  const [activeTab, setActiveTab] = useState('image')
  
  // const handleSwitchMediaType = (type: MediaType) => {
  //   if (type === mediaType) return
  //   setMediaType(type)
  //   if (type === 'image') {
  //     updateField('videoUrl', '')
  //   } else {
  //     updateField('images', [])
  //   }
  // }

  //+ 视频上传：选择1个视频 → 上传 → 填充 videoUrl
  const handleUploadVideo = async () => {
    if (form.videoUrl) {
      Taro.showToast({ title: '最多上传1个视频', icon: 'none' })
      return
    }
    try {
      const chooseRes = await Taro.chooseVideo({
        sourceType: ['album', 'camera'],
        maxDuration: 60,
        compressed: true
      })
      const filePath = chooseRes.tempFilePath

      setVideoUploading(true)
      const res = await uploadVideoAPI(filePath, 'note')
      if (res.code === 0 || res.code === 200) {
        updateField('videoUrl', res.data.url)
      } else {
        Taro.showToast({ title: '视频上传失败', icon: 'none' })
      }
    } catch (err) {
      console.warn('[PublishNote] 视频上传失败:', err)
      Taro.showToast({ title: '视频上传失败', icon: 'none' })
    } finally {
      setVideoUploading(false)
    }
  }

  //+ 删除视频
  const handleRemoveVideo = () => {
    updateField('videoUrl', '')
  }

  //+ 分类 Picker 确认
  const handleCategoryConfirm = (_options: any, value: any[]) => {
    updateField('category', Number(value[0]))
    setCategoryPickerVisible(false)
  }

  //+ 点击标签切换选中状态（最多 MAX_TAGS 个）
  const handleTagToggle = (tag: string) => {
    if (form.tags.includes(tag)) {
      //+ 已选中 → 取消
      updateField('tags', form.tags.filter(t => t !== tag))
    } else {
      //+ 未选中 → 添加（超过上限提示）
      if (form.tags.length >= MAX_TAGS) {
        Taro.showToast({ title: `最多选择${MAX_TAGS}个标签`, icon: 'none' })
        return
      }
      updateField('tags', [...form.tags, tag])
    }
  }

  //+ 表单校验
  const validateForm = (): boolean => {
    if (!form.title.trim() || form.title.length > MAX_TITLE) {
      Taro.showToast({ title: `请输入标题（1-${MAX_TITLE}字）`, icon: 'none' })
      return false
    }
    if (!form.category) {
      Taro.showToast({ title: '请选择分类', icon: 'none' })
      return false
    }
    //+ 媒体内容校验：图片模式需1-5张，视频模式需1个
    if (mediaType === 'image') {
      if (form.images.length < 1) {
        Taro.showToast({ title: '请至少上传1张图片', icon: 'none' })
        return false
      }
    } else {
      if (!form.videoUrl) {
        Taro.showToast({ title: '请上传1个视频', icon: 'none' })
        return false
      }
    }
    if (form.noteContent.length > MAX_CONTENT) {
      Taro.showToast({ title: `内容不能超过${MAX_CONTENT}字`, icon: 'none' })
      return false
    }
    if (!form.noteContent.trim()) {
      Taro.showToast({ title: '请输入笔记内容', icon: 'none' })
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
      const res = await createNoteAPI({
        title: form.title.trim(),
        content: form.noteContent,
        images: form.images||[],
        videoUrl: form.videoUrl || "",
        category: form.category,
        tags: form.tags
      })

      if (res.code === 0 || res.code === 200) {
        Taro.showToast({ title: '发布成功', icon: 'success' })
        setTimeout(() => {
          //+ 三级降级返回：优先 navigateBack，其次 window.history.back()，最后 redirectTo 首页
          const pages = Taro.getCurrentPages()
          if (pages.length > 1) {
            Taro.navigateBack({ delta: 1 }).catch(() => {
              if (typeof window !== 'undefined' && window.history.length > 1) {
                window.history.back()
              } else {
                Taro.redirectTo({ url: '/pages/Home/index' })
              }
            })
          } else {
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
    <div className="publish-note-page">
      <HeaderNavBar title="发布笔记" backPageNum={1} fixed={false} cancel={true} />

      <div className="form-wrapper">
        {/* 媒体类型切换：图片 / 视频（互斥） */}
        {/* <div className="media-type-switch">
          <div
            className={`media-type-tab ${mediaType === 'image' ? 'active' : ''}`}
            onClick={() => handleSwitchMediaType('image')}
          >
            图片
          </div>
          <div
            className={`media-type-tab ${mediaType === 'video' ? 'active' : ''}`}
            onClick={() => handleSwitchMediaType('video')}
          >
            视频
          </div>
        </div> */}
        <Tabs
                  value={activeTab}
                  onChange={(v) => {
                                      
                      if (v === mediaType) return
                      setMediaType(v as MediaType)
                      if (v === 'image') {
                        updateField('videoUrl', '')
                      } else {
                        updateField('images', [])
                      }
  
                    setActiveTab(v as string)
               
                     }}
                  activeColor="#428a46"
                  className="media-type-switch"
                >
                  <Tabs.TabPane title="图片" value={'image'} />
                  <Tabs.TabPane title="视频" value={'video'} />
                </Tabs>

        {/* 图片上传区（图片模式） */}
        {mediaType === 'image' && (
          <div className="images-section">
            <div className="section-label">
              添加图片（{form.images.length}/{MAX_IMAGES}）
            </div>
            <div className="image-grid">
              {form.images.map((url, index) => (
                <div key={index} className="image-item">
                  <img src={url} alt={`图片${index + 1}`} />
                  <div className="image-remove" onClick={() => handleRemoveImage(index)}>×</div>
                </div>
              ))}
              {form.images.length < MAX_IMAGES && (
                <div className="image-add" onClick={handleUploadImages}>
                  {uploading ? (
                    <span className="uploading-text">上传中...</span>
                  ) : (
                    <IconFont name="xiangji" fontClassName="iconfont" classPrefix="icon" />
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 视频上传区（视频模式，限1个） */}
        {mediaType === 'video' && (
          <div className="video-section">
            <div className="section-label">
              添加视频（{form.videoUrl ? 1 : 0}/1）
            </div>
            <div className="video-grid">
              {form.videoUrl ? (
                <div className="video-item">
                  <Video src={form.videoUrl} className="video-preview" controls muted />
                  <div className="image-remove" onClick={handleRemoveVideo}>×</div>
                </div>
              ) : (
                <div className="video-add" onClick={handleUploadVideo}>
                  {videoUploading ? (
                    <span className="uploading-text">上传中...</span>
                  ) : (
                    <IconFont name="xiangji" fontClassName="iconfont" classPrefix="icon" />
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 标题 */}
        <div className="field-section">
          <div className="field-label">标题</div>
          <Input
            className="field-input"
            type="text"
            placeholder="给你的笔记起个名字"
            value={form.title}
            maxLength={MAX_TITLE}
            onChange={(v) => updateField('title', v)}
          />
          <span className="field-count">{form.title.length}/{MAX_TITLE}</span>
        </div>

        {/* 分类 - 使用 NutUI Picker */}
        <div className="field-section" onClick={() => setCategoryPickerVisible(true)}>
          <div className="field-label">分类</div>
          <div className={`field-picker-display ${!form.category ? 'placeholder' : ''}`}>
            {form.category ? CATEGORY_MAP[form.category] : '选择分类'}
          </div>
          <Picker
            visible={categoryPickerVisible}
            title="选择分类"
            options={CATEGORY_OPTIONS}
            value={form.category ? [String(form.category)] : []}
            onConfirm={handleCategoryConfirm}
            onCancel={() => setCategoryPickerVisible(false)}
            onClose={() => setCategoryPickerVisible(false)}
          />
        </div>

        

        {/* 笔记内容 */}
        <div className="field-section content column">
          <div className="field-label">
            笔记内容
            <span className="field-count">{form.noteContent.length}/{MAX_CONTENT}</span>
          </div>
          <TextArea
            className="field-textarea"
            placeholder="分享你的户外经历、攻略心得..."
            value={form.noteContent}
            onChange={(v) => updateField('noteContent', v)}
            maxLength={MAX_CONTENT}
            rows={6}
            showCount={false}
          />
        </div>

        {/* 标签 - 与分类无关，始终展示所有可选标签，点击切换选中 */}
        <div className="field-section column">
          <div className="section-label">
            添加标签（{form.tags.length}/{MAX_TAGS}）
          </div>
          <div className="tag-list">
            {tagLoading && tagOptions.length === 0 ? (
              <span className="tag-loading">加载标签中...</span>
            ) : tagOptions.map(tag => (
              <span
                key={tag}
                className={`tag ${form.tags.includes(tag) ? 'tag-active' : ''}`}
                onClick={() => handleTagToggle(tag)}
              >
                <span className="tag-icon">#</span>{tag}
              </span>
            ))}
          </div>
        </div>

           {/* 底部固定提交按钮 */}
      <div className="submit-bar">
        <Button
          type="primary"
          block
          loading={submitting}
          disabled={submitting}
          onClick={handleSubmit}
        >
          {submitting ? '发布中...' : '发布笔记'}
        </Button>
      </div>
      </div>

     
    </div>
  )
}

export default PublishNote
