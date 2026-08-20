//+ 发布笔记页
//+ 笔记字段：媒体类型切换（图片1-5张 / 视频1个）+ 标题 + 分类 + 标签 + 正文内容
//+ 模块化链路：页面 → dispatch(uploadXxx thunk) → upload store → apis/upload.ts → request.ts
//+ 标签使用习惯：NutUI 组件（Input/Picker/TextArea/Button/Tag）+ 原生 HTML（div/img/span）
import { useState, useEffect, useRef } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import Taro, { useDidShow, useDidHide } from '@tarojs/taro'
import { Video } from '@tarojs/components'
import { Button, TextArea, Input, Picker, Tabs } from '@nutui/nutui-react'
import { IconFont } from '@nutui/icons-react'
import HeaderNavBar from '@/components/HeaderNavBar'
import RichEditor from '@/components/RichEditor'
import { htmlToText, isHtmlEmpty } from '@/utils/html'
import { createNoteAPI } from '@/apis/note'
import { fetchTags } from '@/store/modules/tag'
import {
  uploadImages,
  uploadVideo,
  resetImages as resetUploadImages,
  resetVideo as resetUploadVideo,
  resetUpload,
  clearUploadError
} from '@/store/modules/upload'
import { CATEGORY_MAP } from '@/types'
import type { RootState, AppDispatch } from '@/store'
import { useAuthGuard } from '@/components/AuthRoute'
import './index.less'

