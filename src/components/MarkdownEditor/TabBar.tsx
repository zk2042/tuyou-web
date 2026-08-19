import React from 'react'

export interface TabBarProps {
  mode: 'edit' | 'preview'
  onChange: (m: 'edit' | 'preview') => void
  disabled?: boolean
}

const TabBar: React.FC<TabBarProps> = ({ mode, onChange, disabled }) => {
  const go = (m: 'edit' | 'preview') => {
    if (disabled) return
    onChange(m)
  }
  return (
    <div className="md-tabbar">
      <span
        className={`md-tab ${mode === 'edit' ? 'md-tab-active' : ''}`}
        onClick={() => go('edit')}
      >
        编辑
      </span>
      <span
        className={`md-tab ${mode === 'preview' ? 'md-tab-active' : ''}`}
        onClick={() => go('preview')}
      >
        预览
      </span>
    </div>
  )
}

export default TabBar
