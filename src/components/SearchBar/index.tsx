import { Avatar, SearchBar as NutSearchBar, Cell } from '@nutui/nutui-react'
import { useSelector } from 'react-redux'
import { routerNavigateTo } from '@/router'
import type { RootState } from '@/store'
import './index.less'

//+ 默认头像（store 无 userInfo 时兜底，避免空头像裂图）
const DEFAULT_AVATAR = 'https://api.dicebear.com/9.x/notionists/svg?seed=user1'

const SearchBar = () => {
  //+ 从 store 读取当前登录用户信息，用于右上角头像展示
  const userInfo = useSelector((state: RootState) => state.user.userInfo)

  //+ 点击搜索框跳转到搜索页面
  //+ 注意：NutSearchBar 自身 onClick 在 H5 端可能不触发（内部 input 吞事件），
  //+      因此绑定在外层可点击容器上，并给内部 SearchBar 添加 pointer-events:none
  const handleSearchClick = () => {
    routerNavigateTo('SEARCH')
  }

  return (
    <div className="search-bar">
      <div className="search-bar-left">途友</div>
      {/* 外层可点击容器：保证整个搜索框区域点击都能跳转 */}
      <div className="search-bar-trigger" onClick={handleSearchClick}>
        <NutSearchBar
          className="search-bar-input"
          readOnly
          shape="round"
          placeholder="搜索笔记、攻略、活动"
        />
      </div>
      <Avatar
        size="25"
        src={userInfo?.avatar || DEFAULT_AVATAR}
        alt={userInfo?.nickname || '途友用户'}
        onClick={() => {}}
      />
    </div>
  )
}

export default SearchBar
