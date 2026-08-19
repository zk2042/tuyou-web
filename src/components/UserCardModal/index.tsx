//+ 用户资料卡弹窗组件
//+ 场景：关注列表/粉丝列表/评论列表/活动详情页等任何"点击头像"入口
//+ 调用方传入 visible + userId，组件内部拉取 GET /personal/member/{id} 并渲染
//+ 关注按钮接入 toggleProfileFollowAPI（POST /personal/follow/{id}，个人中心关注接口）
//+ 已注销（status=2）/已禁用（status=0）用户：显示 StatusBadge 角标 + 隐藏关注按钮
//+ 资料卡用 NutUI Popup（position="center"），关闭按钮在右上角
import { Popup, Avatar, Button, Ellipsis, Toast } from '@nutui/nutui-react'
import { Close } from '@nutui/icons-react'
import Taro from '@tarojs/taro'
import { useEffect, useState, useCallback } from 'react'
import { getUserDetailAPI } from '@/apis/user'
import { toggleProfileFollowAPI } from '@/apis/profile'
import { useToggleAction } from '@/hooks/useToggleAction'
import StatusBadge from '@/components/StatusBadge'
import type { UserDetail } from '@/types'
import './index.less'

interface UserCardModalProps {
  //+ 是否显示
  visible: boolean
  //+ 目标用户 ID（为 null 时弹窗关闭态）
  userId: string | null
  //+ 关闭回调
  onClose: () => void
}

const UserCardModal = ({ visible, userId, onClose }: UserCardModalProps) => {
  const [loading, setLoading] = useState(false)
  const [detail, setDetail] = useState<UserDetail | null>(null)
  //+ 局部关注状态：拉取后用 isFollowed 初始化，关注按钮点击后同步更新（不依赖父组件刷新）
  const [isFollowed, setIsFollowed] = useState(false)

  //+ Toggle 操作通用 Hook：防狂点 + abort + 冷却 + 按钮 loading
  const { toggle, isLoading } = useToggleAction({
    apiFn: useCallback((id: string, signal: AbortSignal) => toggleProfileFollowAPI(id, signal), [])
  })

  //+ visible + userId 变化时拉取用户详情
  useEffect(() => {
    if (!visible || !userId) {
      setDetail(null)
      return
    }
    let cancelled = false
    const controller = new AbortController()
    setLoading(true)
    getUserDetailAPI(userId, controller.signal)
      .then(res => {
        if (cancelled) return
        if (res.code === 0 || res.code === 200) {
          setDetail(res.data)
          setIsFollowed(!!res.data.isFollowed)
        }
      })
      .catch(() => {
        //+ abort 不提示；其他错误由响应拦截器统一处理
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [visible, userId])

  //+ 关注/取消关注
  const handleToggleFollow = async () => {
    if (!userId || !detail) return
    //+ status=2（已注销）不允许关注
    if (detail.status === 2) return
    //+ loading 中或冷却期内：提示操作太快，不执行乐观翻转
    if (isLoading(`follow:${userId}`)) return
    const next = !isFollowed
    //+ 乐观更新
    setIsFollowed(next)
    const result = await toggle(`follow:${userId}`, userId)
    if (result.wasAborted) {
      //+ 冷却期被拦截 → 回滚 + 提示操作太快
      setIsFollowed(!next)
      Taro.showToast({ title: '操作太快了，请稍后再试', icon: 'none' })
    } else if (!result.ok) {
      //+ 真正失败 → 回滚 + 错误提示
      setIsFollowed(!next)
      Taro.showToast({ title: result.error || '操作失败', icon: 'none' })
    } else {
      //+ 成功提示
      Taro.showToast({ title: next ? '关注成功' : '已取消关注', icon: 'success' })
    }
  }

  return (
    <Popup
      visible={visible}
      onClose={onClose}
      position='center'
      closeable
      closeIcon={<Close className='user-card-close' />}
      closeIconPosition='top-right'
      duration={200}
    >
      <div className='user-card-modal'>
        {loading ? (
          <div className='user-card-loading'>加载中...</div>
        ) : detail ? (
          <>
            {/* 背景图 */}
            {detail.bgImg && (
              <div className='user-card-bg'>
                <img src={detail.bgImg} alt='' />
              </div>
            )}
            {/* 头像 */}
            <div className='user-card-avatar'>
              <Avatar src={detail.avatar} fit='cover' size='70' />
            </div>
            {/* 昵称 + 状态角标 */}
            <div className='user-card-name'>
              <Ellipsis content={detail.nickname} rows={1} />
              <StatusBadge status={detail.status} size='large' />
              {detail.role === '领队' && (
                <span className='user-card-role-badge'>领队</span>
              )}
            </div>
            {/* 简介 */}
            {detail.bio && (
              <div className='user-card-bio'>
                <Ellipsis content={detail.bio} rows={2} />
              </div>
            )}
            {/* 统计数据 */}
            <div className='user-card-stats'>
              <div className='user-card-stat'>
                <span className='stat-num'>{detail.followCount}</span>
                <span className='stat-label'>关注</span>
              </div>
              <div className='user-card-stat'>
                <span className='stat-num'>{detail.fansCount}</span>
                <span className='stat-label'>粉丝</span>
              </div>
              <div className='user-card-stat'>
                <span className='stat-num'>{detail.publishCount}</span>
                <span className='stat-label'>发布</span>
              </div>
              {detail.role === '领队' && (
                <div className='user-card-stat'>
                  <span className='stat-num'>{detail.leadingCount}</span>
                  <span className='stat-label'>带队</span>
                </div>
              )}
            </div>
            {/* 关注按钮：已注销/已禁用用户隐藏 */}
            {detail.status === 1 && (
              <Button
                type={isFollowed ? 'default' : 'primary'}
                size='small'
                loading={isLoading(`follow:${detail.id}`)}
                disabled={isLoading(`follow:${detail.id}`)}
                onClick={handleToggleFollow}
                className='user-card-follow-btn'
              >
                {isFollowed ? '已关注' : '关注'}
              </Button>
            )}
          </>
        ) : (
          <div className='user-card-loading'>加载失败</div>
        )}
      </div>
    </Popup>
  )
}

export default UserCardModal
