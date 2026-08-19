/**
 * 富文本编辑器（所见即所得）
 * ==============================================================
 * 对外 props 与 MarkdownEditor 保持一致，便于发布页直接替换：
 *   value     —— HTML 字符串（可为空/纯文本，初始化时自动 sanitize）
 *   onChange  —— (html: string) => void   每次编辑触发
 *   maxLength —— 按"纯文本字数"的上限（非 HTML 标签数量），超限 Toast 提示并截断
 *   minHeight / readOnly / placeholder —— 常规语义
 *
 * execCommand 封装：
 *   工具栏 onCommand(cmd, value?) → 内部：
 *     1. ensure focus 在编辑区
 *     2. restoreRange（如果是 blur 场景恢复选区）
 *     3. document.execCommand / formatBlock 等
 *     4. 立即 onChange 同步最新 HTML（execCommand 不会触发 input 事件）
 */
import React, { useRef, useCallback, useEffect, useMemo, useState } from 'react'
import Taro from '@tarojs/taro'
import RichToolbar, { type RichCommand } from './Toolbar'
import EditorView, { type EditorViewRef } from './EditorView'
import {
  sanitizeHtml,
  htmlToText,
  isHtmlEmpty,
  truncateHtmlByText,
  escapeHtml,
} from '@/utils/html'
import './index.less'

export interface RichEditorProps {
  value?: string
  onChange?: (html: string) => void
  maxLength?: number
  minHeight?: string | number
  readOnly?: boolean
  placeholder?: string
  autoFocus?: boolean
}

const isWeb = Taro.getEnv() === Taro.ENV_TYPE.WEB

// execCommand 对应表：除了格式块/引用/代码需要特殊处理
function docExec(cmd: string, value?: string) {
  if (typeof document === 'undefined') return false
  try {
    return document.execCommand(cmd, false, value)
  } catch (_) {
    return false
  }
}

function applyFormatBlock(tag: string) {
  if (typeof document === 'undefined') return false
  // formatBlock 参数在不同浏览器下要求不同，统一传 `<H1>` 这种带尖括号的写法兼容性最好
  const param = `<${tag}>`
  return docExec('formatBlock', param)
}

function applyBlockquote(enable: boolean) {
  if (typeof document === 'undefined') return false
  const sel = window.getSelection?.()
  if (!sel || sel.rangeCount === 0) {
    // 无选区 → 直接插入空 blockquote 段
    return docExec('formatBlock', '<BLOCKQUOTE>')
  }
  if (enable) {
    return docExec('formatBlock', '<BLOCKQUOTE>')
  } else {
    return docExec('formatBlock', '<P>')
  }
  void enable
}

function applyCodeInlineOrBlock() {
  if (typeof document === 'undefined') return false
  const sel = window.getSelection?.()
  if (!sel || sel.rangeCount === 0) return docExec('formatBlock', '<PRE>')
  const range = sel.getRangeAt(0)
  if (range.collapsed) {
    // 空选区 → 代码块
    return docExec('formatBlock', '<PRE>')
  } else {
    // 有选区 → 行内 <code>
    return docExec('insertHTML', `<code>${sel.toString() ? escapeHtml(sel.toString()) : ''}</code>`)
  }
}

