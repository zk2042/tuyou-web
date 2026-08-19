//+ 横向日期滚动条组件（受控）
//+ 场景：活动搜索页顶部的日期选择条，展示从今天起 N 天的日期
//+ 与 CalendarPopup 配合使用：点击日历图标弹出完整日历选择任意日期
//+ 受控接口：value (YYYY-MM-DD) + onChange
import { useMemo, useRef, useEffect } from 'react'
import { Clock } from '@nutui/icons-react'
import './index.less'

interface DateScrollerProps {
  //+ 当前选中日期 YYYY-MM-DD（受控）
  value: string
  //+ 选择日期回调
  onChange: (date: string) => void
  //+ 点击日历图标回调（调用方打开 CalendarPopup）
  onOpenCalendar?: () => void
  //+ 展示天数，默认 30
  daysToShow?: number
  //+ 起始日期偏移（0=今天，1=明天），默认 0
  startOffset?: number
}

//+ 星期表头
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

//+ 格式化 YYYY-MM-DD
const formatDate = (d: Date): string => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const DateScroller = ({
  value,
  onChange,
  onOpenCalendar,
  daysToShow = 30,
  startOffset = 0,
}: DateScrollerProps) => {
  const containerRef = useRef<HTMLDivElement>(null)

  //+ 生成 N 天的日期列表
  const dates = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const list: Array<{ date: string; day: number; weekday: string; isToday: boolean; isTomorrow: boolean }> = []
    for (let i = startOffset; i < startOffset + daysToShow; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() + i)
      const date = formatDate(d)
      list.push({
        date,
        day: d.getDate(),
        weekday: WEEKDAYS[d.getDay()],
        isToday: i === 0,
        isTomorrow: i === 1,
      })
    }
    return list
  }, [daysToShow, startOffset])

  //+ value 变化时滚动到选中日期（仅初始/外部触发时滚动，避免点击时跳变）
  useEffect(() => {
    if (!value || !containerRef.current) return
    const idx = dates.findIndex(d => d.date === value)
    if (idx < 0) return
    const item = containerRef.current.children[idx] as HTMLElement
    if (item) {
      //+ 居中滚动
      const containerWidth = containerRef.current.offsetWidth
      const itemLeft = item.offsetLeft
      const itemWidth = item.offsetWidth
      containerRef.current.scrollLeft = itemLeft - (containerWidth - itemWidth) / 2
    }
  }, [value, dates])

  return (
    <div className='date-scroller'>
      {/* 横向日期条 */}
      <div className='date-scroller-list' ref={containerRef}>
        {dates.map(d => (
          <div
            key={d.date}
            className={`date-item ${d.date === value ? 'date-item-active' : ''}`}
            onClick={() => onChange(d.date)}
          >
            <span className='date-item-weekday'>
              {d.isToday ? '今天' : d.isTomorrow ? '明天' : `周${d.weekday}`}
            </span>
            <span className='date-item-day'>{d.day}</span>
            {/* <span className='date-item-month'>{d.date.slice(5, 7)}月</span> */}
          </div>
        ))}
      </div>
      {/* 日历图标按钮：点击打开 CalendarPopup */}
      <div className='date-scroller-calendar-btn' onClick={onOpenCalendar}>
        <Clock className='calendar-icon' />
      </div>
    </div>
  )
}

export default DateScroller
