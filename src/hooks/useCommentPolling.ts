//+ 评论点赞数轮询 Hook
//+ 用途：在笔记/攻略详情页挂载，定时拉取评论列表与本地 diff，只 patch likeCount 变化项
//+ 设计：
//+   1. 轮询间隔 15s，平衡实时性与流量
//+   2. 页面切后台暂停轮询，切回恢复（visibilitychange）
//+   3. 离开详情页 / targetType|targetId 变化 → cleanup 清除定时器并 abort 未完成请求
//+   4. 首次进入延迟 1s 再 tick：等 fetchComments 完成写 state，避免立即 tick 时 state 还是上一个详情页的 target
//+   5. dispatch(pollCommentUpdates()) 内部会 diff + 跳过乐观更新的评论
//+   6. thunk 携带 target，fulfilled 时校验是否仍为当前 state 的 target，不匹配则丢弃
import { useEffect, useRef } from 'react'
import { useDispatch } from 'react-redux'
import type { AppDispatch } from '@/store'
import { pollCommentUpdates } from '@/store/modules/comment'

const POLL_INTERVAL = 15000  //+ 15s 轮询
const INITIAL_DELAY = 1000   //+ 首次延迟：等 fetchComments 把新 target 写入 state

//+ targetType: 1=笔记，2=攻略；targetId: 内容 id
//+ 任一为空（null/空字符串）时不启动轮询
export function useCommentPolling(
  targetType: number | null,
  targetId: string | null | undefined
) {
  const dispatch = useDispatch<AppDispatch>()
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const initialTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  //+ 当前轮询请求的 promise：cleanup 时 abort，避免离开页面后旧请求覆盖新页数据
  const pendingPromiseRef = useRef<{ abort: () => void } | null>(null)

  useEffect(() => {
    //+ 未进入详情页 / id 无效 → 不轮询
    if (targetType == null || !targetId) return

    const tick = () => {
      //+ abort 上一次未完成的轮询，避免堆积
      pendingPromiseRef.current?.abort()
      const promise = dispatch(pollCommentUpdates())
      pendingPromiseRef.current = promise
      //+ settled 后清空引用，避免误 abort 已完成的 promise
      promise.then(() => {
        if (pendingPromiseRef.current === promise) {
          pendingPromiseRef.current = null
        }
      })
    }

    //+ 首次延迟 tick：等 fetchComments 完成写入 state（resetComments + fulfilled）
    //+ 否则立即 tick 时 state 还是上一个详情页的 target，pollCommentUpdates 会请求旧 target
    initialTimerRef.current = setTimeout(tick, INITIAL_DELAY)
    timerRef.current = setInterval(tick, POLL_INTERVAL)

    //+ 页面切后台暂停，切回恢复
    const onVisibility = () => {
      if (document.hidden) {
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
        if (initialTimerRef.current) {
          clearTimeout(initialTimerRef.current)
          initialTimerRef.current = null
        }
      } else if (!timerRef.current) {
        //+ 切回前台：立即 tick + 重启定时器
        tick()
        timerRef.current = setInterval(tick, POLL_INTERVAL)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      if (initialTimerRef.current) {
        clearTimeout(initialTimerRef.current)
        initialTimerRef.current = null
      }
      //+ abort 离开页面时仍在 pending 的轮询请求
      pendingPromiseRef.current?.abort()
      pendingPromiseRef.current = null
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [dispatch, targetType, targetId])
}
