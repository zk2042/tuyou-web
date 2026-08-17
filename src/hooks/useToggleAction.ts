//+ 通用 Toggle 操作 Hook（点赞/收藏/关注等）
//+ 抽取自 NoteDetail/ActivityDetail 的 promiseRef + cooldownRef 模式
//+ 提供：请求锁（防狂点）、AbortController（丢弃过期请求）、操作冷却（防接口响应极快时串行狂点）
//+ 适用于：关注/粉丝列表、收藏列表、点赞列表等列表页的 toggle 操作
import { useCallback, useEffect, useRef, useState } from 'react'

//+ 操作冷却时间：800ms 内重复点击直接拦截
const COOLDOWN_MS = 800

interface ToggleResult {
  /** 请求是否成功（业务码 0/200） */
  ok: boolean
  /** 接口返回的数据（成功时），失败时为 undefined */
  data?: any
  /** 是否被 AbortController 主动取消（不计入业务错误） */
  wasAborted: boolean
  /** 错误消息（失败且非 abort 时） */
  error?: string
}

interface UseToggleActionOptions {
  /**
   * 实际的 API 调用函数
   * 接收 AbortSignal，用于 abort 过期请求
   * 返回统一响应结构 { code, message, data }
   */
  apiFn: (id: string, signal: AbortSignal) => Promise<{ code: number; message?: string; data?: any }>
}

export function useToggleAction(options: UseToggleActionOptions) {
  const { apiFn } = options
  //+ 请求锁：key = resKey，value = AbortController
  //+ 作用1：has(key) 即请求中，拦截重复点击；作用2：abort 上一个同资源请求
  const controllerRef = useRef<Map<string, AbortController>>(new Map())
  //+ 操作冷却：key = resKey，value = 过期时间戳
  const cooldownRef = useRef<Map<string, number>>(new Map())
  //+ loading 状态：用 useState 触发组件重渲染，便于按钮置灰
  //+ 存储正在请求中的 resKey 集合（对象形式，便于按 key 读取）
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({})

  //+ 离开页面时 abort 所有未完成请求，清理冷却
  useEffect(() => {
    return () => {
      controllerRef.current.forEach(c => c.abort())
      controllerRef.current.clear()
      cooldownRef.current.clear()
    }
  }, [])

  //+ 执行 toggle 操作
  //+ resKey：资源唯一标识，如 `follow:${id}`；id：传给 apiFn 的参数
  const toggle = useCallback(async (resKey: string, id: string): Promise<ToggleResult> => {
    //+ 冷却期内直接拦截
    const cd = cooldownRef.current.get(resKey)
    if (cd && Date.now() < cd) {
      return { ok: false, wasAborted: true, error: 'cooldown' }
    }

    //+ abort 上一个同资源请求（快速交替点击场景）
    const prev = controllerRef.current.get(resKey)
    if (prev) prev.abort()

    //+ 新建 AbortController 并登记 + 设置 loading
    const controller = new AbortController()
    controllerRef.current.set(resKey, controller)
    setLoadingMap(prev => ({ ...prev, [resKey]: true }))

    let wasAborted = false
    try {
      const res = await apiFn(id, controller.signal)
      const ok = res.code === 0 || res.code === 200
      return { ok, data: res.data, wasAborted: false, error: ok ? undefined : res.message }
    } catch (err: any) {
      if (err?.name === 'AbortError' || controller.signal.aborted) {
        wasAborted = true
        return { ok: false, wasAborted: true }
      }
      return { ok: false, wasAborted: false, error: err?.message || '网络错误' }
    } finally {
      if (controllerRef.current.get(resKey) === controller) {
        controllerRef.current.delete(resKey)
      }
      setLoadingMap(prev => {
        const next = { ...prev }
        delete next[resKey]
        return next
      })
      //+ 非 abort 时设置冷却（abort 不计冷却，允许立即重试）
      if (!wasAborted) {
        const expires = Date.now() + COOLDOWN_MS
        cooldownRef.current.set(resKey, expires)
        setTimeout(() => {
          if (cooldownRef.current.get(resKey) === expires) {
            cooldownRef.current.delete(resKey)
          }
        }, COOLDOWN_MS + 50)
      }
    }
  }, [apiFn])

  //+ 判断某资源是否请求中（用于按钮置灰 loading）
  const isLoading = useCallback((resKey: string) => {
    return !!loadingMap[resKey]
  }, [loadingMap])

  return { toggle, isLoading }
}
