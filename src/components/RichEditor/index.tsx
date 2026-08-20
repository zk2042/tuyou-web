//+ 富文本编辑器（contenteditable + document.execCommand）
//+ ==============================================================
//+ 不依赖 wangEditor5（v5 无 cmd.do() API，自定义工具栏难以对接）
//+ 改用原生 contenteditable + execCommand，简单可靠，H5 移动端兼容性好
//+
//+ 对外 props 保持不变，发布页无需改动：
//+   value     —— HTML 字符串
//+   onChange  —— (html: string) => void
//+   maxLength —— 纯文本字数上限
//+   minHeight / readOnly / placeholder
import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import Taro from '@tarojs/taro'
import { sanitizeHtml, htmlToText } from '@/utils/html'
import './index.less'

//+ ===== 图标占位常量 =====
const ICON_BOLD = 'B'
const ICON_ITALIC = 'I'
const ICON_UNDERLINE = 'U'
const ICON_STRIKE = 'S'
const ICON_H1 = 'H1'
const ICON_H2 = 'H2'
const ICON_H3 = 'H3'
const ICON_UNORDERED_LIST = '•'
const ICON_ORDERED_LIST = '1.'

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
  //+ 工具栏激活状态（加粗/斜体/下划线/删除线/无序列表/有序列表/当前块标签）
  const [activeStates, setActiveStates] = useState<{
    bold: boolean
    italic: boolean
    underline: boolean
    strikeThrough: boolean
    insertUnorderedList: boolean
    insertOrderedList: boolean
    blockTag: string
  }>({
    bold: false,
    italic: false,
    underline: false,
    strikeThrough: false,
    insertUnorderedList: false,
    insertOrderedList: false,
    blockTag: '',
  })

  //+ 保持 ref 最新
  onChangeRef.current = onChange
  maxLengthRef.current = maxLength

  //+ ===== 查询当前选区的格式状态，更新工具栏激活态 =====
  const updateActiveStates = useCallback(() => {
    if (!editableRef.current) return
    //+ 焦点不在编辑区时，不更新（避免误判）
    if (document.activeElement !== editableRef.current) return
    try {
      const blockValue = document.queryCommandValue('formatBlock') || ''
      setActiveStates({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strikeThrough: document.queryCommandState('strikeThrough'),
        insertUnorderedList: document.queryCommandState('insertUnorderedList'),
        insertOrderedList: document.queryCommandState('insertOrderedList'),
        //+ formatBlock 返回值可能是 "h5" / "<h5>" / "p"，统一去尖括号
        blockTag: String(blockValue).replace(/[<>]/g, '').toLowerCase(),
      })
    } catch {
      //+ queryCommandState 在某些环境可能抛错，忽略即可
    }
  }, [])

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

  //+ ===== 执行格式命令 =====
  //+ 使用 savedRange 保存工具栏点击前的选区（移动端点击按钮会丢失光标）
  const savedRangeRef = useRef<Range | null>(null)

  const saveSelection = useCallback(() => {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange()
    }
  }, [])

  const restoreSelection = useCallback(() => {
    const sel = window.getSelection()
    if (sel && savedRangeRef.current) {
      sel.removeAllRanges()
      sel.addRange(savedRangeRef.current)
    }
  }, [])

  const execCmd = useCallback((command: string, val?: string) => {
    const el = editableRef.current
    if (!el) return
    //+ 确保编辑区有焦点
    el.focus()
    //+ 恢复之前保存的选区（移动端点击工具栏后光标可能丢失）
    restoreSelection()
    //+ 执行命令
    document.execCommand(command, false, val)
    //+ 同步内容
    syncContent()
    //+ 更新工具栏激活态
    updateActiveStates()
  }, [restoreSelection, syncContent, updateActiveStates])

  //+ ===== 工具栏命令 =====
  const toggleBold = () => execCmd('bold')
  const toggleItalic = () => execCmd('italic')
  const toggleUnderline = () => execCmd('underline')
  const toggleStrikethrough = () => execCmd('strikeThrough')
  const toggleUnorderedList = () => execCmd('insertUnorderedList')
  const toggleOrderedList = () => execCmd('insertOrderedList')

  //+ 标题：formatBlock 需要传带尖括号的标签名（如 "<h1>"），多数浏览器才生效
  //+ 再次点击同一标题 → 切回正文 p
  const toggleHeading = (tag: string) => {
    const next = activeStates.blockTag === tag ? 'p' : tag
    execCmd('formatBlock', `<${next}>`)
  }

  //+ ===== 输入事件 =====
  const handleInput = useCallback(() => {
    if (!initializedRef.current) return
    syncContent()
    //+ placeholder 处理：空内容时插入占位
    const el = editableRef.current
    if (el && el.innerHTML === '<br>') {
      el.innerHTML = '<p><br></p>'
    }
    //+ 更新工具栏激活态（输入可能改变格式）
    updateActiveStates()
  }, [syncContent, updateActiveStates])

  //+ ===== 换行处理：Enter 段落换行，Shift+Enter 行内换行 =====
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      //+ Enter → 段落换行（默认行为，浏览器会插入 <div> 或 <p>）
      //+ 依赖默认行为，不加阻止；formatBlock=p 可在需要时统一
    } else if (e.key === 'Enter' && e.shiftKey) {
      //+ Shift+Enter → 行内换行 <br>
      e.preventDefault()
      document.execCommand('insertLineBreak')
      syncContent()
    }
  }, [syncContent])

  //+ ===== 选区变化时更新激活态（鼠标抬起/键盘抬起/获得焦点） =====
  const handleSelectionChange = useCallback(() => {
    updateActiveStates()
  }, [updateActiveStates])

  //+ ===== 移动端：触摸工具栏前保存选区 =====
  const handleToolbarTouchStart = useCallback(() => {
    saveSelection()
  }, [saveSelection])

  //+ ===== 处理粘贴：清除外部样式，只保留纯文本或安全 HTML =====
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
      {/* 自定义工具栏（只读时不展示） */}
      {!readOnly && (
        <div
          className="we-toolbar"
          style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' as any }}
        >
          <button
            type="button"
            className={`we-tb-btn${activeStates.bold ? ' we-tb-active' : ''}`}
            onMouseDown={(e) => { e.preventDefault(); saveSelection() }}
            onTouchStart={handleToolbarTouchStart}
            onClick={toggleBold}
          >
            {ICON_BOLD}
          </button>
          <button
            type="button"
            className={`we-tb-btn${activeStates.italic ? ' we-tb-active' : ''}`}
            onMouseDown={(e) => { e.preventDefault(); saveSelection() }}
            onTouchStart={handleToolbarTouchStart}
            onClick={toggleItalic}
          >
            {ICON_ITALIC}
          </button>
          <button
            type="button"
            className={`we-tb-btn${activeStates.underline ? ' we-tb-active' : ''}`}
            onMouseDown={(e) => { e.preventDefault(); saveSelection() }}
            onTouchStart={handleToolbarTouchStart}
            onClick={toggleUnderline}
          >
            {ICON_UNDERLINE}
          </button>
          <button
            type="button"
            className={`we-tb-btn${activeStates.strikeThrough ? ' we-tb-active' : ''}`}
            onMouseDown={(e) => { e.preventDefault(); saveSelection() }}
            onTouchStart={handleToolbarTouchStart}
            onClick={toggleStrikethrough}
          >
            {ICON_STRIKE}
          </button>
          <button
            type="button"
            className={`we-tb-btn${activeStates.blockTag === 'h1' ? ' we-tb-active' : ''}`}
            onMouseDown={(e) => { e.preventDefault(); saveSelection() }}
            onTouchStart={handleToolbarTouchStart}
            onClick={() => toggleHeading('h1')}
          >
            {ICON_H1}
          </button>
          <button
            type="button"
            className={`we-tb-btn${activeStates.blockTag === 'h2' ? ' we-tb-active' : ''}`}
            onMouseDown={(e) => { e.preventDefault(); saveSelection() }}
            onTouchStart={handleToolbarTouchStart}
            onClick={() => toggleHeading('h2')}
          >
            {ICON_H2}
          </button>
          <button
            type="button"
            className={`we-tb-btn${activeStates.blockTag === 'h3' ? ' we-tb-active' : ''}`}
            onMouseDown={(e) => { e.preventDefault(); saveSelection() }}
            onTouchStart={handleToolbarTouchStart}
            onClick={() => toggleHeading('h3')}
          >
            {ICON_H3}
          </button>
          <button
            type="button"
            className={`we-tb-btn${activeStates.insertUnorderedList ? ' we-tb-active' : ''}`}
            onMouseDown={(e) => { e.preventDefault(); saveSelection() }}
            onTouchStart={handleToolbarTouchStart}
            onClick={toggleUnorderedList}
          >
            {ICON_UNORDERED_LIST}
          </button>
          <button
            type="button"
            className={`we-tb-btn${activeStates.insertOrderedList ? ' we-tb-active' : ''}`}
            onMouseDown={(e) => { e.preventDefault(); saveSelection() }}
            onTouchStart={handleToolbarTouchStart}
            onClick={toggleOrderedList}
          >
            {ICON_ORDERED_LIST}
          </button>
        </div>
      )}

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
        onKeyUp={handleSelectionChange}
        onMouseUp={handleSelectionChange}
        onTouchEnd={handleSelectionChange}
        onFocus={handleSelectionChange}
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

//+ ==============================================================
//+ 图标替换指南
//+ ==============================================================
//+ 上面的 ICON_* 常量目前是文字占位（B / I / U / S / 字号 / • / 1.）
//+
//+ 替换为自定义图标的步骤：
//+ 1. 准备图标文件放到 src/components/RichEditor/icons/
//+ 2. 需要的图标清单（共 7 个）：
//+    icon-bold / icon-italic / icon-underline / icon-strikethrough
//+    icon-font-size / icon-ul-list / icon-ol-list
//+ 3. 替换常量为 import 并在 index.less 中加 .we-tb-icon 样式
//+ 或者直接使用 NutUI 图标
