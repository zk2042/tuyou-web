//+ FollowList 关注列表页
//+ 结构：HeaderNavBar（无取消文字，固定头部） + 关注列表 + 关注按钮切换
//+ 统一接入 usePagedList + fetchFollowList + 上拉加载/下拉刷新 + 真实关注API
import { useCallback } from 'react'
import { useDispatch } from 'react-redux'
import Taro, { useDidShow, useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { Button } from '@nutui/nutui-react'
import HeaderNavBar from '@/components/HeaderNavBar'
import Avatar from '@/components/Avatar'
import { usePagedList } from '@/hooks/usePagedList'
import { fetchFollowList } from '@/store/modules/profile'
import { toggleFollowAPI } from '@/apis/user'
import type { FollowItem, UserPublic, PageResult } from '@/types'
import type { AppDispatch } from '@/store'
import './index.less'

//+ 将 FollowItem 转换为 UserPublic（供组件渲染使用）
//+ 后端用 followeeId/followerId 标识关系，前端统一用 id
const toUserPublic = (item: FollowItem): UserPublic => ({
  id: item.followeeId,
  phone: '',
  nickname: item.nickname,
  avatar: item.avatar,
  bio: item.bio,
  bgImg: '',
  memberType: 1,
  publishCount: 0,
  followCount: 0,
  fansCount: 0,
  isFollowed: !!item.isFollowed
})

const FollowList = () => {
  const dispatch: AppDispatch = useDispatch()

  const paged = usePagedList<UserPublic>({
    size: 10,
    fetcher: useCallback(
      async ({ page, size }) => {
        const action = await dispatch(fetchFollowList({ page, size }))
        const payload: PageResult<FollowItem> | undefined = (action as any)?.payload
        if (!payload) return { code: -1, message: '加载失败', data: { list: [], total: 0, page, size, total_page: 0 } }
        return {
          code: 0,
          data: {
            list: (payload.list || []).map(toUserPublic),
            total: payload.total,
            page: payload.page,
            size: payload.size,
            total_page: payload.total_page
          }
        }
      },
      [dispatch]
    )
  })

  //+ 页面显示时加载第一页（实时刷新）
  useDidShow(() => {
    paged.loadFirstPage()
  })

  usePullDownRefresh(async () => {
    await paged.refresh()
    Taro.stopPullDownRefresh()
  })

  useReachBottom(() => {
    paged.loadMore()
  })

  //+ 切换关注状态（调用真实 API，乐观更新）
  const handleToggleFollow = async (e: any, id: string, currentStatus: boolean) => {
    e.stopPropagation()
    const newStatus = !currentStatus
    paged.updateItem(i => i.id === id, item => ({ ...item, isFollowed: newStatus }))
    try {
      await toggleFollowAPI(id)
      Taro.showToast({ title: newStatus ? '关注成功' : '已取消关注', icon: 'success' })
    } catch (err) {
      paged.updateItem(i => i.id === id, item => ({ ...item, isFollowed: currentStatus }))
      Taro.showToast({ title: '操作失败', icon: 'none' })
    }
  }

  //+ 点击用户项：跳转个人主页（暂未开发）
  const handleUserClick = (user: UserPublic) => {
    Taro.showToast({ title: `查看 ${user.nickname}`, icon: 'none' })
  }

  const { list, loading, hasMore } = paged

  return (
    <div className="follow-list-page">
      <HeaderNavBar title="关注" fixed={false} cancel={false} />

      <div className="list-wrapper">
        {list.length === 0 && !loading ? (
          <div className="empty-state">还没有关注的人</div>
        ) : (
          list.map(user => (
            <div key={user.id} className="user-item" onClick={() => handleUserClick(user)}>
              <Avatar url={user.avatar} size="35" />
              <div className="user-info">
                <span className="user-nickname">{user.nickname}</span>
                <span className="user-bio">{user.bio}</span>
              </div>
              <Button
                className={`follow-btn ${user.isFollowed ? 'followed' : ''}`}
                type={user.isFollowed ? 'default' : 'primary'}
                size="small"
                onClick={(ev) => handleToggleFollow(ev, user.id, !!user.isFollowed)}
              >
                {user.isFollowed ? '已关注' : '关注'}
              </Button>
            </div>
          ))
        )}

        {/* 加载更多 */}
        {hasMore && list.length > 0 && (
          <div className="load-more" onClick={() => paged.loadMore()}>
            {loading ? '加载中...' : '加载更多'}
          </div>
        )}
        {!hasMore && list.length > 0 && (
          <div className="no-more">已加载全部</div>
        )}
      </div>
    </div>
  )
}

export default FollowList
