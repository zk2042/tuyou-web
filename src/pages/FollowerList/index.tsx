//+ FollowerList 粉丝列表页（结构与关注列表一致）
//+ 接入 fetchFansList thunk，分页、上拉加载、下拉刷新，关注按钮对接 toggleFollowAPI
//+ 性能优化：列表项拆 UserListItem 子组件 + React.memo + useToggleAction（请求锁+abort+冷却+按钮loading）
import { useCallback, useRef } from 'react'
import { useDispatch } from 'react-redux'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import HeaderNavBar from '@/components/HeaderNavBar'
import UserListItem from '@/components/UserListItem'
import { usePagedList } from '@/hooks/usePagedList'
import { useToggleAction } from '@/hooks/useToggleAction'
import { fetchFansList } from '@/store/modules/profile'
import { toggleProfileFollowAPI } from '@/apis/profile'
import type { FanItem, UserPublic, PageResult } from '@/types'
import type { AppDispatch } from '@/store'
import { useAuthGuard } from '@/components/AuthRoute'
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
  useAuthGuard()
  const dispatch: AppDispatch = useDispatch()
  //+ 滚动容器 ref：容器级 onScroll 触底加载（与 Home/Activity 一致，useReachBottom 在容器滚动布局下不生效）
  const scrollRef = useRef<HTMLDivElement>(null)

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

  //+ Toggle 操作通用 Hook：请求锁 + AbortController + 800ms 冷却 + loading 状态
  const { toggle, isLoading } = useToggleAction({
    apiFn: useCallback((id: string, signal: AbortSignal) => toggleProfileFollowAPI(id, signal), [])
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

  //+ Q7：容器级 onScroll 触底加载更多（与 Home/Activity 一致）
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget
    if (
      scrollHeight - scrollTop - clientHeight < 50 &&
      !paged.loading &&
      paged.hasMore
    ) {
      paged.loadMore()
    }
  }

  //+ 切换关注状态（useToggleAction 防狂点 + abort + 冷却；乐观更新失败回滚）
  //+ useCallback 稳定引用，避免 UserListItem 因回调变化重渲染
  const handleToggleFollow = useCallback(async (id: string, currentStatus: boolean) => {
    const newStatus = !currentStatus
    //+ 乐观更新
    paged.updateItem(i => i.id === id, item => ({ ...item, isFollowed: newStatus }))
    const resKey = `follow:${id}`
    const result = await toggle(resKey, id)
    if (result.wasAborted) return
    if (result.ok) {
      //+ 以服务端返回的 isFollowed 为准（切换式接口）
      const serverStatus = !!(result.data?.isFollowed)
      if (serverStatus !== newStatus) {
        paged.updateItem(i => i.id === id, item => ({ ...item, isFollowed: serverStatus }))
      }
      Taro.showToast({ title: serverStatus ? '回关成功' : '已取消关注', icon: 'success' })
    } else {
      //+ 失败回滚
      paged.updateItem(i => i.id === id, item => ({ ...item, isFollowed: currentStatus }))
      Taro.showToast({ title: result.error || '操作失败', icon: 'none' })
    }
  }, [paged, toggle])

  //+ 点击用户项：跳转个人主页（暂未开发）
  const handleUserClick = useCallback((user: UserPublic) => {
    Taro.showToast({ title: `查看 ${user.nickname}`, icon: 'none' })
  }, [])

  const { list, loading, hasMore } = paged

  return (
    <div className='follow-list-page'>
      <HeaderNavBar title='粉丝' fixed={false} cancel={false} />

      <div className='list-wrapper' ref={scrollRef} onScroll={handleScroll}>
        {list.length === 0 && !loading ? (
          <div className='empty-state'>还没有粉丝哦</div>
        ) : (
          list.map(user => (
            <UserListItem
              key={user.id}
              user={user}
              loading={isLoading(`follow:${user.id}`)}
              onToggleFollow={handleToggleFollow}
              onUserClick={handleUserClick}
            />
          ))
        )}

        {/* 加载更多 */}
        {hasMore && list.length > 0 && (
          <div className='load-more' onClick={() => paged.loadMore()}>
            {loading ? '加载中...' : '加载更多'}
          </div>
        )}
        {!hasMore && list.length > 0 && (
          <div className='no-more'>已加载全部</div>
        )}
      </div>
    </div>
  )
}

export default FollowerList
