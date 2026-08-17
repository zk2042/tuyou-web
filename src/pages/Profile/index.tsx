//+ 个人中心主页
//+ 数据来源：GET /personal（fetchProfileInfo）为主，state.user.userInfo 兜底，静态数据末位兜底
//+ 标签使用习惯：NutUI 组件（Avatar/ArrowRight）+ 原生 HTML + IconFont 图标
import { useSelector, useDispatch } from 'react-redux'
import Taro, { useDidShow } from '@tarojs/taro'
import { ArrowRight } from '@nutui/icons-react'
import { Ellipsis } from '@nutui/nutui-react'
import Avatar from '@/components/Avatar'
import { getUserInfo } from '@/store/modules/user'
import { fetchProfileInfo } from '@/store/modules/profile'
import type { RootState, AppDispatch } from '@/store'
import { useAuthGuard } from '@/components/AuthRoute'
import './index.less'

//+ 静态兜底数据（store 无数据时使用）
const fallbackUserData = {
  avatar: 'https://picsum.photos/200?random=1',
  nickname: '山林旅人',
  signature: '热爱徒步，每周一山',
  bgImg: 'https://picsum.photos/400/200?random=10',
}

//+ 功能入口列表
const menuItems = [
  { icon: 'icon-neirong', text: '我的内容', path: '/pages/Content/index' },
  { icon: 'icon-shoucang', text: '我的收藏', path: '/pages/Favorite/index' },
  { icon: 'icon-like', text: '我的点赞', path: '/pages/Like/index' },
  { icon: 'icon-activity', text: '我的活动', path: '/pages/MyActivity/index' },
  { icon: 'icon-shezhi', text: '设置', path: '/pages/Settings/index' },
]

const Profile = () => {
  useAuthGuard()
  const dispatch = useDispatch<AppDispatch>()
  //+ profile.info（GET /personal）为主；user.userInfo（登录态）兜底
  const { userInfo, isLoggedIn } = useSelector((state: RootState) => state.user)
  const profileInfo = useSelector((state: RootState) => state.profile.info)

  //+ 页面显示时拉取主页信息（GET /personal），保证发布/关注/粉丝计数实时
  //+ 同时若 user 模块无数据则补拉一次（登录后首次进入场景）
  useDidShow(() => {
    dispatch(fetchProfileInfo())
    if (isLoggedIn && !userInfo) {
      dispatch(getUserInfo())
    }
  })

  //+ 展示数据：优先 profile.info，其次 user.userInfo，最后静态兜底
  //+ 使用 ?? 而非 ||：只在 null/undefined 时兜底，保留空字符串
  //+ 避免用户清空签名后后端返回 bio:'' 被 || 跳过显示旧数据
  const displayData = {
    avatar: profileInfo?.avatar ?? userInfo?.avatar ?? fallbackUserData.avatar,
    nickname: profileInfo?.nickname ?? userInfo?.nickname ?? fallbackUserData.nickname,
    signature: profileInfo?.bio ?? userInfo?.bio ?? fallbackUserData.signature,
    bgImg: profileInfo?.bgImg ?? userInfo?.bgImg ?? fallbackUserData.bgImg,
  }

  //+ 社交数据：优先 profile.info，其次 user.userInfo，无数据时显示 0
  const socialStats = {
    notes: profileInfo?.publishCount ?? userInfo?.publishCount ?? 0,
    following: profileInfo?.followCount ?? userInfo?.followCount ?? 0,
    followers: profileInfo?.fansCount ?? userInfo?.fansCount ?? 0,
  }

  //+ 点击社交数据跳转
  const handleStatClick = (type: 'notes' | 'following' | 'followers') => {
    const paths = {
      notes: '/pages/Content/index',
      following: '/pages/FollowList/index',
      followers: '/pages/FollowerList/index',
    }
    Taro.navigateTo({ url: paths[type] })
  }

  //+ 点击功能入口跳转
  const handleMenuClick = (path: string) => {
    Taro.navigateTo({ url: path })
  }

  //+ 点击编辑资料
  const handleEditProfile = () => {
    Taro.navigateTo({ url: '/pages/EditProfile/index' })
  }

  return (
    <div className="profile-page">
      {/* 顶部背景图 + 用户信息区 */}
      <div className="user-header">
        <div className="bg-image">
          <img src={displayData.bgImg} alt="背景" />
          <div className="bg-gradient"></div>
        </div>

        <div className="user-info">
          <Avatar url={displayData.avatar} size="50" />
          <div className="user-detail">
              <Ellipsis className="nickname" content={displayData.nickname} rows={1} />
              <Ellipsis className="signature" content={displayData.signature} rows={2} />
            </div>

          <div className="edit-icon iconfont icon-bianji" onClick={handleEditProfile}></div>
          {/* <div className="user-detail">
            <div className="nickname-row">
              <span className="nickname">{displayData.nickname}</span>
              <span className="edit-icon iconfont icon-bianji" onClick={handleEditProfile}></span>
            </div>
            <div className="signature">{displayData.signature}</div>
          </div> */}
        </div>

        {/* 社交数据 */}
        <div className="social-stats">
          <div className="stat-item" onClick={() => handleStatClick('notes')}>
            <span className="stat-value">{socialStats.notes}</span>
            <span className="stat-label">内容</span>
          </div>
          <div className="stat-item" onClick={() => handleStatClick('following')}>
            <span className="stat-value">{socialStats.following}</span>
            <span className="stat-label">关注</span>
          </div>
          <div className="stat-item" onClick={() => handleStatClick('followers')}>
            <span className="stat-value">{socialStats.followers}</span>
            <span className="stat-label">粉丝</span>
          </div>
        </div>
      </div>

      {/* 功能入口区 */}
      <div className="menu-section">
        {menuItems.map((item, index) => (
          <div
            key={index}
            className="menu-item"
            onClick={() => handleMenuClick(item.path)}
          >
            <div className="menu-left">
              <span className={`menu-icon iconfont ${item.icon}`}></span>
              <span className="menu-text">{item.text}</span>
            </div>
            <ArrowRight className="menu-arrow" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default Profile
