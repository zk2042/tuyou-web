import { useCallback, useMemo } from 'react'
import Taro from '@tarojs/taro'
import type { ToolbarAction, CursorPos } from '@/types/markdown'

export interface UseMarkdownInsertOptions {
  value: string
  onChange: (v: string) => void
  cursor: CursorPos
  setCursor: (c: CursorPos) => void
  setSelection: (s: number, e?: number) => void
  focus: () => void
}

const getLineStart = (text: string, pos: number): number => {
  const idx = text.lastIndexOf('\n', pos - 1)
  return idx < 0 ? 0 : idx + 1
}

const hasLinePrefix = (text: string, lineStart: number, prefix: string): boolean =>
  text.slice(lineStart, lineStart + prefix.length) === prefix

/** 获取上一行有序列表序号 + 1，首行或非序项返回 1 */
const getNextOlNum = (text: string, lineStart: number): number => {
  if (lineStart <= 0) return 1
  const prevEnd = lineStart - 1
  const prevStart = getLineStart(text, prevEnd)
  const prevLine = text.slice(prevStart, prevEnd)
  const m = prevLine.match(/^(\d+)\.\s+/)
  return m ? Number(m[1]) + 1 : 1
}

export function useMarkdownInsert(opts: UseMarkdownInsertOptions) {
  const { value, onChange, cursor, setCursor, setSelection, focus } = opts

  const normCursor = useMemo(() => {
    let s = cursor?.start ?? 0
    let e = cursor?.end ?? s
    if (s < 0) s = 0
    if (e < s) e = s
    if (e > value.length) e = value.length
    if (s > value.length) s = value.length
    if (s > e) s = e
    return { start: s, end: e }
  }, [cursor, value])

  /** 包裹型插入：before + selected/placeholder + after */
  const wrap = useCallback((before: string, after: string, placeholder: string, selectPlaceholder = true) => {
    const { start, end } = normCursor
    const head = value.slice(0, start)
    const sel = start === end ? placeholder : value.slice(start, end)
    const tail = value.slice(end)
    const newValue = head + before + sel + after
    const ns = head.length + before.length
    const ne = selectPlaceholder ? ns + sel.length : ns
    onChange(newValue + tail)
    setCursor({ start: ns, end: ne })
    setSelection(ns, ne)
    focus()
  }, [normCursor, value, onChange, setCursor, setSelection, focus])

  /** 行首加前缀（H1/H2/H3/引用/无序列表）；再点一次取消前缀 */
  const prependLine = useCallback((prefix: string, placeholder: string) => {
    const { start, end } = normCursor
    const lineStart = getLineStart(value, start)
    if (hasLinePrefix(value, lineStart, prefix)) {
      const newVal = value.slice(0, lineStart) + value.slice(lineStart + prefix.length)
      onChange(newVal)
      const shift = prefix.length
      const ns = Math.max(lineStart, start - shift)
      const ne = Math.max(lineStart, end - shift)
      setCursor({ start: ns, end: ne })
      setSelection(ns, ne)
      focus()
      return
    }
    const head = value.slice(0, lineStart)
    const body = value.slice(lineStart)
    const nl = body.indexOf('\n')
    const lineEnd = nl < 0 ? body.length : nl
    const currentLineEmpty = body.slice(0, lineEnd).trim() === ''
    const newBody = currentLineEmpty ? (prefix + placeholder + body.slice(lineEnd)) : (prefix + body)
    onChange(head + newBody)
    const placeBase = head.length + prefix.length
    if (currentLineEmpty) {
      const ns = placeBase
      const ne = placeBase + placeholder.length
      setCursor({ start: ns, end: ne })
      setSelection(ns, ne)
    } else {
      const shift = prefix.length
      const ns = placeBase + (start - lineStart)
      const ne = start === end ? ns : (placeBase + (end - lineStart))
      void shift
      setCursor({ start: ns, end: ne })
      setSelection(ns, ne)
    }
    focus()
  }, [normCursor, value, onChange, setCursor, setSelection, focus])

  const prependOl = useCallback((placeholder: string) => {
    const { start, end } = normCursor
    const lineStart = getLineStart(value, start)
    const slice = value.slice(lineStart)
    const exist = slice.match(/^(\d+\.\s)/)
    if (exist) {
      const p = exist[1]
      onChange(value.slice(0, lineStart) + value.slice(lineStart + p.length))
      const shift = p.length
      const ns = Math.max(lineStart, start - shift)
      const ne = Math.max(lineStart, end - shift)
      setCursor({ start: ns, end: ne })
      setSelection(ns, ne)
      focus()
      return
    }
    const num = getNextOlNum(value, lineStart)
    const prefix = `${num}. `
    const nl = value.indexOf('\n', lineStart)
    const lineEnd = nl < 0 ? value.length : nl
    const lineEmpty = value.slice(lineStart, lineEnd).trim() === ''
    const base = value.slice(0, lineStart) + prefix
    if (lineEmpty) {
      onChange(base + placeholder + value.slice(lineStart))
      const ns = base.length
      const ne = base.length + placeholder.length
      setCursor({ start: ns, end: ne })
      setSelection(ns, ne)
    } else {
      onChange(base + value.slice(lineStart))
      const shift = prefix.length
      const ns = lineStart + shift + (start - lineStart)
      const ne = start === end ? ns : (lineStart + shift + (end - lineStart))
      setCursor({ start: ns, end: ne })
      setSelection(ns, ne)
    }
    focus()
  }, [normCursor, value, onChange, setCursor, setSelection, focus])

  /** 纯字符串插入（不包裹），光标默认落在插入内容末尾，cursorOffset 可自定义相对位置 */
  const insertRaw = useCallback((raw: string, cursorOffset?: number) => {
    const { start, end } = normCursor
    const head = value.slice(0, start)
    const tail = value.slice(end)
    const newVal = head + raw + tail
    const pos = head.length + (typeof cursorOffset === 'number' ? cursorOffset : raw.length)
    onChange(newVal)
    setCursor({ start: pos, end: pos })
    setSelection(pos, pos)
    focus()
  }, [normCursor, value, onChange, setCursor, setSelection, focus])

  const insert = useCallback((action: ToolbarAction) => {
    switch (action) {
      case 'bold':          return wrap('**', '**', '粗体文本')
      case 'italic':        return wrap('*', '*', '斜体文本')
      case 'strikethrough': return wrap('~~', '~~', '删除文字')
      case 'inlineCode':    return wrap('`', '`', '代码')
      case 'h1':            return prependLine('# ', '一级标题')
      case 'h2':            return prependLine('## ', '二级标题')
      case 'h3':            return prependLine('### ', '三级标题')
      case 'quote':         return prependLine('> ', '引用的段落')
      case 'ul':            return prependLine('- ', '列表项')
      case 'ol':            return prependOl('有序列表项')
      case 'link':          return wrap('[', '](https://)', '链接名称', true)
      case 'codeBlock':     return insertRaw('\n\n```javascript\n// 在此写代码\n```\n\n', '\n\n```javascript\n// 在此写代码'.length)
      case 'divider':       return insertRaw('\n\n---\n\n')
      case 'newline':       return insertRaw('  \n')
      default: break
    }
  }, [wrap, prependLine, prependOl, insertRaw])

  /** H5 端快捷键：Ctrl/⌘ + B/I/K + Shift+C；Tab → 两空格 */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (Taro.getEnv() !== Taro.ENV_TYPE.WEB) return
    const ctrl = e.ctrlKey || e.metaKey
    if (!ctrl) {
      if (e.key === 'Tab') {
        e.preventDefault()
        insertRaw('  ')
      }
      return
    }
    const k = e.key.toLowerCase()
    if (k === 'b') { e.preventDefault(); insert('bold') }
    else if (k === 'i') { e.preventDefault(); insert('italic') }
    else if (k === 'k') { e.preventDefault(); insert('link') }
    else if (e.shiftKey && k === 'c') { e.preventDefault(); insert('inlineCode') }
  }, [insert, insertRaw])

  return { insert, handleKeyDown }
}

export default useMarkdownInsert
