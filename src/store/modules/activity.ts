//+ 活动模块Redux状态管理
//+ 状态规划：列表数据、分页、筛选分类、加载状态归 Store 管理（跨页面共享 + 筛选联动）
//+ 详情数据、报名状态归 Store 管理（详情页与可能的其他页面共享）
//+ 页面内纯 UI 状态（如滚动位置）不进 Store
//+ Mock 降级：由 utils/request.ts 统一处理，响应数据中 __fromMock 标记数据来源
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import {
  getActivityBannersAPI,
  getActivityListAPI,
  getActivityDetailAPI,
  toggleActivitySignupAPI,
  deleteActivityAPI
} from '@/apis/activity'
import type { Activity, ActivityBanner, ActivityListItem, Participant } from '@/types'

//+ 活动状态接口
export interface ActivityState {
  //+ 活动Banner
  banners: ActivityBanner[]
  //+ 活动列表（分页累积）
  activityList: ActivityListItem[]
  //+ 当前页码
  page: number
  //+ 总页数（判断是否还有更多）
  totalPage: number
  //+ 当前筛选分类（'全部' = 不传 category）
  category: string
  //+ 当前筛选日期 YYYY-MM-DD，空字符串=不过滤日期
  date: string
  //+ 首次/刷新加载状态
  loading: boolean
  //+ 加载更多状态
  loadingMore: boolean
  //+ 错误信息
  error: string | null
  //+ 当前活动详情
  currentActivity: Activity | null
  //+ 详情加载状态
  detailLoading: boolean
  //+ 报名操作进行中（防止重复点击）
  signupLoading: boolean
  //+ 报名人列表（从"我发布的"列表项 participants 暂存，详情页 ParticipantsModal 使用）
  //+ 来源：GET /personal/publish-activity 返回的 ActivityListItem.participants（含手机号）
  //+ 详情接口 GET /activities/{id} 不返回该字段，仅当从"我发布的"跳转时有值
  participants: Participant[]
}

//+ 初始状态
const initialState: ActivityState = {
  banners: [],
  activityList: [],
  page: 1,
  totalPage: 1,
  category: '全部',
  date: '',
  loading: false,
  loadingMore: false,
  error: null,
  currentActivity: null,
  detailLoading: false,
  signupLoading: false,
  participants: []
}

//+ 获取活动Banner异步Action
export const fetchBanners = createAsyncThunk(
  'activity/fetchBanners',
  async (_, { rejectWithValue }) => {
    try {
      const res = await getActivityBannersAPI()
      if (res.code === 0 || res.code === 200) {
        return res.data
      } else {
        return rejectWithValue(res.message || '获取活动Banner失败')
      }
    } catch (error: any) {
      return rejectWithValue(error.message || '网络错误')
    }
  }
)

//+ 获取活动列表异步Action
//+ Mock 降级由 request.ts 自动处理，成功时直接返回数据
//+ loadMore=true 时为加载更多（追加），否则为刷新/切换分类（替换）
//+ category / date 为筛选条件，空字符串=不过滤
export const fetchActivities = createAsyncThunk(
  'activity/fetchActivities',
  async (
    params: { category?: string; date?: string; page: number; size: number; loadMore?: boolean },
    { rejectWithValue }
  ) => {
    try {
      const res = await getActivityListAPI({
        category: params.category,
        date: params.date,
        page: params.page,
        size: params.size,
      })
      if (res.code === 0 || res.code === 200) {
        //+ request.ts 会自动处理 Mock 降级，__fromMock 标记数据来源
        return { ...res.data, loadMore: !!params.loadMore }
      }
      return rejectWithValue(res.message || '获取活动列表失败')
    } catch (error: any) {
      return rejectWithValue(error.message || '获取活动列表失败')
    }
  }
)

//+ 获取活动详情异步Action
export const fetchActivityDetail = createAsyncThunk(
  'activity/fetchActivityDetail',
  async (id: string, { rejectWithValue }) => {
    try {
      const res = await getActivityDetailAPI(id)
      if (res.code === 0 || res.code === 200) {
        return res.data
      }
      return rejectWithValue(res.message || '获取活动详情失败')
    } catch (error: any) {
      return rejectWithValue(error.message || '获取活动详情失败')
    }
  }
)

//+ 报名/取消报名异步Action
//+ 后端返回 { isJoined, currentPeople, wechatQR }，前端据此更新本地状态
//+ wechatQR：仅报名成功（isJoined=true）时返回，用于报名成功后弹微信群二维码卡片
export const fetchToggleSignup = createAsyncThunk(
  'activity/fetchToggleSignup',
  async (id: string, { rejectWithValue, signal }) => {
    try {
      const res = await toggleActivitySignupAPI(id, signal)
      if (res.code === 0 || res.code === 200) {
        return res.data as { isJoined: boolean; currentPeople: number; wechatQR?: string }
      }
      return rejectWithValue(res.message || '操作失败')
    } catch (error: any) {
      if (error?.name === 'AbortError') return rejectWithValue('aborted')
      return rejectWithValue(error.message || '操作失败')
    }
  }
)

