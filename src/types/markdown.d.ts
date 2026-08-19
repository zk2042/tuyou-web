export type ToolbarAction =
  | 'bold' | 'italic' | 'strikethrough'
  | 'h1' | 'h2' | 'h3'
  | 'quote' | 'ul' | 'ol'
  | 'link' | 'inlineCode' | 'codeBlock'
  | 'divider' | 'newline'

export interface ToolbarButtonItem {
  key: ToolbarAction
  /** 显示文本（不用图片图标） */
  label: any
  /** 悬停/点击提示 */
  title?: string
}

export interface CursorPos {
  start: number
  end: number
}
