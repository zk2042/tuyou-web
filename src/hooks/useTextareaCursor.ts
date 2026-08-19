import { useCallback } from 'react'
import Taro from '@tarojs/taro'
import type { CursorPos } from '@/types/markdown'

/**
 * 双端 Textarea 光标位置读写
 * H5：target.selectionStart/End + setSelectionRange
 * 小程序：通过 onSelectionChange 事件提取；设置由父组件 EditView 维护 selStart/selEnd state，
 *         作为 NutUI Textarea 的 selection-start/selection-end props 传入。
 */
export function useTextareaCursor(
  textareaRef: React.RefObject<any>,
  setSelProps?: (start: number, end: number) => void
) {
  const extractFromEvent = useCallback((e: any): CursorPos => {
    if (!e) return { start: 0, end: 0 }
    const tgt = e.target
    if (tgt && typeof tgt.selectionStart === 'number') {
      return {
        start: Math.max(0, tgt.selectionStart || 0),
        end: Math.max(0, tgt.selectionEnd || tgt.selectionStart || 0)
      }
    }
    const d = e.detail
    if (d) {
      const s = typeof d.selectionStart === 'number'
        ? d.selectionStart
        : (typeof d.cursor === 'number' ? d.cursor : 0)
      const e2 = typeof d.selectionEnd === 'number' ? d.selectionEnd : s
      return { start: Math.max(0, s), end: Math.max(0, e2) }
    }
    return { start: 0, end: 0 }
  }, [])

  const setSelection = useCallback((start: number, end?: number) => {
    const s = Math.max(0, start)
    const e = Math.max(s, typeof end === 'number' ? end : start)
    const isWeb = Taro.getEnv() === Taro.ENV_TYPE.WEB
    if (isWeb && textareaRef?.current) {
      const el = textareaRef.current as any
      const realEl = (el && (el.nativeElement || el.querySelector?.('textarea') || el)) as HTMLTextAreaElement | null
      if (realEl && typeof realEl.setSelectionRange === 'function') {
        try {
          realEl.focus()
          realEl.setSelectionRange(s, e)
        } catch (_) { /* ignore */ }
      }
    }
    setSelProps?.(s, e)
  }, [textareaRef, setSelProps])

  const focus = useCallback(() => {
    const isWeb = Taro.getEnv() === Taro.ENV_TYPE.WEB
    if (isWeb && textareaRef?.current) {
      const el = textareaRef.current as any
      const realEl = (el && (el.nativeElement || el.querySelector?.('textarea') || el)) as HTMLTextAreaElement | null
      realEl?.focus?.()
    }
  }, [textareaRef])

  return { extractFromEvent, setSelection, focus }
}

export default useTextareaCursor
