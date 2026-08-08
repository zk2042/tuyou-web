//+ Mock通用工具函数

//+ 生成指定范围内的随机整数
export const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min

//+ 从数组中随机选取一项
export const randomItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

//+ 生成指定范围内的随机日期字符串（格式：YYYY-MM-DD HH:mm）
export const randomDate = (daysAgo: number = 30): string => {
  const days = randomInt(0, daysAgo)
  const date = new Date()
  date.setDate(date.getDate() - days)
  date.setHours(randomInt(6, 22))
  date.setMinutes(randomInt(0, 59))
  return date.toISOString().slice(0, 16).replace('T', ' ')
}

//+ 生成分页响应数据
export const createPageResponse = <T>(items: T[], page: number, size: number) => {
  const total = items.length
  const start = (page - 1) * size
  const end = start + size
  return {
    list: items.slice(start, end),
    total,
    page,
    size,
    total_page: Math.ceil(total / size)
  }
}

//+ 构造成功响应
export const successResponse = <T>(data: T) => ({
  code: 0,
  message: '成功',
  data
})

//+ 构造错误响应
export const errorResponse = (message: string, code: number = -1) => ({
  code,
  message,
  data: null
})
