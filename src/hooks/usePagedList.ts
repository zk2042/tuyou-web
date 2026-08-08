//+ 公共分页 Hook
//+ 适用于：个人中心的 笔记/攻略/收藏/点赞/关注/粉丝/活动 列表，首页 Feed 流也可借鉴
//+ 统一：首次加载（page=1）、上拉加载更多（page+1）、下拉刷新（重置为 page=1）
import { useCallback, useRef, useState } from 'react'
import type { PageResult } from '@/types'

interface UsePagedListOptions<T> {
  /** 请求函数：传入 {page, size}，返回 Promise<{ code, message?, data: PageResult<T> }> */
  fetcher: (params: { page: number; size: number }) => Promise<{
    code: number
    message?: string
    data: PageResult<T>
  }>
  /** 每页数量，默认 10 */
  size?: number
  /** 是否在 mount 时立即请求第一页（默认 false，由用户手动调用 loadFirstPage，以便 Tab 懒加载） */
  immediate?: boolean
  /** 调试标签 */
  debug?: string
}

interface UsePagedListResult<T> {
  list: T[]
  loading: boolean
  hasMore: boolean
  page: number
  totalPage: number
  total: number
  /** 加载第一页（每次切换 Tab 都调用它，确保实时刷新） */
  loadFirstPage: () => Promise<PageResult<T> | null>
  /** 加载下一页（上拉触底调用） */
  loadMore: () => Promise<PageResult<T> | null>
  /** 下拉刷新：同 loadFirstPage，但可作为 usePullDownRefresh 回调 */
  refresh: () => Promise<PageResult<T> | null>
  /** 本地删除一项（用于取消点赞/收藏后从列表移除） */
  removeItem: (predicate: (item: T) => boolean) => void
  /** 本地更新一项（用于点赞后更新本地计数） */
  updateItem: (predicate: (item: T) => boolean, updater: (item: T) => T) => void
  /** 重置列表为空 + hasMore=true + page=1 */
  reset: () => void
}

export function usePagedList<T>(options: UsePagedListOptions<T>): UsePagedListResult<T> {
  const { fetcher, size = 10, immediate = false } = options

  const [list, setList] = useState<T[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [hasMore, setHasMore] = useState<boolean>(true)
  const [page, setPage] = useState<number>(1)
  const [totalPage, setTotalPage] = useState<number>(0)
  const [total, setTotal] = useState<number>(0)

  const loadLockRef = useRef(false)

  const reset = useCallback(() => {
    setList([])
    setLoading(false)
    setHasMore(true)
    setPage(1)
    setTotalPage(0)
    setTotal(0)
  }, [])

  const loadFirstPage = useCallback(async (): Promise<PageResult<T> | null> => {
    if (loadLockRef.current) return null
    loadLockRef.current = true
    setLoading(true)
    try {
      const res = await fetcher({ page: 1, size })
      if (res.code === 0 || res.code === 200) {
        const payload = res.data as PageResult<T>
        setList(payload.list || [])
        setPage(payload.page)
        setTotalPage(payload.total_page)
        setTotal(payload.total)
        setHasMore(payload.page < payload.total_page)
        return payload
      }
      return null
    } finally {
      setLoading(false)
      loadLockRef.current = false
    }
  }, [fetcher, size])

  const loadMore = useCallback(async (): Promise<PageResult<T> | null> => {
    if (loadLockRef.current) return null
    if (!hasMore || loading) return null
    loadLockRef.current = true
    setLoading(true)
    try {
      const nextPage = page + 1
      const res = await fetcher({ page: nextPage, size })
      if (res.code === 0 || res.code === 200) {
        const payload = res.data as PageResult<T>
        setList(prev => [...prev, ...(payload.list || [])])
        setPage(payload.page)
        setTotalPage(payload.total_page)
        setTotal(payload.total)
        setHasMore(payload.page < payload.total_page)
        return payload
      }
      return null
    } finally {
      setLoading(false)
      loadLockRef.current = false
    }
  }, [fetcher, size, page, hasMore, loading])

  const refresh = loadFirstPage

  const removeItem = useCallback((predicate: (item: T) => boolean) => {
    setList(prev => prev.filter(i => !predicate(i)))
  }, [])

  const updateItem = useCallback((predicate: (item: T) => boolean, updater: (item: T) => T) => {
    setList(prev => prev.map(i => (predicate(i) ? updater(i) : i)))
  }, [])

  // immediate=true 时在 mount 时自动加载第一页
  const didImmediateRef = useRef(false)
  if (immediate && !didImmediateRef.current) {
    didImmediateRef.current = true
    ;(async () => {
      await loadFirstPage()
    })()
  }

  return {
    list,
    loading,
    hasMore,
    page,
    totalPage,
    total,
    loadFirstPage,
    loadMore,
    refresh,
    removeItem,
    updateItem,
    reset
  }
}
