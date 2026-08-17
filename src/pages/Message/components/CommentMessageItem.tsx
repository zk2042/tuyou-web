//+ 评论消息项组件（互动消息中最复杂的类型）
//+ 布局：头像左侧 → 内容右侧（昵称+图标 / 内容 / [回复列表框] / [回复输入框] / 时间+回复+查看回复）
//+ 删除：外层 SwipeAction 包裹，左滑露出红色删除按钮
//+ 注意：评论消息的回复删除逻辑不在此组件中（由 CommentSection 独立处理）
import { useState, useEffect } from 'react'
import { IconFont } from '@nutui/icons-react'
import { Ellipsis } from '@nutui/nutui-react'
import '@/assets/iconfont.css'
import Avatar from '@/components/Avatar'
import SwipeAction from '@/components/SwipeAction'
import { formatMessageTime } from '@/utils/formatMessageTime'
import type { InteractionMessage } from '@/types/entity'

interface CommentMessageItemProps {
  item: InteractionMessage
  onMarkRead?: (id: string) => void
  onReply?: (messageId: string, replyContent: string) => void
  onDelete?: (id: string) => void
  swipeOpen?: boolean
  onSwipeOpen?: () => void
}

const CommentMessageItem = ({ item, onMarkRead, onReply, onDelete, swipeOpen, onSwipeOpen }: CommentMessageItemProps) => {
  const [contentExpanded, setContentExpanded] = useState(false)
  const [replyInputVisible, setReplyInputVisible] = useState(false)
  const [replyListVisible, setReplyListVisible] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [localReplies, setLocalReplies] = useState(item.replies || [])

  //+ item.replies 变化时（刷新拉到新数据 / store 更新）同步到 localReplies
  //+ useState 只在首次挂载初始化，后续需 useEffect 同步外部更新
  useEffect(() => {
    setLocalReplies(item.replies || [])
  }, [item.replies])

  const mayOverflow = item.content.length > 40
  const replyCount = localReplies.length

  const tryMarkRead = () => {
    if (!item.read) {
      onMarkRead?.(item.id)
    }
  }

  const handleClick = () => {
    tryMarkRead()
  }

  const handleToggleReplyInput = (e: React.MouseEvent) => {
    e.stopPropagation()
    tryMarkRead()
    setReplyInputVisible(!replyInputVisible)
    if (!replyInputVisible) {
      setReplyText('')
    }
  }

  const handleToggleReplyList = (e: React.MouseEvent) => {
    e.stopPropagation()
    tryMarkRead()
    setReplyListVisible(!replyListVisible)
  }

  const handleSendReply = (e: React.MouseEvent) => {
    e.stopPropagation()
    const text = replyText.trim()
    if (!text) return
    tryMarkRead()
    const newReply = { id: `local-${Date.now()}`, sender: 'me' as const, content: text }
    setLocalReplies([...localReplies, newReply])
    setReplyText('')
    setReplyInputVisible(false)
    setReplyListVisible(true)
    onReply?.(item.id, text)
  }

  const handleCancelReply = (e: React.MouseEvent) => {
    e.stopPropagation()
    tryMarkRead()
    setReplyInputVisible(false)
    setReplyText('')
  }

  const handleDelete = () => {
    onDelete?.(item.id)
  }

  return (
    <SwipeAction
      onDelete={handleDelete}
      onSwipeOpen={onSwipeOpen}
      open={swipeOpen}
    >
      <div
        className={`message-item comment-message-item ${!item.read ? 'unread' : ''}`}
        onClick={handleClick}
      >
        <div className='message-item-avatar'>
          <Avatar url={item.member.avatar} size='40' />
        </div>

        <div className='message-item-body'>
          <div className='message-item-nickname-row'>
            <Ellipsis className='message-item-nickname' content={item.member.nickname} rows={1} />
            <IconFont
              name='xiaoxi'
              fontClassName='iconfont'
              classPrefix='icon'
              className='message-item-type-icon'
            />
          </div>

          <div className={`message-item-content ${contentExpanded ? 'expanded' : 'collapsed'}`}>
            {item.content}
          </div>
          {mayOverflow && (
            <span
              className='message-item-expand-btn'
              onClick={(e) => {
                e.stopPropagation()
                tryMarkRead()
                setContentExpanded(!contentExpanded)
              }}
            >
              {contentExpanded ? '收起' : '展开'}
            </span>
          )}

          {replyListVisible && localReplies.length > 0 && (
            <div className='reply-list-box'>
              {localReplies.map((r) => (
                <div key={r.id} className='reply-list-row'>
                  {/*+ sender='me' 显示"我 {content}"，'you' 显示"ta {content}" */}
                  <span className='reply-author'>{r.sender === 'me' ? '我' : 'ta'}</span>
                  <span className='reply-content-text'>{r.content}</span>
                </div>
              ))}
            </div>
          )}

          {replyInputVisible && (
            <div className='reply-input-box'>
              <input
                className='reply-input'
                placeholder='写回复...'
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                onClick={(e) => {
                  e.stopPropagation()
                  tryMarkRead()
                }}
              />
              <span
                className={`reply-send-btn ${!replyText.trim() ? 'disabled' : ''}`}
                onClick={replyText.trim() ? handleSendReply : undefined}
              >
                发送
              </span>
              <span
                className='reply-cancel-btn'
                onClick={handleCancelReply}
              >
                取消
              </span>
            </div>
          )}

          <div className='message-item-time-row'>
            <span className='message-item-time'>{formatMessageTime(item.createdAt)}</span>
            <span
              className='message-item-action-btn action-green'
              onClick={handleToggleReplyInput}
            >
              回复
            </span>
            {replyCount > 0 && (
              <span
                className='message-item-action-btn'
                onClick={handleToggleReplyList}
              >
                {replyListVisible ? '收起回复' : `查看回复(${replyCount})`}
              </span>
            )}
          </div>
        </div>

        {!item.read && <span className='message-item-unread-dot' />}
      </div>
    </SwipeAction>
  )
}

export default CommentMessageItem