//+ 删除活动异步Action
export const deleteActivity = createAsyncThunk(
  'activity/deleteActivity',
  async (id: string, { rejectWithValue }) => {
    try {
      const res = await deleteActivityAPI(id)
      if (res.code === 0 || res.code === 200) {
        return { id }
      }
      return rejectWithValue(res.message || '删除活动失败')
    } catch (error: any) {
      return rejectWithValue(error.message || '网络错误')
    }
  }
)

//+ 活动Slice
const activitySlice = createSlice({
  name: 'activity',
  initialState,
  reducers: {
    //+ 设置筛选分类（切换分类时调用）
    setCategory(state, action: { payload: string }) {
      state.category = action.payload
    },
    //+ 设置筛选日期（YYYY-MM-DD，空字符串=清除日期筛选）
    setDate(state, action: { payload: string }) {
      state.date = action.payload
    },
    //+ 重置列表（离开页面或手动刷新时调用）
    resetActivityList(state) {
      state.activityList = []
      state.page = 1
      state.totalPage = 1
      state.error = null
    },
    //+ 清空当前详情（离开详情页时调用，避免残留）
    clearCurrentActivity(state) {
      state.currentActivity = null
      state.detailLoading = false
      state.participants = []
    },
    //+ 暂存报名人列表（从"我发布的"列表项跳转详情前调用）
    setParticipants(state, action: { payload: Participant[] }) {
      state.participants = action.payload
    },
  },
  extraReducers: (builder) => {
    builder
      //+ 获取活动Banner
      .addCase(fetchBanners.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchBanners.fulfilled, (state, action) => {
        state.loading = false
        state.banners = action.payload
      })
      .addCase(fetchBanners.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      //+ 获取活动列表
      .addCase(fetchActivities.pending, (state, action) => {
        //+ 加载更多用 loadingMore，否则用 loading
        if (action.meta.arg.loadMore) {
          state.loadingMore = true
        } else {
          state.loading = true
          state.error = null
        }
      })
      .addCase(fetchActivities.fulfilled, (state, action) => {
        const { list, total_page, page, loadMore } = action.payload
        state.loading = false
        state.loadingMore = false
        state.page = page
        state.totalPage = total_page ??1
        //+ 加载更多追加，否则替换
        if (loadMore) {
          state.activityList = [...state.activityList, ...list]
        } else {
          state.activityList = list
        }
      })
      .addCase(fetchActivities.rejected, (state, action) => {
        state.loading = false
        state.loadingMore = false
        state.error = action.payload as string
      })
      //+ 获取活动详情
      .addCase(fetchActivityDetail.pending, (state) => {
        state.detailLoading = true
        state.error = null
      })
      .addCase(fetchActivityDetail.fulfilled, (state, action) => {
        state.detailLoading = false
        state.currentActivity = action.payload
      })
      .addCase(fetchActivityDetail.rejected, (state, action) => {
        state.detailLoading = false
        state.error = action.payload as string
      })
      //+ 报名/取消报名：关闭乐观更新（报名是高权重操作，等服务器确认后再更新 UI）
      //+ 仅用 signupLoading 做请求锁 + 组件层 cooldown 防狂点
      .addCase(fetchToggleSignup.pending, (state) => {
        state.signupLoading = true
      })
      .addCase(fetchToggleSignup.fulfilled, (state, action) => {
        state.signupLoading = false
        const { isJoined, currentPeople, wechatQR } = action.payload
        //+ 以返回值更新详情页
        if (state.currentActivity) {
          state.currentActivity.joined = isJoined
          state.currentActivity.currentPeople = currentPeople
          //+ 报名成功（isJoined=true）时后端返回 wechatQR，同步到详情页用于底部二维码区块渲染
          //+ 取消报名（isJoined=false）时清空，避免已退出用户仍能看到二维码
          state.currentActivity.wechatQR = isJoined ? (wechatQR || state.currentActivity.wechatQR) : ''
        }
        //+ 同步更新列表页中对应活动的状态（文档第四节：列表页状态同步）
        const listItem = state.activityList.find(a => a.id === state.currentActivity?.id)
        if (listItem) {
          listItem.joined = isJoined
          listItem.currentPeople = currentPeople
        }
      })
      .addCase(fetchToggleSignup.rejected, (state, action) => {
        state.signupLoading = false
        if (action.payload === 'aborted') return
        state.error = action.payload as string
      })
      //+ 删除活动
      .addCase(deleteActivity.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(deleteActivity.fulfilled, (state, action) => {
        const deletedId = action.payload.id
        //+ 从列表中移除
        state.activityList = state.activityList.filter(a => a.id !== deletedId)
        //+ 如果删除的是当前详情，清空详情
        if (state.currentActivity && state.currentActivity.id === deletedId) {
          state.currentActivity = null
        }
      })
      .addCase(deleteActivity.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
  },
})

//+ 导出Action
export const { setCategory, setDate, resetActivityList, clearCurrentActivity, setParticipants } = activitySlice.actions

//+ 导出Reducer
export default activitySlice.reducer
