//+ 用户状态管理Slice
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { setToken, clearToken } from '@/utils/token'
import {
  loginAPI,
  getUserProfileAPI,
  registerAPI,
  sendCodeAPI,
  resetPasswordAPI,
  logoutAPI,
  toggleFollowAPI
} from '@/apis/user'
import type { User } from '@/types'

//+ 用户信息类型，与API文档一致
export type UserInfo = User

//+ 用户状态接口
export interface UserState {
  userInfo: UserInfo | null
  isLoggedIn: boolean
  loading: boolean
  error: string | null
}

//+ 初始状态
const initialState: UserState = {
  userInfo: null,
  isLoggedIn: false,
  loading: false,
  error: null
  
}

//+ 发送验证码异步Action
export const fetchSendCode = createAsyncThunk(
  'user/fetchSendCode',
  async (params: { phone: string; scene: 'register' | 'login' | 'reset-password' }, { rejectWithValue }) => {
    try {
      const res = await sendCodeAPI(params)
      if (res.code === 0 || res.code === 200) {
        return res.data
      } else {
        return rejectWithValue(res.message || '发送验证码失败')
      }
    } catch (error: any) {
      //+ 响应拦截器透传的 ResponseData 或 Error
      return rejectWithValue(error?.message || '网络错误')
    }
  }
)

//+ 登录异步Action（支持密码登录和验证码登录）
export const fetchLogin = createAsyncThunk(
  'user/fetchLogin',
  async (params: { phone: string; password?: string; code?: string; type?: 'password' | 'code' }, { rejectWithValue }) => {
    try {
      const res = await loginAPI(params)

      if (res.code === 0 || res.code === 200) {
        //+ 响应字段 member（与API文档一致）
        if (res.data.token) {
          setToken(res.data.token)
        }
        return res.data
      } else {
        return rejectWithValue(res.message || '登录失败')
      }
    } catch (error: any) {
      return rejectWithValue(error?.message || '网络错误')
    }
  }
)

//+ 注册异步Action（新增 code + confirmPassword）
export const fetchRegister = createAsyncThunk(
  'user/fetchRegister',
  async (params: { phone: string; code: string; nickname: string; password: string; confirmPassword: string }, { rejectWithValue }) => {
    try {
      const res = await registerAPI(params)
      if (res.code === 0 || res.code === 200) {
        //+ 响应字段 member（与API文档一致）
        if (res.data.token) {
          setToken(res.data.token)
        }
        return res.data
      } else {
        return rejectWithValue(res.message || '注册失败')
      }
    } catch (error: any) {
      return rejectWithValue(error?.message || '网络错误')
    }
  }
)

//+ 重置密码异步Action
export const fetchResetPassword = createAsyncThunk(
  'user/fetchResetPassword',
  async (params: { phone: string; code: string; newPassword: string; confirmPassword: string }, { rejectWithValue }) => {
    try {
      const res = await resetPasswordAPI(params)
      if (res.code === 0 || res.code === 200) {
        return res.data
      } else {
        return rejectWithValue(res.message || '重置密码失败')
      }
    } catch (error: any) {
      return rejectWithValue(error?.message || '网络错误')
    }
  }
)

//+ 获取用户信息异步Action
export const getUserInfo = createAsyncThunk(
  'user/getUserInfo',
  async (_, { rejectWithValue }) => {
    try {
      const res = await getUserProfileAPI()

      if (res.code === 0 || res.code === 200) {
        return res.data
      } else {
        return rejectWithValue(res.message || '获取用户信息失败')
      }
    } catch (error: any) {
      return rejectWithValue(error?.message || '网络错误')
    }
  }
)

//+ 退出登录异步Action
//+ 无论成功/失败都清理本地状态（Settings 页统一跳转登录）
export const fetchLogout = createAsyncThunk(
  'user/fetchLogout',
  async (_, { rejectWithValue }) => {
    try {
      const res = await logoutAPI()
      if (res.code === 0 || res.code === 200) {
        return res.data
      } else {
        return rejectWithValue(res.message || '退出登录失败')
      }
    } catch (error: any) {
      return rejectWithValue(error?.message || '网络错误')
    }
  }
)

//+ Q8：关注/取消关注（详情页作者关注按钮）
export const toggleFollow = createAsyncThunk(
  'user/toggleFollow',
  async (userId: string, { rejectWithValue }) => {
    try {
      const res = await toggleFollowAPI(userId)
      if (res.code === 0 || res.code === 200) {
        return { userId, ...(res.data || {}) }
      } else {
        return rejectWithValue(res.message || '操作失败')
      }
    } catch (error: any) {
      return rejectWithValue(error?.message || '网络错误')
    }
  }
)

//+ 用户Slice
const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    //+ 退出登录
    logout: (state) => {
      state.userInfo = null
      state.isLoggedIn = false
      clearToken()
    },
    //+ 更新用户信息
    updateUserInfo: (state, action: PayloadAction<UserInfo>) => {
      state.userInfo = action.payload
    },
    //+ 设置登录状态
    setLoggedIn: (state, action: PayloadAction<boolean>) => {
      state.isLoggedIn = action.payload
    }
  },
  extraReducers: (builder) => {
    builder
      //+ 发送验证码
      .addCase(fetchSendCode.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchSendCode.fulfilled, (state) => {
        state.loading = false
      })
      .addCase(fetchSendCode.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      //+ 登录
      .addCase(fetchLogin.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchLogin.fulfilled, (state, action) => {
        state.loading = false
        state.isLoggedIn = true
        //+ 响应中的 member 字段映射到 userInfo
        state.userInfo = action.payload.member || action.payload.user || null
      })
      .addCase(fetchLogin.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      //+ 注册
      .addCase(fetchRegister.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchRegister.fulfilled, (state, action) => {
        state.loading = false
        state.isLoggedIn = true
        //+ 响应中的 member 字段映射到 userInfo
        state.userInfo = action.payload.member || action.payload.user || null
      })
      .addCase(fetchRegister.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      //+ 重置密码
      .addCase(fetchResetPassword.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchResetPassword.fulfilled, (state) => {
        state.loading = false
      })
      .addCase(fetchResetPassword.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      //+ 获取用户信息
      .addCase(getUserInfo.pending, (state) => {
        state.loading = true
      })
      .addCase(getUserInfo.fulfilled, (state, action) => {
        state.loading = false
        state.userInfo = action.payload
        state.isLoggedIn = true
      })
      .addCase(getUserInfo.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      //+ 退出登录：无论成功/失败都清理本地状态（token + userInfo）
      .addCase(fetchLogout.fulfilled, (state) => {
        state.userInfo = null
        state.isLoggedIn = false
        clearToken()
      })
      .addCase(fetchLogout.rejected, (state) => {
        state.userInfo = null
        state.isLoggedIn = false
        clearToken()
      })
  }
})

//+ 导出Action
export const { logout, updateUserInfo, setLoggedIn } = userSlice.actions

//+ 导出Reducer
export default userSlice.reducer