import React from 'react'
import type { ToolbarAction, ToolbarButtonItem } from '@/types/markdown'
import './index.less'

const BUTTONS: ToolbarButtonItem[] = [
  { key: 'bold',         label: <strong style={{fontWeight:700}}>B</strong>,       title: '加粗' },
  { key: 'italic',       label: <em style={{fontStyle:'italic'}}>I</em>,            title: '斜体' },
  { key: 'strikethrough',label: <span style={{textDecoration:'line-through'}}>S</span>, title: '删除线' },
  { key: 'h1',           label: 'H1',                                              title: '一级标题' },
  { key: 'h2',           label: 'H2',                                              title: '二级标题' },
  { key: 'h3',           label: 'H3',                                              title: '三级标题' },
  { key: 'quote',        label: '「引用」',                                         title: '引用块' },
  { key: 'ul',           label: '· 列表',                                           title: '无序列表' },
  { key: 'ol',           label: '1. 列表',                                          title: '有序列表' },
  { key: 'link',         label: '〔链接〕',                                          title: '插入链接' },
  { key: 'inlineCode',   label: '「代码」',                                          title: '行内代码' },
  { key: 'codeBlock',    label: '``` 代码块',                                       title: '多行代码块' },
  { key: 'divider',      label: '---分割',                                          title: '水平分割线' },
  { key: 'newline',      label: '↩换行',                                            title: '段落内换行' },
]

export interface ToolbarProps {
  onAction: (action: ToolbarAction) => void
  disabled?: boolean
}

const Toolbar: React.FC<ToolbarProps> = ({ onAction, disabled }) => {
  return (
    <div className="md-toolbar">
      {BUTTONS.map(b => (
        <span
          key={b.key}
          className={`md-tb-btn ${disabled ? 'md-tb-btn-disabled' : ''}`}
          title={b.title}
          onClick={() => {
            if (disabled) return
            onAction(b.key)
          }}
        >
          {b.label}
        </span>
      ))}
    </div>
  )
}

export default Toolbar
