//+ FollowerList 粉丝列表页（结构与关注列表一致）
//+ 接入 fetchFansList thunk，分页、上拉加载、下拉刷新，关注按钮对接 toggleFollowAPI
import { useCallback } from 'react'
import { useDispatch } from 'react-redux'
import Taro, { useDidShow, useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import { Button } from '@nutui/nutui-react'
import HeaderNavBar from '@/components/HeaderNavBar'
import Avatar from '@/components/Avatar'
import { usePagedList } from '@/hooks/usePagedList'
import { fetchFansList } from '@/store/modules/profile'
import { toggleFollowAPI } from '@/apis/user'
import type { FanItem, UserPublic, PageResult } from '@/types'
import type { AppDispatch } from '@/store'
//+ 复用 FollowList 的样式
import '../FollowList/index.less'

//+ FanItem → UserPublic 转换（统一渲染使用 UserPublic）
const toUserPublic = (item: FanItem): UserPublic => ({
  id: item.followerId,
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

const FollowerList = () => {
  const dispatch: AppDispatch = useDispatch()

  //+ 统一分页 Hook（不自动 immediate，因为 useDidShow 触发第一页）
  const paged = usePagedList<UserPublic>({
    size: 10,
    fetcher: useCallback(
      async ({ page, size }) => {
        const action = await dispatch(fetchFansList({ page, size }))
        //+ 兼容 createAsyncThunk：成功则 payload 为 PageResult
        const payload: PageResult<FanItem> | undefined = (action as any)?.payload
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

  //+ 每次页面显示时加载第一页（实时）
  useDidShow(() => {
    paged.loadFirstPage()
  })

  //+ Q7：下拉刷新（刷新第一页）
  usePullDownRefresh(async () => {
    await paged.refresh()
    Taro.stopPullDownRefresh()
  })

  //+ Q7：上拉加载更多
  useReachBottom(() => {
    paged.loadMore()
  })

  //+ 关注/回关切换（调用真实 API，乐观更新）
  const handleToggleFollow = async (e: any, id: string, currentStatus: boolean) => {
    e.stopPropagation()
    // 乐观更新
    const newStatus = !currentStatus
    paged.updateItem(i => i.id === id, item => ({ ...item, isFollowed: newStatus }))
    try {
      await toggleFollowAPI(id)
      Taro.showToast({ title: newStatus ? '回关成功' : '已取消关注', icon: 'success' })
    } catch (err) {
      // 失败回滚
      paged.updateItem(i => i.id === id, item => ({ ...item, isFollowed: currentStatus }))
      Taro.showToast({ title: '操作失败', icon: 'none' })
    }
  }

  const handleUserClick = (user: UserPublic) => {
    Taro.showToast({ title: `查看 ${user.nickname}`, icon: 'none' })
  }

  const { list, loading, hasMore } = paged

  return (
    <div className="follow-list-page">
      <HeaderNavBar title="粉丝" fixed={false} cancel={false} />

      <div className="list-wrapper">
        {list.length === 0 && !loading ? (
          <div className="empty-state">还没有粉丝哦</div>
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
                {user.isFollowed ? '已关注' : '回关'}
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

export default FollowerList
