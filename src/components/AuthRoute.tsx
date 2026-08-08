//+ 路由鉴权高阶组件
import React, { useEffect, ComponentType } from 'react'
import { isAuthenticated, routerRedirectTo, ROUTE_PATHS } from '@/router'

//+ 跳转到登录页（未登录时）
function goToLogin(): Promise<TaroGeneral.CallbackResult> {
  return routerRedirectTo('LOGIN')
}

interface AuthRouteOptions {
  //+ 是否在鉴权失败时显示加载中
  showLoading?: boolean
}

//+ 页面级鉴权高阶组件
export function withAuth<T extends object>(
  WrappedComponent: ComponentType<T>,
  options: AuthRouteOptions = {}
): React.FC<T> {
  const { showLoading = true } = options

  const AuthComponent: React.FC<T> = (props) => {
    useEffect(() => {
      if (!isAuthenticated()) {
        goToLogin()
      }
    }, [])

    if (!isAuthenticated()) {
      if (showLoading) {
        return null
      }
      return null
    }

    return <WrappedComponent {...props as T} />
  }

  return AuthComponent
}

//+ 函数式鉴权检查（在页面组件中手动调用）
export function useAuthCheck(): boolean {
  const [isAuth, setIsAuth] = React.useState(false)

  useEffect(() => {
    const authenticated = isAuthenticated()
    if (!authenticated) {
      goToLogin()
    } else {
      setIsAuth(true)
    }
  }, [])

  return isAuth
}
