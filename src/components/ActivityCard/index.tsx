//+ 活动卡片组件（列表页 / 我的活动页复用）
//+ 布局：上=封面图(左)+标题/时间/地点(右)；下=进度条+人数/价格+领队/报名按钮
//+ 复用封装的 Avatar 组件展示领队头像；报名按钮直接用 NutUI Button
import { Button } from '@nutui/nutui-react'
import Avatar from '@/components/Avatar'
import type { ActivityListItem } from '@/types'
import './index.less'

interface ActivityCardProps {
  //+ 活动数据
  activity: ActivityListItem
  //+ 点击卡片回调（跳转详情）
  onClick?: (activity: ActivityListItem) => void
  //+ 点击报名回调（本期仅 UI 占位）
  onSignup?: (activity: ActivityListItem) => void
}

//+ 状态标签颜色映射
const STATUS_COLOR: Record<string, string> = {
  报名中: '#2e7d32',
  进行中: '#fa8c16',
  已结束: '#999',
}

const ActivityCard = ({ activity, onClick, onSignup }: ActivityCardProps) => {
  const {
    coverImg,
    title,
    startTime,
    address,
    leader,
    currentPeople,
    maxPeople,
    price,
    activityStatus,
  } = activity

  //+ 报名进度百分比（兜底除零）
  const percent = maxPeople > 0 ? Math.min(100, (currentPeople / maxPeople) * 100) : 0
  //+ 报名按钮禁用：已结束或已满员且未报名
  const signupDisabled = activityStatus === '已结束' || (currentPeople >= maxPeople && !activity.joined)

  //+ 点击报名（阻止冒泡，不触发卡片跳转）
  const handleSignup = (e: any) => {
    e?.stopPropagation?.()
    onSignup?.(activity)
  }

  //+ 点击卡片
  const handleClick = () => onClick?.(activity)

  return (
    <div className="activity-card" onClick={handleClick}>
      {/* 上：封面图 + 标题/时间/地点 */}
      <div className="card-top">
        <div className="card-cover">
          <img src={coverImg} alt={title} />
          {/* 状态标签 */}
          <span
            className="card-status"
            style={{ color: STATUS_COLOR[activityStatus] || '#999' }}
          >
            {activityStatus}
          </span>
        </div>
        <div className="card-info">
          <div className="card-title">{title}</div>
          <div className="card-metas">
            <div className="card-meta">📅 {startTime}</div>
            <div className="card-meta">📍 {address}</div>
          </div>
          
        </div>
      </div>

      {/* 下：进度条 + 人数/价格 + 领队/报名 */}
      <div className="card-bottom">
         {/* 进度条上方元信息：已报人数 / 价格 */}
        <div className="progress-meta">
          <span className="meta-people">已报 {currentPeople}/{maxPeople}人</span>
          <span className="meta-price">{price === 0 ? '免费' : `${price}元/人`}</span>
        </div>
        {/* 进度条 */}
        <div className="progress-bar">
          <div className="progress-inner" style={{ width: `${percent}%` }} />
        </div>
       
        {/* 领队 + 报名按钮 */}
        <div className="progress-footer">
          <div className="leader">
            <Avatar url={leader.avatar} size="small" />
            <span className="leader-name">{leader.nickname}</span>
          </div>
          <Button
            size="small"
            type="primary"
            disabled={signupDisabled}
            onClick={handleSignup}
          >
            {activity.joined ? '已报名' : '报名'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default ActivityCard
