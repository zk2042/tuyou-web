//+ 活动详情页
//+ 按《活动模块开发文档》实现：
//+ HeaderNavBar + 封面图 + 标签标题 + 信息面板 + 发起人 + 活动介绍 + 成员列表 + 底部操作栏
//+ 报名/取消报名：文档8.1节要求取消确认弹窗，直接操作 + Toast 提示
//+ 标签使用习惯：NutUI 组件优先（Button/Tag），其余用原生 HTML 标签（div/img/span）
import { useEffect } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { Button, Tag as NutuiTag } from '@nutui/nutui-react'
import Tag from '@/components/Tag'
import { useSelector, useDispatch } from 'react-redux'
import type { AppDispatch, RootState } from '@/store'
import {
  fetchActivityDetail,
  fetchToggleSignup,
  clearCurrentActivity
} from '@/store/modules/activity'
import HeaderNavBar from '@/components/HeaderNavBar'
import Avatar from '@/components/Avatar'
import './index.less'



const ActivityDetail = () => {
  const router = useRouter()
  const dispatch = useDispatch<AppDispatch>()
  const { currentActivity, detailLoading, signupLoading } = useSelector(
    (state: RootState) => state.activity
  )

  //+ 获取活动ID
  const activityId = router.params.id || '1'

  //+ 进入页面加载详情
  useEffect(() => {
    
    dispatch(fetchActivityDetail(activityId))
    //+ 离开页面清空详情，避免残留
    return () => {
      dispatch(clearCurrentActivity())
    }
  }, [activityId])

  //+ 格式化时间 YYYY-MM-DD HH:mm
  const formatTime = (time: string) => {
    if (!time) return ''
    return time.replace(/-/g, '-').substring(0, 16)
  }

  //+ 价格显示
  const formatPrice = (price: number) => {
    return price === 0 ? '免费' : `${price}元/人`
  }

  //+ 报名进度
  const getProgress = () => {
    if (!currentActivity) return 0
    const { currentPeople, maxPeople } = currentActivity
    if (!maxPeople) return 0
    return Math.min(100, Math.round((currentPeople / maxPeople) * 100))
  }

  //+ 按钮文案与状态（文档3.3节状态矩阵，含满员判断）
  const getButtonConfig = () => {
    if (!currentActivity) return { text: '', disabled: true, type: 'default' as const }
    const { joined, activityStatus, currentPeople, maxPeople } = currentActivity
    const status = activityStatus || '报名中'

    if (joined) {
      //+ 已报名：报名中可取消，进行中/已结束不可操作
      if (status === '报名中') return { text: '取消报名', disabled: false, type: 'warning' as const }
      return { text: '已结束', disabled: true, type: 'default' as const }
    }
    //+ 未报名：满员显示"已满员"
    if (currentPeople >= maxPeople) return { text: '已满员', disabled: true, type: 'default' as const }
    //+ 未报名：报名中可报名，进行中/已结束不可操作
    if (status === '报名中') return { text: '立即报名', disabled: false, type: 'primary' as const }
    if (status === '进行中') return { text: '已开始，无法报名', disabled: true, type: 'default' as const }
    return { text: '已结束', disabled: true, type: 'default' as const }
  }

  //+ 点击底部按钮：直接报名/取消报名（文档8.1节：取消确认弹窗，直接操作 + Toast）
  const handleButtonClick = async () => {
    if (!currentActivity) return
    const config = getButtonConfig()
    if (config.disabled) return

    //+ 未登录引导登录（文档第七节）
    // const userInfo = Taro.getStorageSync('userInfo')
    // if (!userInfo) {
    //   Taro.showModal({
    //     title: '提示',
    //     content: '请先登录后再报名',
    //     confirmText: '去登录',
    //     success: (res) => {
    //       if (res.confirm) {
    //         Taro.navigateTo({ url: '/pages/Login/index' })
    //       }
    //     }
    //   })
    //   return
    // }

    //+ 记录操作前的 joined 状态，用于 Toast 提示文案
    const wasJoined = currentActivity.joined

    //+ 直接调用接口（无确认弹窗）
    const res = await dispatch(fetchToggleSignup(activityId))
    if (res.meta.requestStatus === 'fulfilled') {
      Taro.showToast({
        title: wasJoined ? '已取消报名' : '报名成功',
        icon: 'success'
      })
      //+ 报名成功后重新拉取详情，更新 members 列表等全部字段（文档3.4节推荐方式）
      dispatch(fetchActivityDetail(activityId))
    } else {
      //+ 错误处理（文档第五节错误码映射）
      const payload = res.payload as string | undefined
      const errorMsg = payload || '操作失败，请重试'
      Taro.showToast({ title: errorMsg, icon: 'none' })
    }
  }

  //+ 关注按钮占位
  const handleFollow = () => {
    Taro.showToast({ title: '关注功能开发中', icon: 'none' })
  }

  //+ 加载中骨架
  if (detailLoading) {
    return (
      <div className="activity-detail-page">
        <HeaderNavBar title="活动详情" backPageNum={1} fixed={false} />
        <div className="loading-wrapper">加载中...</div>
      </div>
    )
  }

  //+ 加载失败/活动不存在
  if (!currentActivity) {
    return (
      <div className="activity-detail-page">
        <HeaderNavBar title="活动详情" backPageNum={1} fixed={false} />
        <div className="empty-wrapper">活动不存在或已删除</div>
      </div>
    )
  }

  const buttonConfig = getButtonConfig()
  const progress = getProgress()
  const status = currentActivity.activityStatus || '报名中'

  return (
    <div className="activity-detail-page">
      <HeaderNavBar title="活动详情" backPageNum={1} fixed={false} />

      <div className="detail-scroll">
        {/* 封面图 16:9 */}
        <div className="cover-wrapper">
          <img
            className="cover-img"
            src={currentActivity.coverImg}
            alt={currentActivity.title}
          />
        </div>

        <div className="detail-content">
                  {/* 标签 + 标题 */}
                <div className="title-section">
                  <div className="tag-row">
                    <Tag tagName={currentActivity.category} />
                    <NutuiTag
                      plain  
                    >
                      {status}
                    </NutuiTag>
                  </div>
                  <div className="activity-title">{currentActivity.title}</div>
                </div>

                {/* 活动信息面板 */}
                <div className="info-panel">
                  <div className="info-item">📅{formatTime(currentActivity.startTime)}</div>
                  <div className="info-item">📍 {currentActivity.address}</div>
                  <div className="info-item">💰 {formatPrice(currentActivity.price)}</div>
                  <div className="info-item">
                    👥 {currentActivity.currentPeople}/{currentActivity.maxPeople}人
                  </div>
                  <div className="info-item">📊 {currentActivity.difficulty}</div>
                </div>

                {/* 发起人 */}
                <div className="leader-section">
                  <span className="section-title">发起人</span>
                  <div className="leader-card">
                    <Avatar url={currentActivity.leader.avatar} size="40px" />
                    <div className="leader-info">
                      <span className="leader-name">{currentActivity.leader.nickname}</span>
                      <span className="leader-bio">帐篷就是我的第二个家</span>
                    </div>
                    <Button onClick={handleFollow}>+ 关注</Button>
                  </div>
                </div>

        {/* 活动介绍 */}
        <div className="intro-section">
          <span className="section-title">活动介绍</span>
          <div className="intro-content">
            {currentActivity.activityContent.split('\n').map((line, i) => (
              <div key={i} className="intro-line">{line || ' '}</div>
            ))}
          </div>
        </div>

        {/* 已报名成员 */}
        <div className="members-section">
          <span className="section-title">
            已报名（{currentActivity.currentPeople}人）
          </span>
          <div className="members-list">
            {(currentActivity.members || []).map((m) => (
              <div key={m.id} className="member-item">
                <Avatar url={m.avatar} size="24px" />
                
              </div>
            ))}
          </div>
        </div>
        </div>
      </div>

      {/* 底部操作栏：进度条 + 按钮 */}
      <div className="bottom-bar">
        <div className="progress-wrapper">
          <div className='progress-info'>
            <span className="progress-text">
            已报 {currentActivity.currentPeople}/{currentActivity.maxPeople}人
          </span>
          <span className="progress-percent">{progress}%</span>
          </div>
          
          <div className="progress-bar">
            <div className="progress-inner" style={{ width: `${progress}%` }} />
          </div>
          
        </div>
        <Button
          className="action-btn"
          type={buttonConfig.type}
          disabled={buttonConfig.disabled}
          loading={signupLoading}
          onClick={handleButtonClick}
        >
          {buttonConfig.text}
        </Button>
      </div>
    </div>
  )
}

export default ActivityDetail
