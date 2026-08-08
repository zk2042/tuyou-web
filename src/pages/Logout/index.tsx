//+ 退出登录页面
import React, { useEffect } from 'react'
import { useDispatch } from 'react-redux'
import { logout } from '@/store/modules/user'
import { goToLogin } from '@/router'
import Taro from '@tarojs/taro'

const Logout = () => {
  const dispatch = useDispatch()

  useEffect(() => {
    //+ 执行退出登录
    dispatch(logout())
    Taro.showToast({
      title: '已退出登录',
      icon: 'success'
    })
    setTimeout(() => {
      goToLogin()
    }, 1000)
  }, [dispatch])

  return null
}

export default Logout
