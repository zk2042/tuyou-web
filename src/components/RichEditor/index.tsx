//+ 富文本编辑器（contenteditable）
//+ ==============================================================
//+ 使用原生 contenteditable 编辑 HTML，H5 移动端兼容性好
//+
//+ 对外 props：
//+   value     —— HTML 字符串
//+   onChange  —— (html: string) => void
//+   maxLength —— 纯文本字数上限
//+   minHeight / readOnly / placeholder
import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import Taro from '@tarojs/taro'
import { sanitizeHtml, htmlToText } from '@/utils/html'
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

const RichEditor: React.FC<RichEditorProps> = ({
  value = '',
  onChange,
  maxLength,
  minHeight,
  readOnly = false,
  placeholder,
  autoFocus = false,
}) => {
  //+ contenteditable 容器 ref
  const editableRef = useRef<HTMLDivElement>(null)
  //+ 回调 ref（避免 stale closure）
  const onChangeRef = useRef(onChange)
  const maxLengthRef = useRef(maxLength)
  //+ 初始化标记（防止初始 setHtml 触发 onChange）
  const initializedRef = useRef(false)
  //+ 内部变更标记（区分用户输入 vs 外部 value 变化）
  const isInternalChangeRef = useRef(false)
  const truncatedRef = useRef(false)
  const [textLen, setTextLen] = useState(0)

  //+ 保持 ref 最新
  onChangeRef.current = onChange
  maxLengthRef.current = maxLength

  //+ 计算 min-height
  const minHeightStr = useMemo(() => {
    if (typeof minHeight === 'number') return `${minHeight}px`
    if (typeof minHeight === 'string' && minHeight) return minHeight
    return '320px'
  }, [minHeight])

  //+ ===== 同步内容到 onChange + 字数统计 =====
  const syncContent = useCallback(() => {
    const el = editableRef.current
    if (!el) return
    const rawHtml = el.innerHTML
    const safe = sanitizeHtml(rawHtml)
    const text = htmlToText(safe)
    setTextLen(text.length)

    const ml = maxLengthRef.current
    if (ml && text.length > ml) {
      if (!truncatedRef.current) {
        truncatedRef.current = true
        Taro.showToast?.({ title: `内容最多 ${ml} 字`, icon: 'none', duration: 1800 })
        setTimeout(() => { truncatedRef.current = false }, 1500)
      }
    }

    //+ 标记为内部变更，防止 value prop 回流导致光标跳
    isInternalChangeRef.current = true
    onChangeRef.current?.(safe)
  }, [])

  //+ ===== 初始化：设置初始 HTML =====
  useEffect(() => {
    if (!isWeb || !editableRef.current) return
    const initHtml = value ? sanitizeHtml(value) : '<p><br></p>'
    editableRef.current.innerHTML = initHtml
    setTextLen(htmlToText(initHtml).length)
    initializedRef.current = true

    if (autoFocus) {
      editableRef.current.focus()
    }

    return () => {
      initializedRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  //+ ===== 外部 value 变化时同步到编辑器 =====
  useEffect(() => {
    if (!isWeb) return
    const el = editableRef.current
    if (!el || !initializedRef.current) return

    //+ 如果是用户输入触发的 onChange → value 回流，跳过
    if (isInternalChangeRef.current) {
      isInternalChangeRef.current = false
      return
    }

    //+ 外部设置的 value（如表单重置）
    const newHtml = value ? sanitizeHtml(value) : '<p><br></p>'
    const currentHtml = sanitizeHtml(el.innerHTML)
    if (newHtml !== currentHtml) {
      el.innerHTML = newHtml
      setTextLen(htmlToText(newHtml).length)
    }
  }, [value])

  //+ ===== 输入事件 =====
  const handleInput = useCallback(() => {
    if (!initializedRef.current) return
    syncContent()
    //+ placeholder 处理：空内容时插入占位
    const el = editableRef.current
    if (el && el.innerHTML === '<br>') {
      el.innerHTML = '<p><br></p>'
    }
  }, [syncContent])

  //+ ===== 换行处理：Enter 段落换行，Shift+Enter 行内换行 =====
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && e.shiftKey) {
      //+ Shift+Enter → 行内换行 <br>
      e.preventDefault()
      document.execCommand('insertLineBreak')
      syncContent()
    }
  }, [syncContent])

  //+ ===== 处理粘贴：清除外部样式，只保留纯文本 =====
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault()
    const text = e.clipboardData.getData('text/plain')
    document.execCommand('insertText', false, text)
    syncContent()
  }, [syncContent])

  if (!isWeb) {
    return (
      <div className="md-editor-fallback" style={{ minHeight: minHeightStr, padding: '12px 16px' }}>
        富文本编辑器当前仅支持 H5 / App 端，小程序端请在发布内容页面以纯文本方式编辑。
      </div>
    )
  }

  return (
    <div className="md-editor md-rich-editor">
      {/* contenteditable 编辑区 */}
      <div
        ref={editableRef}
        className="we-editor-area"
        contentEditable={!readOnly}
        suppressContentEditableWarning
        data-placeholder={placeholder || '输入内容...'}
        style={{ minHeight: minHeightStr }}
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        onBlur={() => syncContent()}
      />

      {/* 字数统计 */}
      <div className="md-wordcount" style={{ color: maxLength && textLen > maxLength ? '#ee0a24' : undefined }}>
        {textLen}{maxLength ? `/${maxLength}` : ''}
      </div>
    </div>
  )
}

export default RichEditor
