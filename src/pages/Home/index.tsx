//+ 社区首页组件
//+ Q5+Q6：PostWaterfall 组件（原 NoteList 语义化重命名，笔记/攻略图片/视频混合）
//+ Q7：useReachBottom 上拉加载更多；usePullDownRefresh 下拉刷新
import SearchBar from '@/components/SearchBar'
import Banner from '@/components/Banner'
import { PostWaterfall } from '@/components/PostWaterfall'
import { Tabs } from '@nutui/nutui-react'
import { useEffect, useState, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import Taro, { useDidShow, useReachBottom, usePullDownRefresh } from '@tarojs/taro'
import type { RootState, AppDispatch } from '@/store'
import { fetchFeed, resetFeed, softSyncFeed, updateFeedItem } from '@/store/modules/home'
import type { FeedItem } from '@/types'
//+ 说明：点赞/收藏 API 由 PostWaterfall 组件内部调用（含乐观 UI），
//+ 此处仅做 store 同步，不重复 dispatch thunk，避免双重请求

import './index.less'

const Home = () => {
  const dispatch: AppDispatch = useDispatch()

  //+ 从home store获取Feed流状态
  const {
    feed,
    feedLoading,
    feedHasMore,
    feedPage
  } = useSelector((state: RootState) => state.home)

  //+ 静态配置（分类、排序列表）
  const categories = ['全部', '徒步', '露营', '骑行', '登山', '跑步', '攀岩', '溯溪']
  const sorts = ['推荐', '最新', '最热']

  //+ useState管理局部UI状态
  const [categoryName, setCategoryName] = useState('全部')
  const [sortName, setSortName] = useState('推荐')

  //+ 加载 Feed 第一页（分类/排序变化时、下拉刷新时调用）
  const loadFirstPage = useCallback(() => {
    dispatch(resetFeed())
    dispatch(fetchFeed({
      category: categoryName === '全部' ? 0 : categories.indexOf(categoryName),
      sort: sortName,
      page: 1,
      size: 10
    }))
  }, [dispatch, categoryName, sortName])

  //+ 加载Feed流（配置加载完成后 / 分类排序变化时）— 刷新第一页
  useEffect(() => {
    loadFirstPage()
  }, [loadFirstPage])

  //+ 加载下一页（上拉触底）
  const loadNextPage = useCallback(() => {
    if (feedLoading || !feedHasMore) return
    dispatch(fetchFeed({
      category: categoryName === '全部' ? undefined : categories.indexOf(categoryName),
      sort: sortName,
      page: feedPage + 1,
      size: 10
    }))
  }, [dispatch, categoryName, sortName, feedLoading, feedHasMore, feedPage])

  //+ 问题2修复：从详情返回首页时使用软同步，不回到顶部、不打乱顺序
  //+ 首次进入页面时 useEffect 已调 loadFirstPage，这里跳过；只有"从其他页面返回"时触发软同步
  const loadedOnceRef = { current: false }
  useDidShow(() => {
    if (loadedOnceRef.current) {
      dispatch(softSyncFeed({
        category: categoryName === '全部' ? 0 : categories.indexOf(categoryName),
        sort: sortName,
        page: 1,
        size: 10
      }))
    } else {
      loadedOnceRef.current = true
    }
  })

  //+ Q7：taro上拉加载更多
  useReachBottom(() => {
    loadNextPage()
  })
  
  //+ Q7：taro下拉刷新（重新加载第一页）
  usePullDownRefresh(async () => {
    dispatch(resetFeed())
    await dispatch(fetchFeed({
      category: categoryName === '全部' ? undefined : categories.indexOf(categoryName),
      sort: sortName,
      page: 1,
      size: 10
    }))
    Taro.stopPullDownRefresh()
  })

  //+ Q8：首页卡片点赞回调（组件已调 API + 乐观 UI，这里仅同步 home store，保证下次渲染/刷新数据一致）
  const handleToggleLike = (item: FeedItem, newIsLiked: boolean, newLikeCount: number) => {
    dispatch(updateFeedItem({
      id: item.id,
      patch: { isLiked: newIsLiked, likeCount: newLikeCount }
    }))
  }

  return (
    <div className="home-container">
      {/* 头部导航栏：固定不动 */}
      <div className="home-header">
        <SearchBar />
      </div>

      {/* 中间内容区域：占剩余空间，可滚动 */}
      <div className="home-content">
        {/* 轮播图区域 */}
        <div className="home-banner">
          <Banner />
        </div>

        {/* 筛选区域 */}
        <div className="home-filter">
          {/* 分类筛选 */}
          <Tabs
            className="category-tabs"
            value={categoryName}
            onChange={(value) => setCategoryName(value as string)}
          >
            {categories.map((item, index) => (
              <Tabs.TabPane key={index} title={item} value={item} />
            ))}
          </Tabs>

          {/* 排序方式 */}
          <Tabs
            className="sort-tabs"
            value={sortName}
            activeType="button"
            onChange={(value) => setSortName(value as string)}
          >
            {sorts.map((item, index) => (
              <Tabs.TabPane key={index} title={item} value={item} />
            ))}
          </Tabs>
        </div>

        {/* Feed流列表：使用统一的 PostWaterfall 组件 */}
        <div className="home-feed">
          <PostWaterfall
            feed={feed}
            loading={feedLoading}
            hasMore={feedHasMore}
            onLoadMore={loadNextPage}
            emptyText="暂无内容，去发布第一篇吧"
            onItemClick={()=>{}}
            onToggleLike={handleToggleLike}
          />
        </div>
      </div>
    </div>
  )
}

export default Home
