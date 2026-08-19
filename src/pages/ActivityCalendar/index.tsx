//+ 活动日历搜索页
//+ 场景：用户按日期查找活动，DateScroller 快速选近期日期，CalendarPopup 选任意日期
//+ 数据流：DateScroller/CalendarPopup 选日期 → selectedDate 变化 → useEffect 触发 loadFirstPage → ActivityCard 列表展示
//+ 分页：容器级 onScroll 触底加载更多（与 Home/Activity 一致，useReachBottom 在容器滚动布局下不触发）
import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import Taro from '@tarojs/taro'
import { Loading, Empty } from '@nutui/nutui-react'
import HeaderNavBar from '@/components/HeaderNavBar'
import DateScroller from '@/components/DateScroller'
import CalendarPopup from '@/components/CalendarPopup'
import ActivityCard from '@/components/ActivityCard'
import { usePagedList } from '@/hooks/usePagedList'
import { getActivityListAPI } from '@/apis/activity'
import type { ActivityListItem, PageResult } from '@/types'
import './index.less'

//+ 格式化今天为 YYYY-MM-DD（DateScroller value 初始值）
const formatToday = (): string => {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const PAGE_SIZE = 10

const ActivityCalendar = () => {
  //+ 当前选中日期（YYYY-MM-DD），默认今天
  const [selectedDate, setSelectedDate] = useState<string>(formatToday())
  //+ CalendarPopup 显隐
  const [calendarVisible, setCalendarVisible] = useState(false)
  //+ 滚动容器 ref
  const scrollRef = useRef<HTMLDivElement>(null)
  //+ 首次渲染标记：避免 useEffect 在 mount 时重复请求（immediate=true 已处理首次加载）
  const isFirstRender = useRef(true)

  //+ 分页列表：按 selectedDate 筛选活动
  //+ fetcher 依赖 selectedDate，日期变化时 useCallback 生成新 fetcher → loadFirstPage 引用更新
  const paged = usePagedList<ActivityListItem>({
    size: PAGE_SIZE,
    fetcher: useCallback(
      async ({ page, size }) => {
        const res = await getActivityListAPI({ date: selectedDate, page, size })
        if (res.code === 0 || res.code === 200) {
          return { code: 0, data: res.data as PageResult<ActivityListItem> }
        }
        return { code: -1, data: { list: [], total: 0, page, size, total_page: 0 } }
      },
      [selectedDate]
    ),
    //+ mount 时立即加载第一页（首次渲染）
    immediate: true,
  })

  const { list, loading, hasMore } = paged

  //+ selectedDate 变化时重新加载第一页（跳过首次渲染，immediate=true 已处理）
  //+ 此时 fetcher 已更新为新日期的闭包，loadFirstPage 会用新 fetcher 请求
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    paged.loadFirstPage()
    //+ eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate])

  //+ 日期切换（DateScroller / CalendarPopup 共用）：仅更新 selectedDate，由 useEffect 触发请求
  const handleDateChange = useCallback((date: string) => {
    setSelectedDate(date)
  }, [])

  //+ 打开/关闭日历弹窗
  const handleOpenCalendar = useCallback(() => setCalendarVisible(true), [])
  const handleCloseCalendar = useCallback(() => setCalendarVisible(false), [])

  //+ 容器级 onScroll 触底加载更多
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

  //+ 点击卡片跳转详情
  const handleCardClick = (activity: ActivityListItem) => {
    Taro.navigateTo({ url: `/pages/ActivityDetail/index?id=${activity.id}` })
  }

  //+ 点击报名按钮：跳转详情页完成报名
  const handleSignup = (activity: ActivityListItem) => {
    Taro.navigateTo({ url: `/pages/ActivityDetail/index?id=${activity.id}` })
  }

  //+ 格式化日期标题（如 "8月18日 周一" / "今天" / "明天"）
  const dateTitle = useMemo(() => {
    if (!selectedDate) return ''
    const [y, m, d] = selectedDate.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    const today = formatToday()
    const tomorrow = (() => {
      const t = new Date()
      t.setDate(t.getDate() + 1)
      const ty = t.getFullYear()
      const tm = String(t.getMonth() + 1).padStart(2, '0')
      const td = String(t.getDate()).padStart(2, '0')
      return `${ty}-${tm}-${td}`
    })()
    if (selectedDate === today) return '今天'
    if (selectedDate === tomorrow) return '明天'
    return `${m}月${d}日 ${weekdays[date.getDay()]}`
  }, [selectedDate])

  return (
    <div className='activity-calendar-page'>
      <HeaderNavBar title='活动日历' fixed={false} cancel={false} />

      {/* 日期选择条 */}
      <DateScroller
        value={selectedDate}
        onChange={handleDateChange}
        onOpenCalendar={handleOpenCalendar}
      />

      {/* 可滚动内容区 */}
      <div className='calendar-content' ref={scrollRef} onScroll={handleScroll}>
        {/* 日期标题 + 活动数量 */}
        <div className='date-header'>
          <span className='date-title'>{dateTitle}</span>
          <span className='date-count'>{list.length > 0 ? `${list.length}个活动` : ''}</span>
        </div>

        {/* 活动列表 */}
        <div className='activity-list'>
          {list.map((activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              onClick={handleCardClick}
              onSignup={handleSignup}
            />
          ))}
        </div>

        {/* 加载中（首次） */}
        {loading && list.length === 0 && (
          <div className='calendar-loading'>
            <Loading>加载中...</Loading>
          </div>
        )}

        {/* 加载更多中 */}
        {loading && list.length > 0 && (
          <div className='calendar-loading'>
            <Loading>加载中...</Loading>
          </div>
        )}

        {/* 空状态 */}
        {!loading && list.length === 0 && (
          <Empty description='该日期暂无活动' />
        )}

        {/* 没有更多 */}
        {!loading && list.length > 0 && !hasMore && (
          <div className='calendar-no-more'>已加载全部</div>
        )}
      </div>

      {/* 日历弹窗 */}
      <CalendarPopup
        visible={calendarVisible}
        value={selectedDate}
        onChange={handleDateChange}
        onClose={handleCloseCalendar}
      />
    </div>
  )
}

export default ActivityCalendar
