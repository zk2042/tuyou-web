//+ 用户列表项组件（FollowList/FollowerList 共用）
//+ 抽离为独立子组件 + React.memo，避免父组件 list 变化时全列表重渲染
//+ 仅 props 变化的 item 重渲染，配合 useCallback 稳定回调引用
//+ 样式复用父页面 FollowList/index.less 的全局 .user-item 类名，无需独立 less
import { memo } from 'react'
import { Button, Ellipsis } from '@nutui/nutui-react'
import Avatar from '@/components/Avatar'
import type { UserPublic } from '@/types'

interface UserListItemProps {
  user: UserPublic
  /** 关注按钮 loading 状态（请求中置灰） */
  loading?: boolean
  /** 关注/回关切换回调 */
  onToggleFollow: (id: string, currentStatus: boolean) => void
  /** 点击用户项回调 */
  onUserClick: (user: UserPublic) => void
}

const UserListItem = memo(({ user, loading, onToggleFollow, onUserClick }: UserListItemProps) => {
  return (
    <div className='user-item' onClick={() => onUserClick(user)}>
      <Avatar url={user.avatar} size='35' />
      <div className='user-info'>
        <Ellipsis className='user-nickname' content={user.nickname} rows={1} />
        <Ellipsis className='user-bio' content={user.bio} rows={1} />
      </div>
      <Button
        className={`follow-btn ${user.isFollowed ? 'followed' : ''}`}
        type={user.isFollowed ? 'default' : 'primary'}
        size='small'
        loading={loading}
        disabled={loading}
        onClick={(ev) => {
          ev.stopPropagation()
          onToggleFollow(user.id, !!user.isFollowed)
        }}
      >
        {user.isFollowed ? '已关注' : '回关'}
      </Button>
    </div>
  )
})

UserListItem.displayName = 'UserListItem'

export default UserListItem
