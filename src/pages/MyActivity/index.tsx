//+ MyActivity 我的活动页
//+ Q2 需求：Tab懒加载，默认先加载"我发布的"；每次切Tab实时刷新
//+ Q7 需求：useReachBottom 上拉加载 + usePullDownRefresh 下拉刷新
//+ 结构：HeaderNavBar + Tabs（我发布的 / 我参与的） + ActivityCard 列表
import { useState, useCallback, useMemo, useRef } from 'react'
import { useDispatch } from 'react-redux'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { Tabs } from '@nutui/nutui-react'
import HeaderNavBar from '@/components/HeaderNavBar'
import ActivityCard from '@/components/ActivityCard'
import { usePagedList } from '@/hooks/usePagedList'
import { fetchPublishActivity, fetchJoinActivity } from '@/store/modules/profile'
import type { ActivityListItem, PageResult } from '@/types'
import type { AppDispatch } from '@/store'
import { useAuthGuard } from '@/components/AuthRoute'
import './index.less'

const MyActivity = () => {
  useAuthGuard()
  const dispatch: AppDispatch = useDispatch()
  //+ Tab: 0=我发布的 1=我参与的
  const [activeTab, setActiveTab] = useState(0)
  //+ 滚动容器 ref：容器级 onScroll 触底加载（与 Home/Activity 一致，useReachBottom 在容器滚动布局下不生效）
  const scrollRef = useRef<HTMLDivElement>(null)

  //+ 两个独立分页实例：发布/参与（互相独立，互不干扰）
  const publishPaged = usePagedList<ActivityListItem>({
    size: 10,
    fetcher: useCallback(
      async ({ page, size }) => {
        const action = await dispatch(fetchPublishActivity({ page, size }))
        const payload: PageResult<ActivityListItem> | undefined = (action as any)?.payload
        if (!payload) return { code: -1, data: { list: [], total: 0, page, size, total_page: 0 } }
        return { code: 0, data: payload }
      },
      [dispatch]
    )
  })

  const joinPaged = usePagedList<ActivityListItem>({
    size: 10,
    fetcher: useCallback(
      async ({ page, size }) => {
        const action = await dispatch(fetchJoinActivity({ page, size }))
        const payload: PageResult<ActivityListItem> | undefined = (action as any)?.payload
        if (!payload) return { code: -1, data: { list: [], total: 0, page, size, total_page: 0 } }
        return { code: 0, data: payload }
      },
      [dispatch]
    )
  })

  const currentPaged = activeTab === 0 ? publishPaged : joinPaged
  const currentList = useMemo(() => currentPaged.list, [currentPaged.list])
  const { loading, hasMore } = currentPaged

  //+ 页面显示时刷新当前 Tab（覆盖：首次进入 + 从详情页返回），保证数据实时
  //+ 注意：不能用 useEffect 依赖 publishPaged/joinPaged —— 它们每次渲染都是新对象引用，会触发无限请求
  useDidShow(() => {
    currentPaged.loadFirstPage()
  })

  //+ Q7：下拉刷新（当前Tab）
  usePullDownRefresh(async () => {
    await currentPaged.refresh()
    Taro.stopPullDownRefresh()
  })

  //+ Q7：容器级 onScroll 触底加载更多（当前Tab，与 Home/Activity 一致）
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget
    if (
      scrollHeight - scrollTop - clientHeight < 50 &&
      !currentPaged.loading &&
      currentPaged.hasMore
    ) {
      currentPaged.loadMore()
    }
  }

  //+ 点击卡片：跳转详情
  const handleCardClick = (activity: ActivityListItem) => {
    Taro.navigateTo({ url: `/pages/ActivityDetail/index?id=${activity.id}` })
  }

  //+ 点击报名：跳转详情页完成报名
  const handleSignup = (activity: ActivityListItem) => {
    Taro.navigateTo({ url: `/pages/ActivityDetail/index?id=${activity.id}` })
  }

  //+ Q2：Tab 切换 —— 实时请求新 Tab 第一页（不累积旧数据）
  const handleTabChange = (v: number | string) => {
    const next = Number(v)
    setActiveTab(next)
    ;(next === 0 ? publishPaged : joinPaged).loadFirstPage()
  }

  return (
    <div className='my-activity-page'>
      <HeaderNavBar title='我的活动' fixed={false} cancel={false} />

      <div className='my-activity-body' ref={scrollRef} onScroll={handleScroll}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          activeColor='#428a46'
          className='my-activity-tabs'
        >
          <Tabs.TabPane title='我发布的' value={0} />
          <Tabs.TabPane title='我参与的' value={1} />
        </Tabs>

        <div className='my-activity-list'>
          {currentList.length === 0 && !loading ? (
            <div className='empty-state'>
              {activeTab === 0 ? '还没有发布活动' : '还没有参与任何活动'}
            </div>
          ) : (
            currentList.map(item => (
              <ActivityCard
                key={item.id}
                activity={item}
                onClick={handleCardClick}
                onSignup={handleSignup}
                //+ "我发布的" Tab 显示报名人预览（后端返回 participants 时渲染）
                showParticipants={activeTab === 0}
              />
            ))
          )}

          {/* 加载更多提示 */}
          {hasMore && currentList.length > 0 && (
            <div className='load-more' onClick={() => currentPaged.loadMore()}>
              {loading ? '加载中...' : '加载更多'}
            </div>
          )}
          {!hasMore && currentList.length > 0 && (
            <div className='no-more'>已加载全部</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default MyActivity
