//+ 搜索历史模块（移动端）
//+ 功能：展示历史记录列表、展开/收起、编辑模式（单条删除/全部清除）、点击词条搜索
//+ 无记录时整个模块隐藏
import { useState, useEffect, useCallback, useMemo } from 'react'
import Taro from '@tarojs/taro'
import { ArrowDown, ArrowUp, Close } from '@nutui/icons-react'
import {
  getSearchHistoryAPI,
  clearSearchHistoryAPI,
  deleteSearchHistoryItemAPI,
  type SearchHistoryItem,
} from '@/apis/search'
import './index.less'

const COLLAPSE_LIMIT = 6 //+ 收起时展示 6 条（2列×3行）

export interface SearchHistoryProps {
  /** 点击历史词条时回调 */
  onKeywordClick: (keyword: string) => void
  /** 外部传入的刷新信号：每次搜索后 +1，触发重新拉取 */
  refreshKey?: number
}

const SearchHistory: React.FC<SearchHistoryProps> = ({ onKeywordClick, refreshKey = 0 }) => {
  const [history, setHistory] = useState<SearchHistoryItem[]>([])
  const [expanded, setExpanded] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [showClearModal, setShowClearModal] = useState(false)

  //+ 拉取历史记录
  const loadHistory = useCallback(async () => {
    try {
      const res = await getSearchHistoryAPI()
      if (res.code === 0 || res.code === 200) {
        setHistory(res.data || [])
      }
    } catch (_err) {
      //+ 失败不阻塞
    }
  }, [])

  //+ 初始化 + refreshKey 变化时加载
  useEffect(() => {
    loadHistory()
  }, [loadHistory, refreshKey])

  const hasHistory = history.length > 0
  const showExpandToggle = history.length > COLLAPSE_LIMIT

  const visibleHistory = useMemo(() => {
    if (expanded || editMode) return history
    return history.slice(0, COLLAPSE_LIMIT)
  }, [history, expanded, editMode])

  //+ 点击词条
  const handleKeywordClick = (keyword: string) => {
    if (editMode) return
    onKeywordClick(keyword)
  }

  //+ 删除单条
  const handleDeleteItem = async (id: string) => {
    //+ 乐观删除
    setHistory((prev) => prev.filter((h) => h.id !== id))
    try {
      await deleteSearchHistoryItemAPI(id)
    } catch (_err) {
      //+ 失败回滚
      loadHistory()
      Taro.showToast?.({ title: '删除失败', icon: 'none' })
    }
  }

  //+ 全部清除
  const handleClearAll = async () => {
    setShowClearModal(false)
    try {
      await clearSearchHistoryAPI()
      setHistory([])
      setEditMode(false)
      Taro.showToast?.({ title: '已清空', icon: 'none', duration: 1000 })
    } catch (_err) {
      Taro.showToast?.({ title: '清空失败', icon: 'none' })
      loadHistory()
    }
  }

  //+ 退出编辑模式时收起
  const handleExitEdit = () => {
    setEditMode(false)
  }

  if (!hasHistory) return null

  return (
    <div className="sh-wrap">
      {/* 第一行：标题 + 右侧操作 */}
      <div className="sh-header">
        <span className="sh-title">历史记录</span>
        <div className="sh-actions">
          {!editMode ? (
            //+ 正常态：展开/收起 + 删除图标
            <>
              {showExpandToggle && (
                <>
                  <span className="sh-toggle" onClick={() => setExpanded(!expanded)}>
                    {expanded ? '收起' : '展开'}
                    {expanded
                      ? <ArrowUp className="sh-arrow-icon" />
                      : <ArrowDown className="sh-arrow-icon" />}
                  </span>
                  <span className="sh-divider">|</span>
                </>
              )}
              <span className="sh-delete-icon iconfont icon-shanchu" onClick={() => setEditMode(true)}/>
              
            </>
          ) : (
            //+ 编辑模式：全部清除 | 完成
            <>
              <span className="sh-clear-all" onClick={() => setShowClearModal(true)}>
                全部清除
              </span>
              <span className="sh-divider">|</span>
              <span className="sh-done" onClick={handleExitEdit}>
                完成
              </span>
            </>
          )}
        </div>
      </div>

      {/* 历史词条网格 */}
      <div className={`sh-grid${editMode ? ' sh-grid-edit' : ''}`}>
        {visibleHistory.map((item) => (
          <div
            key={item.id}
            className="sh-tag"
            onClick={() => handleKeywordClick(item.keyword)}
          >
            <span className="sh-tag-text">{item.keyword}</span>
            {editMode && (
              <span
                className="sh-tag-del"
                onClick={(e) => {
                  e.stopPropagation()
                  handleDeleteItem(item.id)
                }}
              >
                <Close className="sh-tag-del-icon" />
              </span>
            )}
          </div>
        ))}
      </div>

      {/* 全部清除确认弹窗 */}
      {showClearModal && (
        <div className="sh-modal" onClick={() => setShowClearModal(false)}>
          <div className="sh-modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="sh-modal-text">
              历史记录清除后无法恢复，是否删除全部记录
            </div>
            <div className="sh-modal-actions">
              <span className="sh-modal-cancel" onClick={() => setShowClearModal(false)}>
                取消
              </span>
              <span className="sh-modal-delete" onClick={handleClearAll}>
                删除
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SearchHistory
