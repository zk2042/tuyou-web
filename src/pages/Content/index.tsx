//+ Content 页面 - 用户发布的笔记和攻略
//+ Q2 需求：Tab懒加载，默认先请求笔记；每次切Tab才请求对应Tab（实时刷新，不累积）
//+ Q7 需求：useReachBottom 上拉加载 + usePullDownRefresh 下拉刷新
//+ 结构：HeaderNavBar + Tab（笔记/攻略） + PostWaterfall 瀑布流 + 删除弹窗（待接口）
import { useState, useCallback, useMemo } from 'react'
import { useDispatch } from 'react-redux'
import Taro, { useDidShow, usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import { Tabs, Dialog } from '@nutui/nutui-react'
import HeaderNavBar from '@/components/HeaderNavBar'
import { PostWaterfall } from '@/components/PostWaterfall'
import { usePagedList } from '@/hooks/usePagedList'
import { fetchProfileNotes, fetchProfileStrategys } from '@/store/modules/profile'
//+ 说明：点赞 API 由 PostWaterfall 组件内部调用（含乐观 UI）；
//+ "我的内容"为管理列表，不展示收藏按钮，无需父级回调同步
import { toFeedList } from '@/utils/postAdapter'
import type { ProfilePostItem, FeedItem, PageResult } from '@/types'
import type { AppDispatch } from '@/store'
import './index.less'

const Content = () => {
  const dispatch: AppDispatch = useDispatch()
  //+ Tab激活态 0=笔记 1=攻略
  const [activeTab, setActiveTab] = useState<number>(0)
  //+ 删除弹窗控制
  const [deleteVisible, setDeleteVisible] = useState(false)

  //+ 两个独立的分页实例：一个给笔记，一个给攻略（相互独立不共享状态）
  const notesPaged = usePagedList<ProfilePostItem>({
    size: 10,
    fetcher: useCallback(
      async ({ page, size }) => {
        const action = await dispatch(fetchProfileNotes({ page, size }))
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
        const action = await dispatch(fetchProfileStrategys({ page, size }))
        const payload: PageResult<ProfilePostItem> | undefined = (action as any)?.payload
        if (!payload) return { code: -1, data: { list: [], total: 0, page, size, total_page: 0 } }
        return { code: 0, data: payload }
      },
      [dispatch]
    )
  })

  const currentPaged = activeTab === 0 ? notesPaged : strategysPaged
  const currentList: FeedItem[] = useMemo(
    () => toFeedList(currentPaged.list),
    [currentPaged.list]
  )

  //+ Q2：页面显示时刷新当前 Tab（覆盖：首次进入 + 从详情页返回），保证数据实时
  //+ 注意：不能用 useEffect 依赖 notesPaged/strategysPaged —— 它们每次渲染都是新对象引用，会触发无限请求
  useDidShow(() => {
    ;(activeTab === 0 ? notesPaged : strategysPaged).loadFirstPage()
  })

  //+ Q7：下拉刷新（只刷新当前 Tab）
  usePullDownRefresh(async () => {
    await currentPaged.refresh()
    Taro.stopPullDownRefresh()
  })

  //+ Q7：上拉加载更多（只加载当前 Tab）
  useReachBottom(() => {
    currentPaged.loadMore()
  })

  //+ 点击详情：传 isMine=1 标识详情页显示删除按钮
  const handleItemClick = (item: FeedItem) => {
    const pagePath = item.type === 'guide'
      ? '/pages/GuideDetail/index'
      : '/pages/NoteDetail/index'
    Taro.navigateTo({ url: `${pagePath}?id=${item.id}&type=${item.type}&isMine=1` })
  }

  //+ Q2：Tab 切换 —— 实时请求新 Tab 第一页（不累积旧数据）
  const handleTabChange = (v: number | string) => {
    const next = Number(v)
    setActiveTab(next)
    ;(next === 0 ? notesPaged : strategysPaged).loadFirstPage()
  }

  return (
    <div className="content-page">
      <HeaderNavBar
        title="我的内容"
        fixed={false}
        cancel={false}
      />

      <div className="content-body">
        {/* 顶部 Tab */}
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          activeColor="#428a46"
          className="content-tabs"
          activeType="card"
        >
          <Tabs.TabPane title="笔记" value={0} />
          <Tabs.TabPane title="攻略" value={1} />
        </Tabs>

        {/* 瀑布流列表：用统一的 PostWaterfall 组件 */}
        <div className="feed-wrapper">
          <PostWaterfall
            feed={currentList}
            loading={currentPaged.loading && currentList.length === 0}
            hasMore={currentPaged.hasMore}
            emptyText={activeTab === 0 ? '还没有发布笔记' : '还没有发布攻略'}
            onItemClick={handleItemClick}
            onLoadMore={() => currentPaged.loadMore()}
          />
        </div>
      </div>

      {/* 删除确认弹窗 */}
      <Dialog
        visible={deleteVisible}
        title="确认删除？"
        content="删除后无法恢复，确定删除该内容吗？"
        confirmText="删除"
        cancelText="取消"
        onConfirm={() => {
          //+ 暂未实现删除接口，此处仅关闭弹窗
          setDeleteVisible(false)
          Taro.showToast({ title: '删除功能开发中', icon: 'none' })
        }}
        onCancel={() => {
          setDeleteVisible(false)
        }}
      />
    </div>
  )
}

export default Content
