//+ 活动列表页
//+ 结构：SearchBar 头部 + 分类筛选栏 + 活动卡片列表 + 上拉加载
//+ 数据：先走真实后端，失败降级 Mock（降级逻辑在 store fetchActivities 中）
//+ 状态：列表/分页/筛选/加载状态归 Store；滚动位置等纯 UI 状态留页面内
import { useEffect, useRef, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import Taro, { useDidShow } from '@tarojs/taro'
import { Loading, Empty } from '@nutui/nutui-react'
import type { RootState, AppDispatch } from '@/store'
import { fetchActivities, setCategory, resetActivityList } from '@/store/modules/activity'
import SearchBar from '@/components/SearchBar'
import ActivityCard from '@/components/ActivityCard'
import type { ActivityListItem } from '@/types'
import './index.less'

//+ 分类列表（与后端枚举一致，'全部' 不传 category 参数）
const CATEGORY_LIST = ['全部', '徒步', '露营', '骑行', '登山', '跑步', '攀岩', '溯溪']

//+ 分类图标映射（用 emoji 占位，后续可替换为图标资源）
const CATEGORY_ICON: Record<string, string> = {
  全部: '🌟',
  徒步: '🥾',
  露营: '⛺',
  骑行: '🚴',
  登山: '🏔️',
  跑步: '🏃',
  攀岩: '🧗',
  溯溪: '🌊',
}

const PAGE_SIZE = 10

const Activity = () => {
  const dispatch: AppDispatch = useDispatch<AppDispatch>()
  //+ 从 store 读取列表状态
  const {
    activityList,
    page,
    totalPage,
    category,
    loading,
    loadingMore,
  } = useSelector((state: RootState) => state.activity)

  const scrollRef = useRef<HTMLDivElement>(null)

  //+ 加载活动列表（page=1 替换，page>1 追加）
  const loadActivities = useCallback(
    (targetCategory: string, targetPage: number, loadMore: boolean) => {
      dispatch(
        fetchActivities({
          category: targetCategory === '全部' ? '' : targetCategory,
          page: targetPage,
          size: PAGE_SIZE,
          loadMore,
        })
      )
    },
    [dispatch]
  )

  //+ 首次进入 / 切换分类：重置 page=1 重新加载
  useEffect(() => {
    loadActivities(category, 1, false)
    //+ 依赖 category：分类变化触发重新加载
    //+ eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category])

  //+ 切换分类
  const handleCategoryChange = (cat: string) => {
    if (cat === category) return
    dispatch(setCategory(cat))
  }

  //+ 上拉加载更多
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget
    //+ 距底部 50px 触发，且还有更多数据，且未在加载中
    if (
      scrollHeight - scrollTop - clientHeight < 50 &&
      page < totalPage &&
      !loadingMore &&
      !loading
    ) {
      loadActivities(category, page + 1, true)
    }
  }

  //+ 点击卡片跳转详情
  const handleCardClick = (activity: ActivityListItem) => {
    Taro.navigateTo({ url: `/pages/ActivityDetail/index?id=${activity.id}` })
  }

  //+ 点击报名按钮：跳转详情页完成报名（文档4.3节：列表页按钮仅展示，点击跳转详情页）
  const handleSignup = (activity: ActivityListItem) => {
    Taro.navigateTo({ url: `/pages/ActivityDetail/index?id=${activity.id}` })
  }

  //+ 页面再次显示时刷新列表（文档4.2节方案一：从详情页返回时同步报名状态）
  useDidShow(() => {
    //+ 仅在已有数据时刷新，保留当前筛选条件和页码
    if (activityList.length > 0) {
      loadActivities(category, 1, false)
    }
  })

  return (
    <div className="activity-page">
      {/* 顶部导航：SearchBar（含"途友"标题 + 搜索 + 头像） */}
      <div className="activity-header">
        <SearchBar />
      </div>

      {/* 可滚动内容区 */}
      <div className="activity-content" ref={scrollRef} onScroll={handleScroll}>
        {/* 分类筛选栏：横向滚动，圆形图标 + 分类名 */}
        <div className="category-bar">
          {CATEGORY_LIST.map((cat) => (
            <div
              key={cat}
              className={`category-item ${cat === category ? 'active' : ''}`}
              onClick={() => handleCategoryChange(cat)}
            >
              <div className="category-icon">{CATEGORY_ICON[cat]}</div>
              <div className="category-name">{cat}</div>
            </div>
          ))}
        </div>

        {/* 活动列表 */}
        <div className="activity-list">
          {activityList.map((activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              onClick={handleCardClick}
              onSignup={handleSignup}
            />
          ))}
        </div>

        {/* 加载中（首次） */}
        {loading && activityList.length === 0 && (
          <div className="activity-loading">
            <Loading>加载中...</Loading>
          </div>
        )}

        {/* 加载更多中 */}
        {loadingMore && (
          <div className="activity-loading">
            <Loading>加载中...</Loading>
          </div>
        )}

        {/* 空状态 */}
        {!loading && activityList.length === 0 && (
          <Empty description="暂无活动" />
        )}

        {/* 没有更多 */}
        {!loading && activityList.length > 0 && page >= totalPage && (
          <div className="activity-no-more">已加载全部</div>
        )}
      </div>
    </div>
  )
}

export default Activity
