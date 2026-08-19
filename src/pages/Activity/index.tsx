//+ 活动列表页
//+ 结构：SearchBar 头部 + 筛选区(分类栏 + 日期条 DateScroller) + 活动卡片列表 + CalendarPopup
//+ 筛选：分类(category) + 日期(date) 双条件，任一变化触发 page=1 重新加载
//+ 日期来源：DateScroller(选近期) / CalendarPopup(选任意)，通过 store.setDate 统一同步
//+ 状态：列表/分页/筛选/加载状态归 Store；弹窗显隐等纯 UI 状态留页面内
import { useEffect, useRef, useCallback, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import Taro, { useDidShow } from '@tarojs/taro'
import { Loading, Empty } from '@nutui/nutui-react'
import type { RootState, AppDispatch } from '@/store'
import { fetchActivities, setCategory, setDate } from '@/store/modules/activity'
import SearchBar from '@/components/SearchBar'
import DateScroller from '@/components/DateScroller'
import CalendarPopup from '@/components/CalendarPopup'
import ActivityCard from '@/components/ActivityCard'
import type { ActivityListItem } from '@/types'
import { useAuthGuard } from '@/components/AuthRoute'
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
  useAuthGuard()
  const dispatch: AppDispatch = useDispatch<AppDispatch>()
  //+ 从 store 读取：列表 + 分页 + 双筛选条件(category/date) + 加载状态
  const {
    activityList,
    page,
    totalPage,
    category,
    date,
    loading,
    loadingMore,
  } = useSelector((state: RootState) => state.activity)

  const scrollRef = useRef<HTMLDivElement>(null)
  //+ CalendarPopup 显隐（纯 UI 状态，不进 store）
  const [calendarVisible, setCalendarVisible] = useState(false)

  //+ 加载活动列表（page=1 替换，page>1 追加）
  const loadActivities = useCallback(
    (targetCategory: string, targetPage: number, loadMore: boolean,targetDate?: string, ) => {
      dispatch(
        fetchActivities({
          category: targetCategory === '全部' ? '' : targetCategory,
          date: targetDate==="全部"?'':targetDate,
          page: targetPage,
          size: PAGE_SIZE,
          loadMore,
        })
      )
    },
    [dispatch]
  )

  //+ 首次进入 / 切换分类 / 切换日期：重置 page=1 重新加载
  useEffect(() => {
    loadActivities(category, 1, false, date)
    //+ 依赖 category + date：任一筛选条件变化触发重新加载
    //+ eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, date])

  //+ 切换分类
  const handleCategoryChange = (cat: string) => {
    if (cat === category) return
    dispatch(setCategory(cat))
  }

  //+ 切换日期（DateScroller / CalendarPopup 共用）
  //+ 再次点击已选中日期 = 清除日期筛选（显示全部）
  const handleDateChange = useCallback(
    (nextDate: string) => {
      dispatch(setDate(nextDate === date ? '' : nextDate))
    },
    [dispatch, date]
  )

  //+ 打开 / 关闭 CalendarPopup
  const handleOpenCalendar = useCallback(() => setCalendarVisible(true), [])
  const handleCloseCalendar = useCallback(() => setCalendarVisible(false), [])

  //+ 上拉加载更多（category/date 保持，page+1）
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, clientHeight, scrollHeight } = e.currentTarget
    //+ 距底部 50px 触发，且还有更多数据，且未在加载中
    if (
      scrollHeight - scrollTop - clientHeight < 50 &&
      page < totalPage &&
      !loadingMore &&
      !loading
    ) {
      loadActivities(category,  page + 1, true, date)
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

  //+ 点击取消报名按钮：同样跳转详情页操作（列表页不直接调接口）
  const handleCancelSignup = (activity: ActivityListItem) => {
    Taro.navigateTo({ url: `/pages/ActivityDetail/index?id=${activity.id}` })
  }

  //+ 页面再次显示时刷新列表（文档4.2节方案一：从详情页返回时同步报名状态）
  useDidShow(() => {
    //+ 仅在已有数据时刷新，保留当前筛选条件
    if (activityList.length > 0) {
      loadActivities(category,  1, false, date)
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
        {/* 筛选区（吸顶）：分类栏 + 日期滚动条 */}
        <div className="activity-filter-bar">
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
          {/* 日期筛选条：DateScroller(受控 value=store.date) + 日历图标弹出 CalendarPopup */}
          <DateScroller
            value={date}
            onChange={handleDateChange}
            onOpenCalendar={handleOpenCalendar}
          />
        </div>

        {/* 活动列表 */}
        <div className="activity-list">
          {activityList.map((activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              onClick={handleCardClick}
              onSignup={handleSignup}
              onCancelSignup={handleCancelSignup}
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
          <Empty description={date ? '该日期暂无活动，试试其他日期' : '暂无活动'} />
        )}

        {/* 没有更多 */}
        {!loading && activityList.length > 0 && page >= totalPage && (
          <div className="activity-no-more">已加载全部</div>
        )}
      </div>

      {/* 日历弹窗：选任意日期，确认后写入 store.date 触发筛选 */}
      <CalendarPopup
        visible={calendarVisible}
        value={date || undefined}
        onChange={handleDateChange}
        onClose={handleCloseCalendar}
      />
    </div>
  )
}

export default Activity
