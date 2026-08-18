//+ 日历弹窗组件（受控）
//+ 场景：活动搜索页通过日历选择任意日期；与 DateScroller 配合使用
//+ 纯前端组件，不涉及网络请求：传入 value（YYYY-MM-DD）→ onChange 回调
//+ 支持：月份切换、当日高亮、选中态高亮、未来日期可选（默认范围由父组件控制）
import { Popup } from '@nutui/nutui-react'
import { Close } from '@nutui/icons-react'
import { useEffect, useMemo, useState } from 'react'
import './index.less'

interface CalendarPopupProps {
  //+ 是否显示
  visible: boolean
  //+ 当前选中日期 YYYY-MM-DD（受控）
  value?: string
  //+ 选择日期回调
  onChange: (date: string) => void
  //+ 关闭回调
  onClose: () => void
  //+ 可选最早日期 YYYY-MM-DD（默认今天）
  minDate?: string
  //+ 可选最晚日期 YYYY-MM-DD（默认 6 个月后）
  maxDate?: string
}

//+ 星期表头
const WEEK_HEADERS = ['日', '一', '二', '三', '四', '五', '六']

//+ 格式化 YYYY-MM-DD（兼容 iOS Safari 不支持 YYYY-MM-DD 解析）
const formatDate = (d: Date): string => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

//+ 解析 YYYY-MM-DD 为 Date（避免时区偏移，使用本地午夜）
const parseDate = (s: string): Date => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

const CalendarPopup = ({
  visible,
  value,
  onChange,
  onClose,
  minDate,
  maxDate,
}: CalendarPopupProps) => {
  //+ 当前展示的月份（年/月）
  const today = useMemo(() => {
    const t = new Date()
    return new Date(t.getFullYear(), t.getMonth(), t.getDate())
  }, [])
  const minD = minDate ? parseDate(minDate) : today
  const maxD = maxDate ? parseDate(maxDate) : new Date(today.getFullYear(), today.getMonth() + 6, today.getDate())

  //+ 当前显示的月份：value 有值时默认 value 所在月，否则今天所在月
  const [viewYear, setViewYear] = useState(() => {
    if (value) return parseDate(value).getFullYear()
    return today.getFullYear()
  })
  const [viewMonth, setViewMonth] = useState(() => {
    if (value) return parseDate(value).getMonth()
    return today.getMonth()
  })

  //+ visible 切换 + value 变化时同步视图月份
  useEffect(() => {
    if (!visible) return
    if (value) {
      const d = parseDate(value)
      setViewYear(d.getFullYear())
      setViewMonth(d.getMonth())
    } else {
      setViewYear(today.getFullYear())
      setViewMonth(today.getMonth())
    }
  }, [visible, value, today])

  //+ 计算当前月日历网格（含前补/后补）
  const days = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1)
    const startOffset = firstDay.getDay() // 0=周日
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const cells: Array<{ date: string | null; day: number; disabled: boolean; isToday: boolean }> = []

    //+ 前补空位（让 1 号对齐正确的星期列）
    for (let i = 0; i < startOffset; i++) {
      cells.push({ date: null, day: 0, disabled: true, isToday: false })
    }
    //+ 当月每一天
    for (let d = 1; d <= daysInMonth; d++) {
      const date = formatDate(new Date(viewYear, viewMonth, d))
      const dateObj = parseDate(date)
      const disabled = dateObj < minD || dateObj > maxD
      const isToday = dateObj.getTime() === today.getTime()
      cells.push({ date, day: d, disabled, isToday })
    }
    return cells
  }, [viewYear, viewMonth, minD, maxD, today])

  //+ 上一月
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear(y => y - 1)
      setViewMonth(11)
    } else {
      setViewMonth(m => m - 1)
    }
  }
  //+ 下一月
  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear(y => y + 1)
      setViewMonth(0)
    } else {
      setViewMonth(m => m + 1)
    }
  }

  //+ 点击日期
  const handleSelect = (date: string, disabled: boolean) => {
    if (disabled) return
    onChange(date)
    onClose()
  }

  return (
    <Popup
      visible={visible}
      onClose={onClose}
      position='bottom'
      closeable
      closeIcon={<Close className='calendar-close' />}
      closeIconPosition='top-right'
      duration={200}
      round
    >
      <div className='calendar-popup'>
        {/* 月份切换 */}
        <div className='calendar-header'>
          <span className='calendar-arrow' onClick={handlePrevMonth}>‹</span>
          <span className='calendar-month-label'>{viewYear}年{viewMonth + 1}月</span>
          <span className='calendar-arrow' onClick={handleNextMonth}>›</span>
        </div>
        {/* 星期表头 */}
        <div className='calendar-weekdays'>
          {WEEK_HEADERS.map(w => (
            <span key={w} className='calendar-weekday'>{w}</span>
          ))}
        </div>
        {/* 日期网格 */}
        <div className='calendar-grid'>
          {days.map((cell, idx) => (
            <div
              key={idx}
              className={`calendar-cell ${cell.date ? '' : 'calendar-cell-empty'} ${cell.date === value ? 'calendar-cell-selected' : ''} ${cell.isToday ? 'calendar-cell-today' : ''} ${cell.disabled ? 'calendar-cell-disabled' : ''}`}
              onClick={() => cell.date && handleSelect(cell.date, cell.disabled)}
            >
              {cell.day || ''}
            </div>
          ))}
        </div>
      </div>
    </Popup>
  )
}

export default CalendarPopup
