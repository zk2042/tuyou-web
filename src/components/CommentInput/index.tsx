import { Popup, Cell, Toast, Button, Form, TextArea } from '@nutui/nutui-react'
import { useState, useRef, useEffect } from 'react'
import { IconFont, Close } from '@nutui/icons-react'
import '@/assets/iconfont.css'
import './index.less'

// ==================== 对外 Props 接口 ====================

//+ 底部互动栏：点赞/收藏/转发，原有字段保持不变
interface CommentInputActionProps {
  /** 点赞状态 */
  isLiked?: boolean
  /** 点赞数 */
  likeCount?: number
  /** 收藏状态 */
  isFavorited?: boolean
  /** 收藏数（后端未返回则不传） */
  favoriteCount?: number
  /** 点击点赞 */
  onToggleLike?: (nextIsLiked: boolean) => void
  /** 点击收藏 */
  onToggleFavorite?: (nextIsFavorited: boolean) => void
}

//+ 回复目标：当从评论列表点"回复"时，父组件（NoteDetail / GuideDetail）传入此对象
//+ 组件会自动打开 Popup，标题显示"回复 @XXX"，placeholder 也会变化
export interface CommentInputReplyTarget {
  /** 一级评论 ID（回复二级时也传对应的一级 ID，便于后端挂两级） */
  parentCommentId: string | null
  /** 被回复者评论 ID（一级评论时=parentCommentId，二级时=二级评论 ID） */
  replyToId: string | null
  /** 被回复者昵称，用于显示"回复 @XXX" */
  replyToName: string | null
}

//+ 发送评论 payload，父组件 onSend 会收到它
export interface CommentInputSendPayload {
  content: string
  parentCommentId: string | null
  replyToId: string | null
  replyToName: string | null
}

export interface CommentInputProps {
  detail?: any
  actions?: CommentInputActionProps
  /** 回复目标：传入时打开 Popup 进入"回复模式"；传 null 时关闭回复模式并回到一级评论模式 */
  replyTarget?: CommentInputReplyTarget | null
  /** 回复模式下点击关闭或取消时触发；父组件应在这里把 replyTarget 置回 null */
  onCancelReply?: () => void
  /** 发送评论回调：一级评论 parentCommentId 为 null；回复某条评论时包含 payload.replyToId / replyToName */
  onSendComment?: (payload: CommentInputSendPayload) => PromiseLike<void> | void
}

