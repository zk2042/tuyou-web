//+ 活动报名人列表弹窗组件
//+ 场景：领队在自己发布的活动详情页点击"已报名 X 人"入口查看报名人列表
//+ 数据来源：活动详情接口返回的 participants[] 字段（仅领队视角含 phone 明文）
//+ 列表项点击 → onUserClick(userId) 回调（调用方可弹出 UserCardModal 或跳转用户详情页）
//+ 复用 Avatar 组件，确保头像展示风格全局一致
import { Popup, Avatar, Ellipsis } from '@nutui/nutui-react'
import { Close } from '@nutui/icons-react'
import type { Participant } from '@/types'
import './index.less'

interface ParticipantsModalProps {
  //+ 是否显示
  visible: boolean
  //+ 报名人列表（来自活动详情的 participants 字段）
  participants: Participant[]
  //+ 活动最大人数，用于标题显示（如 "报名人 (5/20)"）
  maxPeople?: number
  //+ 关闭回调
  onClose: () => void
  //+ 点击用户项回调（userId）
  onUserClick?: (userId: string) => void
}

const ParticipantsModal = ({
  visible,
  participants,
  maxPeople,
  onClose,
  onUserClick,
}: ParticipantsModalProps) => {
  //+ 标题：报名人 (current/max)，无 max 时不显示分母
  const renderTitle = () => {
    const cur = participants.length
    if (maxPeople && maxPeople > 0) {
      return `报名人 (${cur}/${maxPeople})`
    }
    return `报名人 (${cur})`
  }

  return (
    <Popup
      visible={visible}
      onClose={onClose}
      position='bottom'
      closeable
      closeIcon={<Close className='participants-close' />}
      closeIconPosition='top-right'
      duration={200}
      round
    >
      <div className='participants-modal'>
        {/* 标题 */}
        <div className='participants-title'>{renderTitle()}</div>

        {/* 报名人列表 */}
        {participants.length === 0 ? (
          <div className='participants-empty'>暂无报名人</div>
        ) : (
          <div className='participants-list'>
            {participants.map(p => (
              <div
                key={p.id}
                className='participant-item'
                onClick={() => onUserClick?.(p.id)}
              >
                <Avatar src={p.avatar} fit='cover' size='40' />
                <div className='participant-info'>
                  <Ellipsis className='participant-name' content={p.nickname} rows={1} />
                  {p.phone && <div className='participant-phone'>{p.phone}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Popup>
  )
}

export default ParticipantsModal
