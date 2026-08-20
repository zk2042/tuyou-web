//+ 搜索页面
//+ 功能：热门搜索（后端返回）、关键词搜索、内容/活动两栏Tab、复用PostWaterfall和ActivityCard
//+ usePullDownRefresh 下拉刷新 + 容器级 onScroll 距底 50px 自动上拉加载更多
import { useState, useEffect, useCallback, useRef } from 'react'
import Taro, { usePullDownRefresh } from '@tarojs/taro'
import { SearchBar as NutSearchBar, Tabs, Empty, Toast } from '@nutui/nutui-react'
import { ArrowLeft } from '@nutui/icons-react'
import { PostWaterfall } from '@/components/PostWaterfall'
import ActivityCard from '@/components/ActivityCard'
import SearchHistory from '@/components/SearchHistory'
import { useAuthGuard } from '@/components/AuthRoute'
import type { FeedItem, ActivityListItem } from '@/types'
import {
  getHotKeywordsAPI,
  searchContentAPI,
  searchActivitiesAPI
} from '@/apis/search'
import { routerNavigateBack, routerReLaunch } from '@/router'
import './index.less'

const PAGE_SIZE = 10
const SEARCH_MAX_LENGTH = 50
const Search = () => {
  useAuthGuard()
  //+ 滚动容器 ref：.g-search-body 是统一的滚动容器（flex:1 + overflow-y:auto），外层 100vh 布局下 onScroll 能正确生效
  //+ 用于：下拉刷新后回到顶部 + 距底 50px 自动触发上拉加载更多
  const scrollRef = useRef<HTMLDivElement>(null)

  //+ 搜索关键词
  const [keyword, setKeyword] = useState('')
  //+ 统一字数截断：所有修改 keyword 的入口都走这个，确保 <= 50 字
  const setKeywordSafe = useCallback((v: string) => {
    setKeyword(v.length > SEARCH_MAX_LENGTH ? v.slice(0, SEARCH_MAX_LENGTH) : v)
  }, [])
  //+ 是否已执行搜索（true=显示结果，false=显示热门搜索）
  const [searched, setSearched] = useState(false)
  //+ 当前Tab
  const [activeTab, setActiveTab] = useState<'content' | 'activity'>('content')

  //+ 热门搜索关键词
  const [hotKeywords, setHotKeywords] = useState<string[]>([])

  //+ 搜索历史刷新信号：每次搜索后 +1 触发 SearchHistory 重新拉取
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0)

  //+ 内容搜索结果（笔记+攻略）
  const [contentList, setContentList] = useState<FeedItem[]>([])
  const [contentLoading, setContentLoading] = useState(false)
  const [contentPage, setContentPage] = useState(1)
  const [contentHasMore, setContentHasMore] = useState(false)

  //+ 活动搜索结果
  const [activityList, setActivityList] = useState<ActivityListItem[]>([])
  const [activityLoading, setActivityLoading] = useState(false)
  const [activityPage, setActivityPage] = useState(1)
  const [activityHasMore, setActivityHasMore] = useState(false)

  //+ 获取热门搜索关键词
  const loadHotKeywords = useCallback(async () => {
    try {
      const res = await getHotKeywordsAPI()
      if (res.code === 0 || res.code === 200) {
        setHotKeywords(res.data || [])
      }
    } catch (_err) {
      //+ 失败时保留空数组，不阻塞UI
    }
  }, [])

  //+ 搜索内容（笔记+攻略）
  const searchContent = useCallback(async (kw: string, page: number = 1, append: boolean = false) => {
    setContentLoading(true)
    try {
      const res = await searchContentAPI({ keyword: kw, page, size: PAGE_SIZE })
      if (res.code === 0 || res.code === 200) {
        const { list = [], page: respPage = 1, total_page = 0 } = res.data || {}
        setContentList(append ? [...contentList, ...list] : list)
        setContentPage(respPage)
        setContentHasMore(respPage < (total_page ?? respPage))
      }
    } catch (_err) {
      if (!append) {
        setContentList([])
      }
    } finally {
      setContentLoading(false)
    }
  }, [contentList])

  //+ 搜索活动
  const searchActivities = useCallback(async (kw: string, page: number = 1, append: boolean = false) => {
    setActivityLoading(true)
    try {
      const res = await searchActivitiesAPI({ keyword: kw, page, size: PAGE_SIZE })
      if (res.code === 0 || res.code === 200) {
        const { list = [], page: respPage = 1, total_page = 0 } = res.data || {}
        setActivityList(append ? [...activityList, ...list] : list)
        setActivityPage(respPage)
        setActivityHasMore(respPage < (total_page ?? respPage))
      }
    } catch (_err) {
      if (!append) {
        setActivityList([])
      }
    } finally {
      setActivityLoading(false)
    }
  }, [activityList])

  //+ 重置：切回热门搜索页 + 清空所有搜索结果/分页状态
  const resetToHotSearch = useCallback(() => {
    setKeywordSafe('')
    setSearched(false)
    setContentList([])
    setActivityList([])
    setContentPage(1)
    setActivityPage(1)
    setContentHasMore(false)
    setActivityHasMore(false)
  }, [])

  //+ 执行搜索（搜索按钮 / 点击热门关键词 / 回车）
  const handleSearch = useCallback((kw?: string) => {
    const targetKw = (kw ?? keyword ?? '').trim()
    if (!targetKw) {
      //+ 空关键词：提示 + 切回【热门搜索】页（如果在结果页的话）
      Toast.show({ content: '请输入搜索内容', duration: 1.5 })
      if (searched) resetToHotSearch()
      return
    }
    setKeywordSafe(targetKw)
    setSearched(true)
    //+ 首次搜索：重置两个Tab的数据，然后搜索当前Tab
    setContentPage(1)
    setActivityPage(1)
    setContentList([])
    setActivityList([])
    //+ 搜索时回到顶部
    if (scrollRef.current) scrollRef.current.scrollTop = 0
    //+ 两个都搜索，切换Tab时无需再加载
    searchContent(targetKw, 1, false)
    searchActivities(targetKw, 1, false)
    //+ 触发历史记录刷新（搜索后新增一条历史）
    setHistoryRefreshKey((k) => k + 1)
  }, [keyword, resetToHotSearch, searchContent, searchActivities, searched])

  //+ 在结果页时：如果把搜索框内容全部删掉，直接切回热门搜索页
  useEffect(() => {
    if (searched && keyword.trim() === '') {
      resetToHotSearch()
    }
  }, [keyword, searched, resetToHotSearch])

  //+ 点击热门搜索词
  const handleKeywordClick = (kw: string) => {
    handleSearch(kw)
  }

  //+ 返回：优先 navigateBack 回上一页；若栈里没有上一页（直接打开 URL 或刷新过），则 reLaunch 回社区首页
  const handleBack = () => {
    const pages = Taro.getCurrentPages()
    if (pages && pages.length > 1) {
      routerNavigateBack()
    } else {
      routerReLaunch('HOME')
    }
  }

  //+ 加载更多（内容）
  const handleLoadMoreContent = () => {
    if (!contentHasMore || contentLoading) return
    searchContent(keyword, contentPage + 1, true)
  }

  //+ 加载更多（活动）
  const handleLoadMoreActivity = () => {
    if (!activityHasMore || activityLoading) return
    searchActivities(keyword, activityPage + 1, true)
  }

  //+ 活动卡片点击跳转详情
  const handleActivityClick = (activity: ActivityListItem) => {
    Taro.navigateTo({ url: `/pages/ActivityDetail/index?id=${activity.id}` })
  }

  //+ 容器级滚动监听：距底 50px 触发当前 Tab 的加载更多
  //+ 仅在搜索结果页（searched=true）时触发上拉加载，热门搜索页无数据需要加载
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (!searched) return
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget
    const distanceToBottom = scrollHeight - scrollTop - clientHeight
    if (distanceToBottom < 50) {
      if (activeTab === 'content') {
        handleLoadMoreContent()
      } else {
        handleLoadMoreActivity()
      }
    }
  }

  //+ 下拉刷新
  //+ - 未搜索（热门搜索）：不刷新，直接关闭刷新动画
  //+ - 已搜索：重新拉取当前关键词下两个 Tab 的第一页数据，回到顶部
  usePullDownRefresh(async () => {
    try {
      if (!searched) {
        //+ 热门搜索页：不执行刷新操作
        return
      }
      const targetKw = keyword.trim()
      if (targetKw) {
        //+ 并发拉两个 Tab 的第一页，全部 settled 后再 stopPullDownRefresh
        await Promise.allSettled([
          searchContent(targetKw, 1, false),
          searchActivities(targetKw, 1, false)
        ])
      }
      //+ 刷新完成后回到顶部
      if (scrollRef.current) scrollRef.current.scrollTop = 0
    } finally {
      Taro.stopPullDownRefresh()
    }
  })

  //+ 初始化：加载热门搜索
  useEffect(() => {
    loadHotKeywords()
  }, [loadHotKeywords])

  return (
    <div className="g-search-page">
      {/* 头部：返回 + 搜索框 + 搜索按钮 */}
      <div className="g-search-header">
        <div className="g-search-back" onClick={handleBack}>
          <ArrowLeft className="g-search-back-icon" />
        </div>
        <div className="g-search-bar-wrapper" onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === 'Enter') handleSearch()
        }}>
          <NutSearchBar
            className="g-search-bar"
            shape="round"
            placeholder="搜索笔记、攻略、活动"
            maxLength={SEARCH_MAX_LENGTH}
            value={keyword}
            onChange={(v) => setKeywordSafe(v)}
          />
        </div>
        <div
          className={`g-search-btn ${contentLoading || activityLoading ? 'is-disabled' : ''}`}
          onClick={() => {
            if (contentLoading || activityLoading) return
            handleSearch()
          }}
        >
          搜索
        </div>
      </div>

      {/* 主内容区 */}
      {/* 统一滚动容器：flex:1 + overflow-y:auto，外层 100vh 布局下 onScroll 生效 */}
      <div className="g-search-body" ref={scrollRef} onScroll={handleScroll}>
        {!searched ? (
          //+ 未搜索：显示搜索历史 + 热门搜索
          <>
            <SearchHistory
              refreshKey={historyRefreshKey}
              onKeywordClick={handleKeywordClick}
            />
            <div className="g-search-hot">
              <div className="g-search-hot-title">热门搜索</div>
              <div className="g-search-hot-tags">
                {hotKeywords.map((kw, idx) => (
                  <div
                    key={`${kw}-${idx}`}
                    className="g-search-hot-tag"
                    onClick={() => handleKeywordClick(kw)}
                  >
                    {kw}
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          //+ 已搜索：显示Tab + 搜索结果
          <div className="g-search-result">
            {/* Tab切换：内容 / 活动，显示搜索结果数量 */}
            <Tabs
              className="g-search-tabs"
              value={activeTab}
              onChange={(v) => setActiveTab(v as 'content' | 'activity')}
            >
              <Tabs.TabPane title="内容" value="content" />
              <Tabs.TabPane title="活动" value="activity" />
            </Tabs>

            {/* 搜索结果列表 */}
            <div className="g-search-result-body">
              {activeTab === 'content' ? (
                contentList.length === 0 && !contentLoading ? (
                  <div className="g-search-empty">
                    <Empty description="没有找到相关笔记" />
                  </div>
                ) : (
                  <PostWaterfall
                    feed={contentList}
                    loading={contentLoading}
                    hasMore={contentHasMore}
                    onLoadMore={handleLoadMoreContent}
                    emptyText="没有找到相关笔记"
                    onItemClick={() => {}}
                    onToggleLike={() => {}}
                  />
                )
              ) : (
                activityList.length === 0 && !activityLoading ? (
                  <div className="g-search-empty">
                    <Empty description="没有找到相关活动" />
                  </div>
                ) : (
                  <div className="g-search-activity-list">
                    {activityList.map((activity) => (
                      <ActivityCard
                        key={activity.id}
                        activity={activity}
                        onClick={handleActivityClick}
                        onSignup={handleActivityClick}
                        onCancelSignup={handleActivityClick}
                      />
                    ))}
                    {/* 加载更多 */}
                    {activityHasMore && (
                      <div className="g-search-load-more" onClick={handleLoadMoreActivity}>
                        {activityLoading ? '加载中...' : '加载更多'}
                      </div>
                    )}
                    {!activityHasMore && activityList.length > 0 && (
                      <div className="g-search-no-more">已加载全部</div>
                    )}
                  </div>
                )
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Search
