//+ 活动卡片组件（列表页 / 我的活动页复用）
//+ 布局：上=封面图(左)+标题/时间/地点(右)；下=进度条+人数/价格+领队/报名按钮
//+ 报名按钮状态映射表（文档状态详细定义表）：
//+   ┌────────────┬─────────────────────────────────────────────────────────────────┐
//+   │ 文案        │ 条件                                                            │
//+   ├────────────┼─────────────────────────────────────────────────────────────────┤
//+   │ 立即报名    │ status=报名中 + !joined + people<max + now∈[signUpStart, signUpEnd] │ 绿主色可点击
//+   │ 取消报名    │ status=报名中 + joined                                           │ 灰边框可点击
//+   │ 已满员      │ status=报名中 + !joined + people>=max                           │ 灰禁用 → Toast"已满员"
//+   │ 报名未开始  │ status=报名中 + now<signUpStart                                  │ 灰禁用 → Toast"报名尚未开始"
//+   │ 报名已截止  │ status=报名中 + !joined + now>signUpEnd                          │ 灰禁用 → Toast"报名已截止"
//+   │ 已开始      │ status=进行中                                                   │ 灰禁用 → Toast"活动已开始"
//+   │ 已结束      │ status=已结束                                                   │ 灰禁用 → Toast"活动已结束"
//+   │ 已取消      │ status=已取消                                                   │ 灰禁用 → Toast"活动已取消"
//+   └────────────┴─────────────────────────────────────────────────────────────────┘
import { Button } from '@nutui/nutui-react'
import Taro from '@tarojs/taro'
import Avatar from '@/components/Avatar'
import type { ActivityListItem } from '@/types'
import './index.less'

interface ActivityCardProps {
  //+ 活动数据
  activity: ActivityListItem
  //+ 点击卡片回调（跳转详情）
  onClick?: (activity: ActivityListItem) => void
  //+ 点击"立即报名"回调（父级负责弹出确认框 → 调接口）
  onSignup?: (activity: ActivityListItem) => void
  //+ 点击"取消报名"回调（父级负责弹出确认框 → 调接口）
  onCancelSignup?: (activity: ActivityListItem) => void
  //+ 是否显示报名人预览（"我发布的"场景传 true，后端返回 participants 时渲染头像列表）
  showParticipants?: boolean
}

//+ 状态标签颜色映射
const STATUS_COLOR: Record<string, string> = {
  报名中: '#2e7d32',
  进行中: '#fa8c16',
  已结束: '#999',
  已取消: '#d4380d',
}

type SignupBtnKind =
  | 'signup'          // 立即报名（绿色主色，可点击）
  | 'cancel'          // 取消报名（灰色边框，可点击）
  | 'full'            // 已满员
  | 'not_started'     // 报名未开始
  | 'deadline'        // 报名已截止
  | 'activity_start'  // 活动已开始
  | 'activity_end'    // 活动已结束
  | 'activity_cancel' // 活动已取消

interface SignupBtnState {
  kind: SignupBtnKind
  text: string
  clickable: boolean
}

//+ 根据时间字符串解析为本地时间戳（兼容 "YYYY-MM-DD HH:mm"/"YYYY-MM-DD HH:mm:ss"）
function parseLocalTime(s: string): number {
  if (!s) return 0
  return new Date(String(s).replace(/-/g, '/')).getTime()
}

//+ 按"状态详细定义表"计算按钮状态（按优先级从上到下匹配）
function computeBtnState(a: ActivityListItem, nowMs: number): SignupBtnState {
  const status = a.activityStatus || ''
  const signUpStart = parseLocalTime(a.signUpStart)
  const signUpEnd = parseLocalTime(a.signUpEnd)

  //+ 最终状态（非"报名中"）
  if (status === '已取消') return { kind: 'activity_cancel', text: '已取消', clickable: false }
  if (status === '已结束') return { kind: 'activity_end', text: '已结束', clickable: false }
  if (status === '进行中') return { kind: 'activity_start', text: '已开始', clickable: false }

  //+ status !== '报名中' 也按"已结束"兜底
  if (status !== '报名中') return { kind: 'activity_end', text: '已结束', clickable: false }

  //+ 以下分支：activityStatus=报名中
  if (a.joined) return { kind: 'cancel', text: '取消报名', clickable: true }

  if (nowMs < signUpStart) return { kind: 'not_started', text: '报名未开始', clickable: false }
  if (nowMs > signUpEnd) return { kind: 'deadline', text: '报名已截止', clickable: false }
  if (a.currentPeople >= a.maxPeople) return { kind: 'full', text: '已满员', clickable: false }

  return { kind: 'signup', text: '立即报名', clickable: true }
}

//+ 禁用态点击 Toast 消息映射
const DISABLED_TOAST: Record<SignupBtnKind, string> = {
  signup: '',
  cancel: '',
  full: '已满员',
  not_started: '报名尚未开始',
  deadline: '报名已截止',
  activity_start: '活动已开始',
  activity_end: '活动已结束',
  activity_cancel: '活动已取消',
}

const ActivityCard = ({ activity, onClick, onSignup, onCancelSignup }: ActivityCardProps) => {
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

  //+ 按"状态详细定义表"计算按钮状态
  const btnState = computeBtnState(activity, Date.now())

  //+ 点击报名按钮（阻止冒泡，不触发卡片跳转）
  const handleSignupBtn = (e: any) => {
    e?.stopPropagation?.()
    if (btnState.clickable) {
      if (btnState.kind === 'signup') {
        onSignup?.(activity)
      } else if (btnState.kind === 'cancel') {
        onCancelSignup?.(activity)
      }
    } else {
      const toast = DISABLED_TOAST[btnState.kind]
      if (toast) Taro.showToast({ title: toast, icon: 'none' })
    }
  }

  //+ 点击卡片
  const handleClick = () => onClick?.(activity)

  //+ 由 kind 映射到 NutUI Button 的 type/block/danger/自定义 class
  //+ NutUI type 可选 'default' | 'primary' | 'info' | 'success' | 'warning' | 'danger'
  //+ "取消报名"用灰色边框：type=default + class 自定义样式
  const buttonType: any = btnState.kind === 'signup' ? 'primary' : 'default'
  const buttonClass =
    btnState.kind === 'signup' ? 'ac-btn-signup'
      : btnState.kind === 'cancel' ? 'ac-btn-cancel'
        : 'ac-btn-disabled'

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
            type={buttonType}
            disabled={!btnState.clickable}
            onClick={handleSignupBtn}
            className={buttonClass}
          >
            {btnState.text}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default ActivityCard
