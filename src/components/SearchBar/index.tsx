import React from 'react'
import { Avatar,SearchBar as NutSearchBar ,Cell} from '@nutui/nutui-react'
import Taro from '@tarojs/taro'
import './index.less'


const SearchBar = () => {
  //+ 点击搜索框跳转到搜索页面
  const handleSearchClick = () => {
    Taro.navigateTo({
      url: '/pages/Search/index'
    })
  }

  return (
    <div className="search-bar">
      <Cell className="search-bar-left" title="途友" onClick={() => {}}  />
      <NutSearchBar 
        className="search-bar-input"
        readOnly
        shape="round"
        placeholder="搜索笔记、攻略、用户"
        onClick={handleSearchClick}
      />

      <Avatar size="25" src='https://api.dicebear.com/9.x/notionists/svg?seed=user1' alt="山林旅人"  onClick={() => {}} />
    </div>
  )
}

export default SearchBar