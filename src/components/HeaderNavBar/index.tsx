//taro
import {NavBar} from '@nutui/nutui-react'
import {ArrowLeft,More} from '@nutui/icons-react'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { Dialog } from '@nutui/nutui-react'
//样式
import './index.less'



const HeaderNavBar = ({title='详情',backPageNum=1,more=false,fallbackUrl='/pages/Home/index',fixed=true,cancel=false}: {title?: string,backPageNum?: number,more?: boolean,fallbackUrl?: string,fixed?: boolean,cancel?:boolean}) => {

  // 健壮的返回逻辑：navigateBack 失败时降级到浏览器 history，再失败则跳转首页
  const handleBack = () => {
    // 1. 优先使用 Taro navigateBack（依赖 Taro 页面栈，刷新后会失效）
    try {
      const currentPages = Taro.getCurrentPages()
      if (currentPages.length > backPageNum) {
        Taro.navigateBack({ delta: backPageNum })
        return
      }
    } catch (e) {
      console.warn('Taro.navigateBack 失败，尝试浏览器 history', e)
    }

    // 2. 降级：浏览器 history（刷新后仍保留，只要不是直接通过 URL 打开）
    if (typeof window !== 'undefined' && window.history.length > 1) {
      window.history.back()
      return
    }

    // 3. 兜底：没有任何历史记录（直接通过 URL 打开），跳转到首页
    Taro.redirectTo({ url: fallbackUrl })
  }
  //取消按钮的点击事件
  const [dialogVisible, setDialogVisible] = useState(false)
  return (
  <>
 <NavBar
      className='header-nav-bar'
      back={<div onClick={()=>setDialogVisible(true)} className='back-btn'><ArrowLeft className='arrow-left' />{cancel? '取消':''}</div>}
      right={more ? <More onClick={() => Taro.showToast({ title: '更多功能开发中', icon: 'none' })} /> : null}
      fixed={fixed}
      onBackClick={cancel? ()=>{}:handleBack}
      title={title}
    />
    {cancel&&<Dialog
      visible={dialogVisible}
      title="确认取消编辑吗？"
      confirmText="确认"
      cancelText="取消"
      onCancel={() => setDialogVisible(false)}
     
      onConfirm={handleBack}
    />}
  </>
   

   
  )
}

export default HeaderNavBar