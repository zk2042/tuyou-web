/**
 * 富文本编辑区（H5 contentEditable）
 * =============================================================
 * 负责：
 *   - 把 value（HTML 字符串）初始化到 contentEditable div
 *   - 监听 input/blur 事件 → 取 innerHTML 给 onChange
 *   - 暴露 ref 给父组件（用于 execCommand 作用在当前 document 上）
 *   - 暴露 focus/saveSelection/restoreSelection 辅助（用于 toolbar 按钮时保选区）
 *
 * 非 H5 环境下退化为普通输入说明（小程序端本方案暂未实现，只做 H5 先）
 */
import React, { useRef, useEffect, useCallback, useImperativeHandle, forwardRef, useState } from 'react'
import Taro from '@tarojs/taro'

export interface EditorViewProps {
  value: string
  onChange: (html: string) => void
  minHeight?: string | number
  readOnly?: boolean
  placeholder?: string
  /** 首次挂载后是否自动 focus */
  autoFocus?: boolean
}

export interface EditorViewRef {
  getRoot: () => HTMLDivElement | null
  /** 确保 focus 在编辑区内（execCommand 前置条件） */
  focus: () => void
  /** 保存当前选区（跨 blur 前用，本实现通过 onMouseDown preventDefault 已经不需要，兜底保留） */
  saveSelection: () => void
  /** 恢复保存的选区 */
  restoreSelection: () => void
}

const isWeb = Taro.getEnv() === Taro.ENV_TYPE.WEB

const EditorView = forwardRef<EditorViewRef, EditorViewProps>(({
  value,
  onChange,
  minHeight,
  readOnly = false,
  placeholder,
  autoFocus = false,
}, ref) => {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const savedRangeRef = useRef<Range | null>(null)
  const [isEmpty, setIsEmpty] = useState(!value)

  // 将 value（HTML）同步到 DOM，但只有在外部传的 value 与当前 innerHTML 不同时才覆盖，避免光标跳回末尾
  const lastOuterHtml = useRef<string>('')
  useEffect(() => {
    if (!isWeb || !rootRef.current) return
    const cur = rootRef.current.innerHTML
    const outer = value ?? ''
    if (outer !== lastOuterHtml.current && outer !== cur) {
      rootRef.current.innerHTML = outer
      lastOuterHtml.current = outer
    }
    setIsEmpty(rootRef.current.innerText.trim() === '' && !rootRef.current.querySelector('img,hr'))
  }, [value])

  // 首次 focus
  useEffect(() => {
    if (!isWeb) return
    if (autoFocus && rootRef.current) {
      setTimeout(() => rootRef.current?.focus(), 0)
    }
  }, [autoFocus])

  const emitChange = useCallback(() => {
    if (!isWeb || !rootRef.current) return
    const html = rootRef.current.innerHTML
    lastOuterHtml.current = html
    setIsEmpty(rootRef.current.innerText.trim() === '' && !rootRef.current.querySelector('img,hr'))
    onChange(html)
  }, [onChange])

  // 暴露给父组件的方法
  useImperativeHandle(ref, (): EditorViewRef => ({
    getRoot: () => (isWeb ? rootRef.current : null),
    focus: () => {
      if (!isWeb || !rootRef.current) return
      rootRef.current.focus({ preventScroll: false } as any)
      // 把光标移到末尾
      const el = rootRef.current
      if (window.getSelection && document.createRange) {
        const sel = window.getSelection()
        const range = document.createRange()
        range.selectNodeContents(el)
        range.collapse(false)
        sel?.removeAllRanges()
        sel?.addRange(range)
      }
    },
    saveSelection: () => {
      if (!isWeb) return
      const sel = window.getSelection?.()
      if (sel && sel.rangeCount > 0) savedRangeRef.current = sel.getRangeAt(0).cloneRange()
    },
    restoreSelection: () => {
      if (!isWeb) return
      const sel = window.getSelection?.()
      if (!sel || !savedRangeRef.current) return
      sel.removeAllRanges()
      sel.addRange(savedRangeRef.current)
    },
  }))

  const h = (() => {
    if (typeof minHeight === 'number') return `${minHeight}px`
    if (typeof minHeight === 'string' && minHeight) return minHeight
    return '320px'
  })()

  if (!isWeb) {
    // 小程序端先降级为一个说明占位（方案 B H5 优先）
    return (
      <div className="md-edit-view md-editor-fallback" style={{ minHeight: h, padding: '12px 16px' }}>
        富文本编辑器当前仅支持 H5 / App 端，小程序端可在"发布内容"页面内以纯文本方式编辑。
      </div>
    )
  }

  return (
    <div className="md-edit-view" style={{ minHeight: h, position: 'relative' }}>
      {isEmpty && !readOnly && (
        <div
          className="md-ph"
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            top: 12,
            color: '#a3abc0',
            fontSize: 15,
            lineHeight: 1.7,
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          {placeholder || '支持粗体/斜体/下划线/删除线/字号/列表，回车分段/Shift+回车换行'}
        </div>
      )}
      <div
        ref={rootRef}
        className="md-textarea md-richtext-root"
        contentEditable={!readOnly}
        suppressContentEditableWarning
        style={{
          minHeight: h,
          fontFamily: 'inherit',
          padding: '12px 16px',
          fontSize: 15,
          lineHeight: 1.75,
          color: '#1f2329',
          background: '#fff',
          boxSizing: 'border-box',
          width: '100%',
          wordBreak: 'break-word',
          outline: 'none',
        }}
        onInput={emitChange}
        onKeyDown={(e) => {
          // 统一控制换行：
          //   Enter      → 分段（插入新段落，execCommand('insertParagraph')）
          //   Shift+Enter → 软换行（同段内<br/>）
          //   移动端软键盘"换行"键也会触发 Enter keyCode，所以同样处理
          if (!e.isComposing && (e.key === 'Enter' || e.keyCode === 13)) {
            if (e.shiftKey) {
              e.preventDefault()
              document.execCommand('insertLineBreak', false)
            } else {
              e.preventDefault()
              // insertParagraph 在 Chrome/移动 Safari 都会包成新段（默认 P）
              const ok = document.execCommand('insertParagraph', false)
              if (!ok) document.execCommand('insertHTML', false, '<p><br></p>')
            }
            // 立即同步内容
            requestAnimationFrame(emitChange)
          }
          void emitChange
        }}
        onBeforeInput={(e) => {
          // 移动端 IOS 中文 IME 可能吞换行；这里捕获 beforeinput insertParagraph/insertLineBreak 兜底
          const inputType = (e as any).inputType
          if (inputType === 'insertParagraph' || inputType === 'insertLineBreak') {
            // 允许默认行为，但确保之后 emit
            requestAnimationFrame(emitChange)
          }
        }}
        onBlur={(e) => {
          // 失焦前保存选区（极端情况下兜底）
          savedRangeRef.current = (() => {
            const sel = window.getSelection?.()
            if (!sel || sel.rangeCount === 0) return null
            const range = sel.getRangeAt(0)
            // 只有选区仍然在编辑区内时才保留
            if (!rootRef.current) return null
            return rootRef.current.contains(range.startContainer) ? range.cloneRange() : null
          })()
          // blur 也同步一次 HTML（防止点击外部没触发 input）
          emitChange()
          void e
        }}
      />
    </div>
  )
})

EditorView.displayName = 'EditorView'
export default EditorView
