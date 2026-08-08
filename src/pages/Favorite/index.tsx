//+ Favorite 我的收藏列表页
//+ Q2 Tab 懒加载：默认笔记，切攻略才请求；每次切Tab实时刷新
//+ Q3 布局统一：复用 PostWaterfall 双列瀑布流，加载更多在外层（不在右侧）
//+ Q7：useReachBottom 上拉加载 + usePullDownRefresh 下拉刷新
//+ Q8：取消收藏 → 调用真实API → 延迟移除（离开页面时统一清理，给用户反悔机会）
import { useState, useCallback, useMemo, useRef } from 'react'
import { useDispatch } from 'react-redux'
import Taro, { useDidShow, useDidHide, usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import { Tabs } from '@nutui/nutui-react'
import HeaderNavBar from '@/components/HeaderNavBar'
import { PostWaterfall } from '@/components/PostWaterfall'
import { usePagedList } from '@/hooks/usePagedList'
import { fetchFavoriteNotes, fetchFavoriteStrategys } from '@/store/modules/profile'
import { toFeedList } from '@/utils/postAdapter'
import type { ProfilePostItem, FeedItem, PageResult } from '@/types'
import type { AppDispatch } from '@/store'
import './index.less'

const Favorite = () => {
  const dispatch: AppDispatch = useDispatch()
  const [activeTab, setActiveTab] = useState(0)

  //+ 记录已取消收藏但暂未移除的项（延迟到离开页面时移除，防止手误给用户反悔机会）
  const pendingRemoveRef = useRef<Set<string | number>>(new Set())

  //+ 两个独立分页实例：笔记/攻略收藏
  const notesPaged = usePagedList<ProfilePostItem>({
    size: 10,
    fetcher: useCallback(
      async ({ page, size }) => {
        const action = await dispatch(fetchFavoriteNotes({ page, size }))
        const payload: PageResult<ProfilePostItem> | undefined = (action as any)?.payload
        if (!payload) return { code: -1, data: { list: [], total: 0, page, size, total_page: 0 } }
        return { code: 0, data: payload }
      },
      [dispatch]
    )
  })

  const strategysPaged = usePagedList<ProfilePostItem>({
    size: 10,
    fetcher: useCallback(
      async ({ page, size }) => {
        const action = await dispatch(fetchFavoriteStrategys({ page, size }))
        const payload: PageResult<ProfilePostItem> | undefined = (action as any)?.payload
        if (!payload) return { code: -1, data: { list: [], total: 0, page, size, total_page: 0 } }
        return { code: 0, data: payload }
      },
      [dispatch]
    )
  })

  const currentPaged = activeTab === 0 ? notesPaged : strategysPaged
  // 转成 FeedItem 后，把 isFavorited 补上（收藏列表都是收藏过的，默认 true，取消后通过 updateItem/removeItem 改）
  const currentList: FeedItem[] = useMemo(() => {
    return toFeedList(currentPaged.list).map(f => ({ ...f, isFavorited: true }))
  }, [currentPaged.list])

  //+ Q2：页面显示时刷新当前 Tab（覆盖：首次进入 + 从详情页返回），保证数据实时
  //+ 注意：不能用 useEffect 依赖 notesPaged/strategysPaged —— 它们每次渲染都是新对象引用，会触发无限请求
  useDidShow(() => {
    currentPaged.loadFirstPage()
  })

  usePullDownRefresh(async () => {
    await currentPaged.refresh()
    Taro.stopPullDownRefresh()
  })

  useReachBottom(() => {
    currentPaged.loadMore()
  })

  //+ Q8 改造：取消收藏不立即移除，标记为待移除；再次收藏则撤销标记（给用户反悔机会）
  const handleToggleFavorite = (item: FeedItem, newIsFavorited: boolean) => {
    if (!newIsFavorited) {
      pendingRemoveRef.current.add(item.id)
      Taro.showToast({ title: '已取消收藏', icon: 'success' })
    } else {
      pendingRemoveRef.current.delete(item.id)
    }
  }

  //+ 离开页面时统一移除已取消收藏的项
  useDidHide(() => {
    if (pendingRemoveRef.current.size === 0) return
    const ids = pendingRemoveRef.current
    notesPaged.removeItem(p => ids.has(p.id))
    strategysPaged.removeItem(p => ids.has(p.id))
    pendingRemoveRef.current.clear()
  })

  const handleItemClick = (item: FeedItem) => {
    const path = item.type === 'guide' ? '/pages/GuideDetail/index' : '/pages/NoteDetail/index'
    Taro.navigateTo({ url: `${path}?id=${item.id}&type=${item.type}` })
  }

  const { loading, hasMore } = currentPaged

  return (
    <div className="favorite-page">
      <HeaderNavBar title="我的收藏" fixed={false} cancel={false} />

      <div className="favorite-body">
        <Tabs
          value={activeTab}
          onChange={(v) => {
            const next = Number(v)
            setActiveTab(next)
            //+ Q2：切 Tab 实时请求新 Tab 第一页（不累积旧数据）
            ;(next === 0 ? notesPaged : strategysPaged).loadFirstPage()
          }}
          activeColor="#428a46"
          className="favorite-tabs"
        >
          <Tabs.TabPane title="笔记" value={0} />
          <Tabs.TabPane title="攻略" value={1} />
        </Tabs>

        {/* Q3 修复：瀑布流容器 + 加载更多分离，加载更多放在外层（下方） */}
        {/* Q8 修正：收藏图标替代点赞图标位置（底部右侧），点击取消收藏 → 移除项 */}
        <PostWaterfall
          feed={currentList}
          loading={loading && currentList.length === 0}
          hasMore={hasMore}
          emptyText={activeTab === 0 ? '还没有收藏的笔记' : '还没有收藏的攻略'}
          onItemClick={handleItemClick}
          onLoadMore={() => currentPaged.loadMore()}
          actionType="favorite"
          onToggleFavorite={handleToggleFavorite}
        />
      </div>
    </div>
  )
}

export default Favorite