const CommentInput: React.FC<CommentInputProps> = ({
  actions,
  replyTarget,
  onCancelReply,
  onSendComment,
}) => {
  const {
    isLiked = false,
    likeCount = 0,
    isFavorited = false,
    onToggleLike,
    onToggleFavorite,
  } = actions || {}

  // ---------- 状态 ----------
  //+ Popup 显示：点击底部输入框（一级评论） 或 父组件传入 replyTarget（回复模式）时为 true
  const [visible, setVisible] = useState<boolean>(false)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [textareaValue, setTextareaValue] = useState<string>('')

  // ---------- 派生 ----------
  //+ 是否处于"回复模式"：replyTarget 有值时
  const isReplyMode = !!replyTarget
  const placeholder = isReplyMode ? `回复 @${replyTarget?.replyToName || ''}...` : '写评论...'

  // ---------- 副作用：replyTarget 变化时控制 Popup ----------
  useEffect(() => {
    if (replyTarget) {
      //+ 父组件切到回复模式 → 自动打开弹层，清空上次内容
      setTextareaValue('')
      setVisible(true)
    }
    // replyTarget=null 不强制关闭弹层，保持一级评论弹层可继续使用
  }, [replyTarget])

  // ---------- 副作用：Popup 打开时强制清空输入框 ----------
  //+ 修复：评论成功后再次打开输入框，TextArea 内部状态可能未随 value 同步重置
  useEffect(() => {
    if (visible) {
      setTextareaValue('')
    }
  }, [visible])

  // ---------- 交互：关闭弹层 ----------
  const handleClose = () => {
    setVisible(false)
    setTextareaValue('')
    //+ 回复模式被关闭时，通知父组件把 replyTarget 还原为 null
    if (isReplyMode) {
      onCancelReply?.()
    }
  }

  // ---------- 交互：发送 ----------
  const handleSend = async () => {
    const content = textareaValue.trim()
    if (!content) return
    try {
      await onSendComment?.({
        content,
        parentCommentId: replyTarget?.parentCommentId ?? null,
        replyToId: replyTarget?.replyToId ?? null,
        replyToName: replyTarget?.replyToName ?? null,
      })
    } catch (e: any) {
      //+ 失败时父组件处理回滚，这里仅保留已输入内容方便重发
      //+ code=2001 后端违禁词，单独提示；其他保持"评论失败"
      const code = e?.code
      if (code === 2001) {
        Toast.show({ content: e?.message || '内容包含违规词汇', duration: 1 })
      } else {
        Toast.show({ content: '评论失败', duration: 1 })
      }
      return
    }
    //+ 成功后才提示，避免 API 失败时误导用户
    Toast.show({ content: '评论已发送', duration: 1 })
    setTextareaValue('')
    setVisible(false)
    //+ 发送成功，还原回复模式
    if (isReplyMode) {
      onCancelReply?.()
    }
  }

  // ---------- 交互：点赞/收藏/转发 ----------
  const handleIconClick = (e: any, action: string) => {
    e.stopPropagation()
    switch (action) {
      case 'like':
        onToggleLike?.(!isLiked)
        break
      case 'favorite':
        onToggleFavorite?.(!isFavorited)
        break
      case 'share':
        Toast.show({ content: '禁止转发', duration: 1 })
        break
    }
  }

  return (
    <div className='comment-input-container'>

      <Cell title='评论内容' onClick={() => setVisible(true)} className='comment-input-cell'>
        {/* 无效输入框 */}
        <input placeholder='写评论...' className='comment-input' readOnly />
        {/* 点赞 */}
        <IconFont name={isLiked ? 'likefill' : 'like'} fontClassName='iconfont' classPrefix='icon' className={isLiked ? 'like-active' : ''} onClick={(e) => handleIconClick(e, 'like')}><span className='like-count'>{likeCount}</span></IconFont>
        {/* 收藏 */}
        <IconFont name={isFavorited ? 'shoucangfill' : 'shoucang'} fontClassName='iconfont' classPrefix='icon' className={isFavorited ? 'favorite-active' : ''} onClick={(e) => handleIconClick(e, 'favorite')} />
        {/* 转发 */}
        <IconFont name='zhuanfa' fontClassName='iconfont' classPrefix='icon' onClick={(e) => handleIconClick(e, 'share')} />
      </Cell>

      <Popup
        visible={visible}
        onClose={handleClose}
        duration={200}
        closeIcon={<Close className='close-icon' />}
        position='bottom'
        closeable={isReplyMode}
        closeIconPosition='top-right'
        title={isReplyMode &&(<div className='reply-to-name'><div className='reply'>回复</div><div className='name'>@{replyTarget?.replyToName || ''}</div></div>  )}
      >
        {/* key 强制重建 TextArea：每次 Popup 打开时用新 key 重新挂载，确保清空 NutUI 内部缓存 */}
        <Form key={visible ? 'open' : 'closed'}>
          <Form.Item name='content' className='form-item'>
            <TextArea
              maxLength={3000}
              rows={1}
              autoSize
              ref={textareaRef}
              placeholder={placeholder}
              onChange={(val) => setTextareaValue(val as string)}
              value={textareaValue}
            />
          </Form.Item>
          <Form.Item className='form-item'>
            <Button
              className={textareaValue.trim() ? 'btn-active' : ''}
              disabled={!textareaValue.trim()}
              onClick={handleSend}
            >
              发送
            </Button>
          </Form.Item>
        </Form>
      </Popup>

    </div>
  )
}

export default CommentInput
