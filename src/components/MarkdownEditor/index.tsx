import React, { useState, useRef, useCallback, useEffect } from 'react'
import Taro from '@tarojs/taro'
import Toolbar from './Toolbar'
import TabBar from './TabBar'
import EditView from './EditView'
import Preview from './Preview'
import WordCount from './WordCount'
import { useMarkdownInsert } from '@/hooks/useMarkdownInsert'
import type { CursorPos } from '@/types/markdown'
import './index.less'

export interface MarkdownEditorProps {
  value: string
  onChange: (v: string) => void
  /** 字符上限（默认 2000），超出时 slice + Toast 提示 */
  maxLength?: number
  /** 编辑/预览区最小高度 */
  minHeight?: string | number
  /** 只读模式（不允许编辑，仅显示 TabBar 的"预览"） */
  readOnly?: boolean
  /** 字数变化回调 */
  onWordCountChange?: (count: { chars: number; lines: number }) => void
  placeholder?: string
}

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({
  value,
  onChange,
  maxLength = 2000,
  minHeight = '320px',
  readOnly = false,
  onWordCountChange
}) => {
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [cursor, setCursor] = useState<CursorPos>({ start: 0, end: 0 })
  const textareaRefRef = useRef<React.RefObject<any> | null>(null)
  const selSyncRef = useRef<((s: number, e: number) => void) | null>(null)
  const [selToken, setSelToken] = useState(0)
  const [warned, setWarned] = useState(false)

  const chars = value?.length || 0
  const lines = value ? (String(value).match(/\n/g)?.length || 0) + 1 : 0

  // 字数变化通知父组件
  useEffect(() => {
    onWordCountChange?.({ chars, lines })
  }, [chars, lines, onWordCountChange])

  // maxLength 限制：每次 onChange 前截断，超过 Toast 提示（只提示一次避免刷屏）
  const handleChange = useCallback((v: string) => {
    const ml = maxLength || 0
    let final = v
    let over = false
    if (ml > 0 && v.length > ml) {
      final = v.slice(0, ml)
      over = true
    }
    if (over && !warned) {
      Taro.showToast({ title: `内容不能超过 ${ml} 字，已自动截断`, icon: 'none' })
      setWarned(true)
    }
    if (!over) setWarned(false)
    onChange(final)
  }, [maxLength, onChange, warned])

  // 接收 EditView 暴露的 sync 回调
  const onSelectionChangeSync = useCallback((cb: (s: number, e: number) => void) => {
    selSyncRef.current = cb
  }, [])

  const onTextareaRef = useCallback((ref: React.RefObject<any>) => {
    textareaRefRef.current = ref
  }, [])

  // setSelection：调用 EditView 的回调，然后用 token 触发小程序端 state 应用
  const setSelection = useCallback((s: number, e?: number) => {
    const end = typeof e === 'number' ? e : s
    selSyncRef.current?.(s, end)
    setSelToken(t => (t + 1) % 1000000)
  }, [])

  const focus = useCallback(() => {
    const ref = textareaRefRef.current?.current as any
    if (!ref) return
    const realEl = (ref.nativeElement || ref.querySelector?.('textarea') || ref) as HTMLTextAreaElement | null
    realEl?.focus?.()
  }, [])

  const { insert, handleKeyDown } = useMarkdownInsert({
    value,
    onChange: handleChange,
    cursor,
    setCursor,
    setSelection,
    focus
  })

  const actualMode: 'edit' | 'preview' = readOnly ? 'preview' : mode

  return (
    <div className="md-editor">
      {/* 只读模式下不显示工具栏（无编辑意义） */}
      {!readOnly && (
        <Toolbar onAction={insert} disabled={actualMode !== 'edit'} />
      )}
      {/* 只读模式下仍显示 TabBar，但切换按钮会保持在"预览"状态 */}
      <TabBar
        mode={actualMode}
        onChange={setMode}
        disabled={readOnly}
      />
      {actualMode === 'edit' ? (
        <EditView
          value={value}
          onChange={handleChange}
          onCursorChange={setCursor}
          minHeight={minHeight}
          readOnly={readOnly}
          maxLength={maxLength}
          selectionToken={selToken}
          onSelectionChangeSync={onSelectionChangeSync}
          onKeyDown={handleKeyDown}
          onTextareaRef={onTextareaRef}
        />
      ) : (
        <Preview value={value} minHeight={minHeight} />
      )}
      <WordCount chars={chars} maxChars={maxLength} lines={lines} />
    </div>
  )
}

export default MarkdownEditor