const RichEditor: React.FC<RichEditorProps> = ({
  value = '',
  onChange,
  maxLength,
  minHeight,
  readOnly = false,
  placeholder,
  autoFocus = false,
}) => {
  const editorRef = useRef<EditorViewRef | null>(null)
  const truncatedRef = useRef<{ triggered: boolean }>({ triggered: false })
  const [forceUpdateKey, setForceUpdateKey] = useState(0)

  // 初始化时：如果传入的 value 是纯文本（用户历史数据），自动包一层 <p>
  const sanitizedInit = useMemo(() => {
    const v = value ?? ''
    if (!v) return ''
    const safe = sanitizeHtml(v)
    if (isHtmlEmpty(safe)) return ''
    return safe
  }, []) // 只在初次挂载用，后续由受控 value 驱动

  // 实际受控值
  const effectiveValue = (() => {
    const v = value ?? ''
    if (v === '' && sanitizedInit) return sanitizedInit
    return v
  })()

  const textLen = useMemo(() => htmlToText(effectiveValue).length, [effectiveValue])

  // 内部变更回调（每次编辑都做 sanitize + 字限）
  const handleChange = useCallback((rawHtml: string) => {
    let html = sanitizeHtml(rawHtml)
    if (maxLength) {
      const tLen = htmlToText(html).length
      if (tLen > maxLength) {
        const t = truncateHtmlByText(html, maxLength)
        html = t.html
        if (!truncatedRef.current.triggered) {
          truncatedRef.current.triggered = true
          Taro.showToast?.({ title: `内容最多 ${maxLength} 字（已自动截断）`, icon: 'none', duration: 1800 })
          setTimeout(() => { truncatedRef.current.triggered = false }, 1500)
        }
        // 截断后要回写 DOM
        const el = editorRef.current?.getRoot?.()
        if (el && el.innerHTML !== html) el.innerHTML = html
      }
    }
    setForceUpdateKey((k) => k + 1)
    onChange?.(html)
  }, [maxLength, onChange])

  // 执行工具栏命令
  const handleCommand = useCallback((cmd: RichCommand, param?: string) => {
    if (readOnly || !isWeb) return
    const ed = editorRef.current
    if (!ed) return
    const root = ed.getRoot()

    // 1) 优先恢复 Toolbar 在 touchstart 阶段缓存的选区（移动端关键）
    let restoredFromGlobal = false
    const globalSaved = (typeof window !== 'undefined' ? (window as any).__richeditor_saved_range__ : null) as Range | null
    if (globalSaved && root && root.ownerDocument) {
      try {
        const docSel = root.ownerDocument.defaultView?.getSelection?.()
        docSel?.removeAllRanges()
        docSel?.addRange(globalSaved)
        restoredFromGlobal = true
        // 用完清掉，避免下次复用过期选区
        ;(window as any).__richeditor_saved_range__ = null
      } catch (_) { /* ignore */ }
    }

    // 2) focus + 恢复选区（桌面 blur 恢复兜底 / 移动端全局恢复后再保一次）
    if (root && root.ownerDocument) {
      const sel = root.ownerDocument.defaultView?.getSelection?.()
      if (!sel || sel.rangeCount === 0 || !(sel.anchorNode && root.contains(sel.anchorNode))) {
        if (!restoredFromGlobal) ed.restoreSelection()
        const sel2 = window.getSelection?.()
        if (!sel2 || sel2.rangeCount === 0) {
          ed.focus()
        }
      }
      if (document.activeElement !== root) {
        try { root.focus({ preventScroll: true } as any) } catch (_) { /* ignore */ }
      }
    } else {
      ed.focus()
    }

    let ok = false
    switch (cmd) {
      case 'bold': case 'italic': case 'underline': case 'strikethrough':
      case 'insertUnorderedList': case 'insertOrderedList':
        ok = docExec(cmd)
        break
      // 字号三档（对应 HTML 语义块级标签，样式统一在 CSS 里控制 font-size）：
      //   小 → H5  (≈15px)  中 → H3  (≈17px)  大 → H2  (≈19px)
      case 'fontSmall':  ok = applyFormatBlock('h5'); break
      case 'fontMedium': ok = applyFormatBlock('h3'); break
      case 'fontLarge':  ok = applyFormatBlock('h2'); break
    }

    if (ok) {
      // execCommand 改 DOM 后，有些浏览器不会同步触发 input，手动同步
      const now = root?.innerHTML ?? ''
      handleChange(now)
    }
  }, [readOnly, handleChange])

  // 首次挂载：如果外部没有初始 HTML，给个空 <p> 让浏览器直接进段落输入模式
  useEffect(() => {
    if (!isWeb) return
    const el = editorRef.current?.getRoot?.()
    if (!el) return
    if (!value && !el.innerHTML.trim()) {
      el.innerHTML = '<p><br/></p>'
      handleChange(el.innerHTML)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  void forceUpdateKey

  return (
    <div className="md-editor md-rich-editor">
      {/* 工具栏（只读时不展示） */}
      {!readOnly && (
        <RichToolbar
          disabled={!isWeb}
          onCommand={handleCommand}
        />
      )}
      {/* 编辑区 */}
      <EditorView
        ref={editorRef}
        value={effectiveValue}
        onChange={handleChange}
        minHeight={minHeight}
        readOnly={readOnly}
        placeholder={placeholder}
        autoFocus={autoFocus}
      />
      {/* 字数统计（H5 only；给了 maxLength 才显示超限红色） */}
      <div className="md-wordcount" style={{ color: maxLength && textLen > maxLength ? '#ee0a24' : undefined }}>
        {textLen}{maxLength ? `/${maxLength}` : ''}
      </div>
    </div>
  )
}

export default RichEditor
