import { PropsWithChildren, useCallback, useEffect, useState } from 'react'
import { useLaunch } from '@tarojs/taro'
import {Provider} from 'react-redux'
import store from '@/store'
import TabList from '@/components/TabList'
import Taro from '@tarojs/taro'
import { fetchUnreadCount, resetMessageState } from '@/store/modules/message'
import { getUserInfo } from '@/store/modules/user'
import { isLoggedIn } from '@/utils/token'
import { disconnectSSE } from '@/utils/sse'
import { useSSE } from '@/hooks/useSSE'
import MessageToast from '@/components/MessageToast'

// app.tsx
import '@nutui/nutui-react/dist/style.css'  // NutUI基础样式
import '@nutui/nutui-biz/dist/style.css'   // NutUI业务组件样式

import './app.less'


//+ 需要显示底部 TabBar 的四个 Tab 页
//+ 用页面文件名（小写）做匹配，既避免大小写差异，又避免 PublishActivity 误匹配 activity
//+ 文件名唯一：home / activity / message / profile，不会与 PublishActivity、ActivityDetail 冲突
const TAB_BAR_PAGE_NAMES = ['home', 'activity', 'message', 'profile']

/**
 * 根据当前 URL 判断是否应该显示 TabBar
 * 优先用 window.location.pathname（H5 刷新后仍准确），降级用 getCurrentPages
 * 匹配规则：取路径倒数第二段作为页面名，与白名单比较
 */
function shouldShowTabBar(): boolean {
  let path = ''

  //+ 1. 优先用 window.location.pathname
  if (typeof window !== 'undefined' && window.location) {
    path = window.location.pathname || ''
  }

  //+ 2. 降级用 getCurrentPages
  if (!path) {
    try {
      const pages = Taro.getCurrentPages()
      if (pages.length > 0) {
        path = pages[pages.length - 1]?.route || ''
      }
    } catch (_) { /* ignore */ }
  }

  if (!path) return false

  const normalized = path.toLowerCase().replace(/^\//, '').replace(/\/$/, '')
  const parts = normalized.split('/')
  let pageName = ''
  if (parts.length >= 2) {
    pageName = parts[parts.length - 2]
    if (pageName === 'pages') {
      pageName = parts[parts.length - 1]
    }
  } else {
    pageName = parts[0] || ''
  }

  return TAB_BAR_PAGE_NAMES.includes(pageName)
}

//+ Provider 内部子组件：负责挂载 useSSE
//+ 必须放在 Provider 内部，因为 useSSE 内部使用了 useDispatch/useSelector
function SSEProvider() {
  useSSE()
  return null
}

function App({ children }: PropsWithChildren<any>) {
  useLaunch(() => {
    console.log('App launched.')
    //+ 应用启动时拉取未读消息数 + 用户信息（仅已登录用户）
    //+ 用户信息供 SearchBar 头像、发布按钮角色判断等全局场景使用
    if (isLoggedIn()) {
      store.dispatch(fetchUnreadCount())
      store.dispatch(getUserInfo())
    }
  })

  const [showTabBar, setShowTabBar] = useState(true)

  // 每次页面渲染时，从页面栈获取当前路由并判断是否显示 TabBar
  // children 变化 = 页面切换，Taro 会重新渲染 App 的 children
  const updateTabBarVisibility = useCallback(() => {
    const shouldShow = shouldShowTabBar()
    console.log('📱 显示 TabBar:', shouldShow)
    setShowTabBar(shouldShow)
  }, [])

  // 首次挂载 和 每次 children 变化时都触发判断
  useEffect(() => {
    updateTabBarVisibility()
  }, [children, updateTabBarVisibility])

  //+ 监听登出事件：清空 token + 断开 SSE + 重置消息状态
  useEffect(() => {
    const handleLogout = () => {
      disconnectSSE()
      store.dispatch(resetMessageState())
    }
    //+ 监听 storage 事件（跨页面登出同步）
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'tuyou_token' && !e.newValue) {
        handleLogout()
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  // children 是将要会渲染的页面
  return (
    <Provider store={store}>
      <div className='app-container'>
        {/* SSE 连接：必须在 Provider 内部调用 useSSE（内部用到 useDispatch/useSelector） */}
        <SSEProvider />
        <div>{children}</div>
        {showTabBar && (
          <div className='app-tab-container'>
           <TabList />
        </div>)}
        {/* 全局消息弹窗（场景1：非消息页收到 SSE 推送时显示） */}
        <MessageToast />
      </div>
    </Provider>
  )
}

export default App
