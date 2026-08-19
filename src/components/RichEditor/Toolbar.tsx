/**
 * 富文本工具栏按钮（文字版）
 * =============================================================
 * 事件策略（解决 mobile passive + 无反应的综合问题）：
 *   - 桌面端鼠标：onMouseDown preventDefault → 不 blur 编辑区，onClick 才真正执行命令
 *   - 移动端触摸：onTouchStart 不能 preventDefault（passive listener）→ 只保存当前选区；
 *                 onClick 是移动端唯一稳定入口：touchend→click 一定触发，
 *                 且 click 阶段 focus 编辑区 + 恢复 touchstart 保存的选区
 *   - 所有场景的命令统一走 onClick 执行，避免遗漏
 */
import React from 'react'
import Taro from '@tarojs/taro'

export type RichCommand =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'strikethrough'
  | 'fontSmall'   // 小字号（段内 P，默认正文小一号）
  | 'fontMedium'  // 中字号（P 默认）
  | 'fontLarge'   // 大字号（≈ H2/H3 标题级）
  | 'insertUnorderedList'
  | 'insertOrderedList'

export interface ToolbarButtonItem {
  action: RichCommand
  label: string
  title?: string
}

export const DEFAULT_RICH_TOOLBAR: ToolbarButtonItem[] = [
  { action: 'bold',               label: 'B',     title: '加粗' },
  { action: 'italic',             label: 'I',     title: '斜体' },
  { action: 'underline',          label: 'U',     title: '下划线' },
  { action: 'strikethrough',      label: 'S',     title: '删除线' },
  { action: 'fontSmall',          label: '字小',  title: '小号字' },
  { action: 'fontMedium',         label: '字中',  title: '中号字' },
  { action: 'fontLarge',          label: '字大',  title: '大号字' },
  { action: 'insertUnorderedList', label: '• 列表', title: '无序列表' },
  { action: 'insertOrderedList',   label: '1. 列表', title: '有序列表' },
]

export interface RichToolbarProps {
  disabled?: boolean
  onCommand: (cmd: RichCommand, value?: string) => void
  buttons?: ToolbarButtonItem[]
}

const RichToolbar: React.FC<RichToolbarProps> = ({
  disabled = false,
  onCommand,
  buttons = DEFAULT_RICH_TOOLBAR,
}) => {
  const isWeb = Taro.getEnv() === Taro.ENV_TYPE.WEB

  /** 把 contentEditable 内的选区缓存到 window，供 click 阶段（focus 丢失后）恢复 */
  const saveSelectionGlobally = () => {
    if (typeof window === 'undefined') return
    try {
      const sel = window.getSelection?.()
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0)
        const startNode = range.startContainer
        const editorRoot =
          startNode.nodeType === 1
            ? (startNode as HTMLElement).closest?.('[contenteditable="true"]')
            : (startNode.parentElement as HTMLElement | null)?.closest?.('[contenteditable="true"]')
        if (editorRoot) {
          ;(window as any).__richeditor_saved_range__ = range.cloneRange()
        }
      }
    } catch (_) { /* ignore */ }
  }

  /** 执行按钮 action：不接任何事件对象，避免反复调用 */
  const runAction = (btn: ToolbarButtonItem) => {
    if (disabled) return
    // 链接/图片/代码/引用/分割线/清除格式：按用户需求全部移除，这里仅保留 9 个动作直传
    onCommand(btn.action)
  }

  return (
    <div
      className="md-toolbar"
      style={{
        touchAction: 'manipulation',
        WebkitTapHighlightColor: 'transparent' as any,
      }}
    >
      {buttons.map((btn) => (
        <button
          type="button"
          key={btn.action}
          className={`md-tb-btn${disabled ? ' md-tb-btn-disabled' : ''}`}
          title={btn.title}
          onMouseDown={(e) => {
            if (disabled || !isWeb) return
            // 桌面端：mousedown preventDefault 让编辑区不 blur
            e.preventDefault()
          }}
          onMouseUp={() => {
            if (disabled || !isWeb) return
            // 鼠标场景额外保存一次，保证极端场景也有选区
            saveSelectionGlobally()
          }}
          onTouchStart={() => {
            if (disabled || !isWeb) return
            // 移动端 touchstart 是 passive，绝对不能 preventDefault
            // 第一时间保存当前选区（此时手指刚碰到按钮，焦点还在编辑区）
            saveSelectionGlobally()
          }}
          onClick={() => {
            // 桌面 + 移动：唯一执行入口（稳定，不会因为 touchcancel/mouseup 不触发而无反应）
            runAction(btn)
          }}
        >
          {btn.label}
        </button>
      ))}
    </div>
  )
}

export default RichToolbar
