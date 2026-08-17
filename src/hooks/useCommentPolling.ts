//+ 评论点赞数轮询 Hook
//+ 用途：在笔记/攻略详情页挂载，定时拉取评论列表与本地 diff，只 patch likeCount 变化项
//+ 设计：
//+   1. 轮询间隔 15s，平衡实时性与流量
//+   2. 页面切后台暂停轮询，切回恢复（visibilitychange）
//+   3. 离开详情页 / targetType|targetId 变化 → cleanup 清除定时器
//+   4. 首次进入立即 tick 一次，再起定时器
//+   5. dispatch(pollCommentUpdates()) 内部会 diff + 跳过乐观更新的评论
import { useEffect, useRef } from 'react'
import { useDispatch } from 'react-redux'
import type { AppDispatch } from '@/store'
import { pollCommentUpdates } from '@/store/modules/comment'

const POLL_INTERVAL = 15000  //+ 15s 轮询

//+ targetType: 1=笔记，2=攻略；targetId: 内容 id
//+ 任一为空（null/空字符串）时不启动轮询
export function useCommentPolling(
  targetType: number | null,
  targetId: string | null | undefined
) {
  const dispatch = useDispatch<AppDispatch>()
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    //+ 未进入详情页 / id 无效 → 不轮询
    if (targetType == null || !targetId) return

    const tick = () => {
      dispatch(pollCommentUpdates())
    }

    //+ 立即跑一次，再起定时器
    tick()
    timerRef.current = setInterval(tick, POLL_INTERVAL)

    //+ 页面切后台暂停，切回恢复
    const onVisibility = () => {
      if (document.hidden) {
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
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
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [dispatch, targetType, targetId])
}