//+ 最大图片数量
const MAX_IMAGES = 5
//+ 最大标签数量（1-3个）
const MIN_TAGS = 1
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
  useAuthGuard()
  const dispatch: AppDispatch = useDispatch()
  //+ 从 tag store 获取标签列表（替代原硬编码 ALL_TAGS）
  const { tags: tagList, loading: tagLoading } = useSelector((state: RootState) => state.tag)
  //+ 从 upload store 读取上传结果和状态
  const uploadState = useSelector((state: RootState) => state.upload)
  //+ 标签选项：将 Tag[] 转为字符串数组供渲染与选中
  const tagOptions = tagList.map(t => t.tagName)

  //+ 页面显示时加载标签（已加载则不重复请求）
  useDidShow(() => {
    if (!tagList.length && !tagLoading) {
      dispatch(fetchTags())
    }
  })

  //+ 离开页面时清空上传模块缓存，防止下次进入误读上次结果
  useDidHide(() => {
    dispatch(resetUpload())
  })

  const [form, setForm] = useState<FormState>(initialForm)
  //+ 提交中 Loading 状态（防重复提交）
  const [submitting, setSubmitting] = useState(false)
  //+ 分类 Picker 弹窗可见性
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false)
  //+ 媒体类型（图片/视频互斥），默认图片
  const [mediaType, setMediaType] = useState<MediaType>('image')
  const [activeTab, setActiveTab] = useState('image')
  //+ 视频封面 URL（后端返回的 OSS 截帧地址，提交时塞入 images[0]）
  const [videoCoverUrl, setVideoCoverUrl] = useState<string>('')

  //+ 记录选择了多少张文件（用于失败时 toast 提示失败几张）
  const lastImageChooseCountRef = useRef<number>(0)

  //+ 通用字段更新（泛型，支持 string/number/string[] 等类型）
  const updateField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  //+ 批量图片上传成功 → 合并到 form.images
  useEffect(() => {
    if (uploadState.imagesStatus === 'success' && uploadState.lastImageUrls.length > 0) {
      let newImages = [...form.images, ...uploadState.lastImageUrls]
      if(newImages.length>MAX_IMAGES){
        Taro.showToast({ title: `最多上传${MAX_IMAGES}张图片`, icon: 'none' })
        newImages=newImages.slice(0,MAX_IMAGES)
      }
      updateField('images', newImages)
      const failCount = lastImageChooseCountRef.current - uploadState.lastImageUrls.length
      if (failCount > 0) {
        Taro.showToast({ title: `${failCount}张上传失败`, icon: 'none' })
      }
      lastImageChooseCountRef.current = 0
      dispatch(resetUploadImages())
    } else if (uploadState.imagesStatus === 'error' && uploadState.error) {
      Taro.showToast({ title: uploadState.error, icon: 'none' })
      lastImageChooseCountRef.current = 0
      dispatch(clearUploadError())
    }
  }, [uploadState.imagesStatus, uploadState.lastImageUrls, uploadState.error])

  //+ 视频上传成功 → 写入 form.videoUrl + videoCoverUrl
  useEffect(() => {
    if (uploadState.videoStatus === 'success' && uploadState.lastVideoUrl) {
      updateField('videoUrl', uploadState.lastVideoUrl)
      setVideoCoverUrl(uploadState.lastVideoCoverUrl || '')
      dispatch(resetUploadVideo())
    } else if (uploadState.videoStatus === 'error' && uploadState.error) {
      Taro.showToast({ title: uploadState.error, icon: 'none' })
      dispatch(clearUploadError())
    }
  }, [uploadState.videoStatus, uploadState.lastVideoUrl, uploadState.lastVideoCoverUrl, uploadState.error])

  //+ 多图上传：选择图片 → dispatch(uploadImages) → store 完成后 useEffect 合并
  const handleUploadImages = async () => {
    const remaining = MAX_IMAGES - form.images.length
    if (remaining <= 0) {
      Taro.showToast({ title: `最多上传${MAX_IMAGES}张图片`, icon: 'none' })
      return
    }
    if (uploadState.imagesStatus === 'loading') return

    try {
      const chooseRes = await Taro.chooseImage({ count: remaining, sizeType: ['compressed'] })
      const filePaths = chooseRes.tempFilePaths
      lastImageChooseCountRef.current = filePaths.length
      dispatch(uploadImages({ filePaths, type: 'note', maxCount: MAX_IMAGES }))
    } catch (err) {
      console.warn('[PublishNote] 选择图片失败:', err)
    }
  }

  //+ 删除单张图片
  const handleRemoveImage = (index: number) => {
    updateField('images', form.images.filter((_, i) => i !== index))
  }

  //+ 视频上传：选择1个视频 → dispatch(uploadVideo) → useEffect 写入
  const handleUploadVideo = async () => {
    if (form.videoUrl) {
      Taro.showToast({ title: '最多上传1个视频', icon: 'none' })
      return
    }
    if (uploadState.videoStatus === 'loading') return

    try {
      const chooseRes = await Taro.chooseVideo({
        sourceType: ['album', 'camera'],
        maxDuration: 60,
        compressed: true
      })
      dispatch(uploadVideo({ filePath: chooseRes.tempFilePath, type: 'note' }))
    } catch (err) {
      console.warn('[PublishNote] 选择视频失败:', err)
    }
  }

  //+ 删除视频（同时清封面）
  const handleRemoveVideo = () => {
    updateField('videoUrl', '')
    setVideoCoverUrl('')
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
    //+ 媒体内容校验：图片模式需1-5张，视频模式需1个；上传中不可提交
    if (uploadState.imagesStatus === 'loading' || uploadState.videoStatus === 'loading') {
      Taro.showToast({ title: '媒体上传中，请稍候', icon: 'none' })
      return false
    }
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
    if (htmlToText(form.noteContent).length > MAX_CONTENT) {
      Taro.showToast({ title: `内容不能超过${MAX_CONTENT}字`, icon: 'none' })
      return false
    }
    if (isHtmlEmpty(form.noteContent)) {
      Taro.showToast({ title: '请输入笔记内容', icon: 'none' })
      return false
    }
    if(form.tags.length < MIN_TAGS) {
      Taro.showToast({ title: `请至少选择${MIN_TAGS}个标签`, icon: 'none' })
      return false
    }
    if(form.tags.length > MAX_TAGS) {
      Taro.showToast({ title: `最多选择${MAX_TAGS}个标签`, icon: 'none' })
      return false
    }
    return true
  }

  //+ 提交发布
  //+ 文档要求：视频模式下把 coverUrl 填入 images[0]，videoUrl 填入 videoUrl；图片模式 images 原样
  const handleSubmit = async () => {
    if (submitting) return
    if (!validateForm()) return

    setSubmitting(true)
    try {
      const submitImages: string[] =
        mediaType === 'video' ? (videoCoverUrl ? [videoCoverUrl] : []) : [...form.images]

      const res = await createNoteAPI({
        title: form.title.trim(),
        content: form.noteContent,
        images: submitImages,
        videoUrl: mediaType === 'video' ? (form.videoUrl || '') : undefined,
        category: form.category,
        tags: form.tags
      })

      if (res.code === 0 || res.code === 200) {
        Taro.showToast({ title: '发布成功', icon: 'success' })
        setTimeout(() => {
          //+ 发布成功后清空上传缓存
          dispatch(resetUpload())
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
        <Tabs
                  value={activeTab}
                  onChange={(v) => {
                    if (v === mediaType) {
                      setActiveTab(v as string)
                      return
                    }
                    setMediaType(v as MediaType)
                    if (v === 'image') {
                      updateField('videoUrl', '')
                      setVideoCoverUrl('')
                      dispatch(resetUploadVideo())
                    } else {
                      updateField('images', [])
                      dispatch(resetUploadImages())
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
                  {uploadState.imagesStatus === 'loading' ? (
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
                  {uploadState.videoStatus === 'loading' ? (
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
            value={form.category ? [String(form.category)] : [String(CATEGORY_OPTIONS[0][0].value)]}
            onConfirm={handleCategoryConfirm}
            onCancel={() => setCategoryPickerVisible(false)}
            onClose={() => setCategoryPickerVisible(false)}
          />
        </div>



        {/* 笔记内容（所见即所得富文本） */}
        <div className="field-section content column note-section">
          <div className="field-label note-title">
            笔记内容
          </div>
          <RichEditor
            value={form.noteContent}
            onChange={(v) => updateField('noteContent', v)}
            maxLength={MAX_CONTENT}
            minHeight="400px"
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
