//+ 活动详情页
//+ 按《活动模块开发文档》实现：
//+ HeaderNavBar + 封面图 + 标签标题 + 信息面板 + 发起人 + 活动介绍 + 成员列表 + 底部操作栏
//+ 报名/取消报名：文档8.1节要求取消确认弹窗，直接操作 + Toast 提示
//+ 标签使用习惯：NutUI 组件优先（Button/Tag），其余用原生 HTML 标签（div/img/span）
import { useEffect, useState, useCallback, useRef } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import { Button, Tag as NutuiTag, Dialog ,Ellipsis} from '@nutui/nutui-react'
import Tag from '@/components/Tag'
import { useSelector, useDispatch } from 'react-redux'
import type { AppDispatch, RootState } from '@/store'
import {
  fetchActivityDetail,
  fetchToggleSignup,
  clearCurrentActivity,
  deleteActivity
} from '@/store/modules/activity'
import { toggleProfileFollow } from '@/store/modules/profile'
import HeaderNavBar from '@/components/HeaderNavBar'
import Avatar from '@/components/Avatar'
import { useAuthGuard } from '@/components/AuthRoute'
import './index.less'



const ActivityDetail = () => {
  useAuthGuard()
  const router = useRouter()
  const dispatch = useDispatch<AppDispatch>()
  const { currentActivity, detailLoading, signupLoading } = useSelector(
    (state: RootState) => state.activity
  )

  //+ 获取活动ID
  const activityId = router.params.id || '1'

  //+ 请求锁 + AbortController + 操作冷却
  //+ promise.abort() → RTK signal → API request abort；cooldown 防接口响应极快时串行狂点
  const promiseRef = useRef<Map<string, { abort: () => void }>>(new Map())
  const cooldownRef = useRef<Map<string, number>>(new Map())
  const COOLDOWN_MS = 800

  //+ 离开页面时 abort 所有未完成请求
  useEffect(() => {
    return () => {
      promiseRef.current.forEach(p => p.abort())
      promiseRef.current.clear()
      cooldownRef.current.clear()
    }
  }, [])

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
  //+ 颜色与 ActivityCard 保持一致：立即报名=绿主色，取消报名=半透明绿，禁用=灰
  const getButtonConfig = () => {
    if (!currentActivity) return { text: '', disabled: true, btnClass: 'ac-btn-disabled' }
    const { joined, activityStatus, currentPeople, maxPeople } = currentActivity
    const status = activityStatus || '报名中'

    if (joined) {
      //+ 已报名：报名中可取消，进行中/已结束不可操作
      if (status === '报名中') return { text: '取消报名', disabled: false, btnClass: 'ac-btn-cancel' }
      return { text: '已结束', disabled: true, btnClass: 'ac-btn-disabled' }
    }
    //+ 未报名：满员显示"已满员"
    if (currentPeople >= maxPeople) return { text: '已满员', disabled: true, btnClass: 'ac-btn-disabled' }
    //+ 未报名：报名中可报名，进行中/已结束不可操作
    if (status === '报名中') return { text: '立即报名', disabled: false, btnClass: 'ac-btn-signup' }
    if (status === '进行中') return { text: '已开始，无法报名', disabled: true, btnClass: 'ac-btn-disabled' }
    return { text: '已结束', disabled: true, btnClass: 'ac-btn-disabled' }
  }

  //+ 点击底部按钮：直接报名/取消报名（文档8.1节：取消确认弹窗，直接操作 + Toast）
  //+ 性能优化：请求锁(signupLoading) + AbortController(promise.abort) + 操作冷却(cooldown)
  //+ 报名关闭乐观更新：等服务器确认后再更新 UI（高权重操作）
  const handleButtonClick = async () => {
    if (!currentActivity) return
    const config = getButtonConfig()
    if (config.disabled) return

    const resKey = `signup:${activityId}`
    //+ 操作冷却
    const cd = cooldownRef.current.get(resKey)
    if (cd && Date.now() < cd) return
    //+ Abort 上一个未完成请求
    const prev = promiseRef.current.get(resKey)
    if (prev) prev.abort()

    const wasJoined = currentActivity.joined
    const promise = dispatch(fetchToggleSignup(activityId))
    promiseRef.current.set(resKey, promise)
    let wasAborted = false
    try {
      const res = await promise
      wasAborted = res.payload === 'aborted'
      if (res.meta.requestStatus === 'fulfilled') {
        Taro.showToast({
          title: wasJoined ? '已取消报名' : '报名成功',
          icon: 'success'
        })
        //+ 报名成功后重新拉取详情，更新 members 列表等全部字段（文档3.4节推荐方式）
        dispatch(fetchActivityDetail(activityId))
      } else if (!wasAborted) {
        const payload = res.payload as string | undefined
        const errorMsg = payload || '操作失败，请重试'
        Taro.showToast({ title: errorMsg, icon: 'none' })
      }
    } finally {
      if (promiseRef.current.get(resKey) === promise) {
        promiseRef.current.delete(resKey)
      }
      if (!wasAborted) {
        const expires = Date.now() + COOLDOWN_MS
        cooldownRef.current.set(resKey, expires)
        setTimeout(() => { if (cooldownRef.current.get(resKey) === expires) cooldownRef.current.delete(resKey) }, COOLDOWN_MS + 50)
      }
    }
  }

  //+ 关注/取关发起人（统一走 profile/toggleProfileFollow，POST /personal/follow/{id}）
  //+ Activity.leader 无 isFollowed 字段，用本地 state 管理
  const [leaderFollowed, setLeaderFollowed] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)

  //+ 删除确认弹窗控制
  const [deleteVisible, setDeleteVisible] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  const handleFollow = async () => {
    const leaderId = currentActivity?.leader?.id
    if (!leaderId || followLoading) return
    const resKey = `follow:${leaderId}`
    //+ 操作冷却
    const cd = cooldownRef.current.get(resKey)
    if (cd && Date.now() < cd) return
    //+ Abort 上一个未完成请求
    const prevPromise = promiseRef.current.get(resKey)
    if (prevPromise) prevPromise.abort()

    setFollowLoading(true)
    const prev = leaderFollowed
    setLeaderFollowed(!prev) // 乐观更新
    const promise = dispatch(toggleProfileFollow(leaderId))
    promiseRef.current.set(resKey, promise)
    let wasAborted = false
    try {
      const action = await promise
      wasAborted = (action as any)?.payload === 'aborted'
      const ok = (action as any)?.meta?.requestStatus === 'fulfilled'
      if (ok) {
        const finalIsFollowed = (action as any)?.payload?.isFollowed ?? !prev
        setLeaderFollowed(finalIsFollowed)
        Taro.showToast({ title: finalIsFollowed ? '关注成功' : '已取消关注', icon: 'success' })
      } else if (!wasAborted) {
        setLeaderFollowed(prev) // 回滚
        Taro.showToast({ title: (action as any)?.payload || '操作失败', icon: 'none' })
      }
    } catch (err) {
      if (!wasAborted) {
        setLeaderFollowed(prev) // 回滚
        Taro.showToast({ title: '操作失败', icon: 'none' })
      }
    } finally {
      if (promiseRef.current.get(resKey) === promise) {
        promiseRef.current.delete(resKey)
      }
      setFollowLoading(false)
      if (!wasAborted) {
        const expires = Date.now() + COOLDOWN_MS
        cooldownRef.current.set(resKey, expires)
        setTimeout(() => { if (cooldownRef.current.get(resKey) === expires) cooldownRef.current.delete(resKey) }, COOLDOWN_MS + 50)
      }
    }
  }

  //+ 头部 more 按钮点击：弹出 ActionSheet 选择删除
  const handleMoreClick = useCallback(() => {
    Taro.showActionSheet({
      itemList: ['删除活动'],
      success: (res) => {
        if (res.tapIndex === 0) {
          setDeleteVisible(true)
        }
      },
      //+ 用户点击取消时 Taro 会触发 fail，静默处理避免 Uncaught (in promise)
      fail: (err) => {
        if (!/cancel/i.test(err.errMsg || '')) {
          console.warn('[ActivityDetail] showActionSheet fail:', err)
        }
      }
    })
  }, [])

  //+ 确认删除活动
  const handleDeleteConfirm = useCallback(async () => {
    if (!activityId || deleteLoading) return
    setDeleteLoading(true)
    try {
      const action = await dispatch(deleteActivity(activityId))
      const ok = (action as any)?.meta?.requestStatus === 'fulfilled'
      if (ok) {
        Taro.showToast({ title: '删除成功', icon: 'success' })
        setDeleteVisible(false)
        //+ 删除成功后返回上一页
        setTimeout(() => {
          Taro.navigateBack({ delta: 1 }).catch(() => {
            Taro.switchTab({ url: '/pages/Home/index' })
          })
        }, 500)
      } else {
        Taro.showToast({ title: (action as any)?.payload || '删除失败', icon: 'none' })
      }
    } catch (err) {
      console.warn('[ActivityDetail] 删除失败:', err)
      Taro.showToast({ title: '删除失败', icon: 'none' })
    } finally {
      setDeleteLoading(false)
    }
  }, [activityId, deleteLoading, dispatch])

  //+ 加载中骨架
  if (detailLoading) {
    return (
      <div className='activity-detail-page'>
        <HeaderNavBar title='活动详情' backPageNum={1} fixed={false} />
        <div className='loading-wrapper'>加载中...</div>
      </div>
    )
  }

  //+ 加载失败/活动不存在
  if (!currentActivity) {
    return (
      <div className='activity-detail-page'>
        <HeaderNavBar title='活动详情' backPageNum={1} fixed={false} />
        <div className='empty-wrapper'>活动不存在或已删除</div>
      </div>
    )
  }

  const buttonConfig = getButtonConfig()
  const progress = getProgress()
  const status = currentActivity.activityStatus || '报名中'

  return (
    <div className='activity-detail-page'>
      <HeaderNavBar
        title='活动详情'
        backPageNum={1}
        fixed={false}
        more={!!currentActivity?.isOwner}
        onMoreClick={handleMoreClick}
      />

      <div className='detail-scroll'>
        {/* 封面图 16:9 */}
        <div className='cover-wrapper'>
          <img
            className='cover-img'
            src={currentActivity.coverImg}
            alt={currentActivity.title}
          />
        </div>

        <div className='detail-content'>
                  {/* 标签 + 标题 */}
                <div className='title-section'>
                  <div className='tag-row'>
                    <Tag tagName={currentActivity.category} />
                    <NutuiTag
                      plain  
                    >
                      {status}
                    </NutuiTag>
                  </div>
                  <Ellipsis className='activity-title' content={currentActivity.title} rows={1} />
                </div>

                {/* 活动信息面板 */}
                <div className='info-panel'>
                  <div className='info-item'>📅{formatTime(currentActivity.startTime)}</div>
                  <div className='info-item'>📍 {currentActivity.address}</div>
                  <div className='info-item'>💰 {formatPrice(currentActivity.price)}</div>
                  <div className='info-item'>
                    👥 {currentActivity.currentPeople}/{currentActivity.maxPeople}人
                  </div>
                  <div className='info-item'>📊 {currentActivity.difficulty}</div>
                </div>

                {/* 发起人 */}
                <div className='leader-section'>
                  <span className='section-title'>发起人</span>
                  <div className='leader-card'>
                    <Avatar url={currentActivity.leader.avatar} size='40px' />
                    <div className='leader-info'>
                      <span className='leader-name'>{currentActivity.leader.nickname}</span>
                      {/* 领队个性签名：bio 可能很长，用 Ellipsis 单行截断；为空显示占位 */}
                      <Ellipsis
                        className='leader-bio'
                        content={currentActivity.leader.bio || '暂无简介'}
                        rows={1}
                      />
                    </div>
                    <Button onClick={handleFollow}>{leaderFollowed ? '已关注' : '+ 关注'}</Button>
                  </div>
                </div>

        {/* 活动介绍 */}
        <div className='intro-section'>
          <span className='section-title'>活动介绍</span>
          <div className='intro-content'>
            {currentActivity.activityContent.split('\n').map((line, i) => (
              <div key={i} className='intro-line'>{line || ' '}</div>
            ))}
          </div>
        </div>

        {/* 已报名成员 */}
        <div className='members-section'>
          <span className='section-title'>
            已报名（{currentActivity.currentPeople}人）
          </span>
          <div className='members-list'>
            {(currentActivity.members || []).map((m) => (
              <div key={m.id} className='member-item'>
                <Avatar url={m.avatar} size='24px' />
                
              </div>
            ))}
          </div>
        </div>
        </div>
      </div>

      {/* 底部操作栏：进度条 + 按钮 */}
      <div className='bottom-bar'>
        <div className='progress-wrapper'>
          <div className='progress-info'>
            <span className='progress-text'>
            已报 {currentActivity.currentPeople}/{currentActivity.maxPeople}人
          </span>
          <span className='progress-percent'>{progress}%</span>
          </div>
          
          <div className='progress-bar'>
            <div className='progress-inner' style={{ width: `${progress}%` }} />
          </div>
          
        </div>
        <Button
          className={`action-btn ${buttonConfig.btnClass}`}
          type='default'
          disabled={buttonConfig.disabled || signupLoading}
          loading={signupLoading}
          onClick={handleButtonClick}
        >
          {buttonConfig.text}
        </Button>
      </div>

      {/* 删除确认弹窗 */}
      <Dialog
        visible={deleteVisible}
        title='确认删除活动？'
        content='删除后无法恢复，确定删除该活动吗？'
        confirmText='删除'
        cancelText='取消'
        // confirmLoading={deleteLoading}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteVisible(false)}
      />
    </div>
  )
}

export default ActivityDetail
