//+ 账号状态角标组件
//+ 根据 UserStatus 渲染对应的灰化标签：0=已禁用 2=已注销
//+ status=1 或 undefined（未返回状态字段）时不渲染任何内容
//+ 用法：<StatusBadge status={user.status} /> 放在昵称右侧
import type { UserStatus } from '@/types'

interface StatusBadgeProps {
  status?: UserStatus
  //+ 角标大小，默认 'small'（12px 字号），可选 'large'（14px）
  size?: 'small' | 'large'
}

const STATUS_TEXT: Record<UserStatus, string> = {
  0: '已禁用',
  1: '',
  2: '已注销',
}

const StatusBadge = ({ status, size = 'small' }: StatusBadgeProps) => {
  //+ status 未返回或为 1（正常）时不渲染
  if (status === undefined || status === 1) return null

  const text = STATUS_TEXT[status]
  if (!text) return null

  return <span className={`status-badge status-badge-${size} status-badge-${status}`}>{text}</span>
}

export default StatusBadge
