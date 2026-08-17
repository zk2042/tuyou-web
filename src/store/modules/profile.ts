//+ 个人中心模块Redux状态管理
//+ 管理个人主页信息、笔记/攻略列表等（服务于 Profile/我的 系列页面）
//+ notes/strategys 采用累积分页（Content 页共享 store 状态）
//+ 关注/粉丝/收藏/点赞/活动等列表仅 dispatch 取 payload，由页面本地 useState 管理
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import {
  getProfileInfoAPI,
  updateProfileInfoAPI,
  getProfileNotesAPI,
  getProfileStrategysAPI,
  getProfileFollowAPI,
  getProfileFansAPI,
  getFavoriteNotesAPI,
  getFavoriteStrategysAPI,
  getLikedNotesAPI,
  getLikedStrategysAPI,
  getPublishActivityAPI,
  getJoinActivityAPI,
  toggleProfileFollowAPI
} from '@/apis/profile'
import type {
  ProfileInfo,
  ProfileUpdate,
  ProfilePostItem,
  FollowItem,
  FanItem,
  ActivityListItem,
  PageResult
} from '@/types'

//+ 分页请求参数
interface PageParams {
  page: number
  size: number
}

//+ 列表分片状态（笔记/攻略共用，支持累积加载）
interface ProfileListState<T> {
  list: T[]
  loading: boolean
  hasMore: boolean
  page: number
  total: number
  totalPage: number
  error: string | null
}

//+ 个人中心状态接口
export interface ProfileState {
  info: ProfileInfo | null
  infoLoading: boolean
  infoError: string | null
  notes: ProfileListState<ProfilePostItem>
  strategys: ProfileListState<ProfilePostItem>
}

//+ 列表分片初始状态
const initialListState: ProfileListState<any> = {
  list: [],
  loading: false,
  hasMore: true,
  page: 1,
  total: 0,
  totalPage: 0,
  error: null
}

//+ 初始状态
const initialState: ProfileState = {
  info: null,
  infoLoading: false,
  infoError: null,
  notes: { ...initialListState },
  strategys: { ...initialListState }
}

//+ 通用分页 thunk 工厂：统一处理 code 校验与错误透传
//+ 返回 PageResult<T>，供 dispatch 后 res.payload 取用
const createPageThunk = <T>(
  typePrefix: string,
  apiFn: (params: PageParams) => Promise<{ code: number; message: string; data: PageResult<T> }>,
  errorMsg: string
) => createAsyncThunk(
  typePrefix,
  async (params: PageParams, { rejectWithValue }) => {
    try {
      const res = await apiFn(params)
      if (res.code === 0 || res.code === 200) {
        return res.data
      }
      return rejectWithValue(res.message || errorMsg)
    } catch (error: any) {
      return rejectWithValue(error?.message || '网络错误')
    }
  }
)

//+ 获取主页信息
export const fetchProfileInfo = createAsyncThunk(
  'profile/fetchProfileInfo',
  async (_, { rejectWithValue }) => {
    try {
      const res = await getProfileInfoAPI()
      if (res.code === 0 || res.code === 200) {
        return res.data
      }
      return rejectWithValue(res.message || '获取主页信息失败')
    } catch (error: any) {
      return rejectWithValue(error?.message || '网络错误')
    }
  }
)

//+ 编辑个人信息
export const fetchUpdateProfile = createAsyncThunk(
  'profile/fetchUpdateProfile',
  async (params: ProfileUpdate, { rejectWithValue }) => {
    try {
      const res = await updateProfileInfoAPI(params)
      if (res.code === 0 || res.code === 200) {
        return res.data
      }
      return rejectWithValue(res.message || '更新个人信息失败')
    } catch (error: any) {
      return rejectWithValue(error?.message || '网络错误')
    }
  }
)

//+ 关注/取关（切换式，POST /personal/follow/{followeeId}）
//+ 统一入口：笔记详情、活动详情、攻略详情、关注/粉丝列表均可调用
//+ 返回 { userId, isFollowed }，调用方据此同步本地状态
//+ signal 透传：支持 AbortController 丢弃过期请求
export const toggleProfileFollow = createAsyncThunk(
  'profile/toggleFollow',
  async (followeeId: string, { rejectWithValue, signal }) => {
    try {
      const res = await toggleProfileFollowAPI(followeeId, signal)
      if (res.code === 0 || res.code === 200) {
        return { userId: followeeId, isFollowed: !!res.data?.isFollowed }
      }
      return rejectWithValue(res.message || '操作失败')
    } catch (error: any) {
      if (error?.name === 'AbortError') return rejectWithValue('aborted')
      return rejectWithValue(error?.message || '网络错误')
    }
  }
)

//+ 获取笔记列表（累积分页，存 store 供 Content 页共享）
export const fetchProfileNotes = createPageThunk<ProfilePostItem>(
  'profile/fetchProfileNotes',
  getProfileNotesAPI,
  '获取笔记列表失败'
)

//+ 获取攻略列表（累积分页，存 store 供 Content 页共享）
export const fetchProfileStrategys = createPageThunk<ProfilePostItem>(
  'profile/fetchProfileStrategys',
  getProfileStrategysAPI,
  '获取攻略列表失败'
)

//+ 获取关注列表
export const fetchFollowList = createPageThunk<FollowItem>(
  'profile/fetchFollowList',
  getProfileFollowAPI,
  '获取关注列表失败'
)

//+ 获取粉丝列表
export const fetchFansList = createPageThunk<FanItem>(
  'profile/fetchFansList',
  getProfileFansAPI,
  '获取粉丝列表失败'
)

//+ 获取收藏笔记列表
export const fetchFavoriteNotes = createPageThunk<ProfilePostItem>(
  'profile/fetchFavoriteNotes',
  getFavoriteNotesAPI,
  '获取收藏笔记失败'
)

//+ 获取收藏攻略列表
export const fetchFavoriteStrategys = createPageThunk<ProfilePostItem>(
  'profile/fetchFavoriteStrategys',
  getFavoriteStrategysAPI,
  '获取收藏攻略失败'
)

//+ 获取点赞笔记列表
export const fetchLikedNotes = createPageThunk<ProfilePostItem>(
  'profile/fetchLikedNotes',
  getLikedNotesAPI,
  '获取点赞笔记失败'
)

//+ 获取点赞攻略列表
export const fetchLikedStrategys = createPageThunk<ProfilePostItem>(
  'profile/fetchLikedStrategys',
  getLikedStrategysAPI,
  '获取点赞攻略失败'
)

//+ 获取发布活动列表
export const fetchPublishActivity = createPageThunk<ActivityListItem>(
  'profile/fetchPublishActivity',
  getPublishActivityAPI,
  '获取发布活动失败'
)

//+ 获取参加活动列表
export const fetchJoinActivity = createPageThunk<ActivityListItem>(
  'profile/fetchJoinActivity',
  getJoinActivityAPI,
  '获取参加活动失败'
)

//+ 更新列表分片状态（fulfilled）
//+ page===1 替换列表，page>1 追加
function applyListState<T>(
  state: ProfileListState<T>,
  payload: PageResult<T>,
  page: number
) {
  state.loading = false
  state.error = null
  state.list = page === 1 ? payload.list : [...state.list, ...payload.list]
  state.page = payload.page
  state.total = payload.total
  state.totalPage = payload.total_page ?? payload.page
  state.hasMore = payload.page < (payload.total_page ?? payload.page)
}

//+ 个人中心Slice
const profileSlice = createSlice({
  name: 'profile',
  initialState,
  reducers: {
    //+ 重置笔记列表
    resetProfileNotes: (state) => {
      state.notes = { ...initialListState }
    },
    //+ 重置攻略列表
    resetProfileStrategys: (state) => {
      state.strategys = { ...initialListState }
    }
  },
  extraReducers: (builder) => {
    builder
      //+ 主页信息
      .addCase(fetchProfileInfo.pending, (state) => {
        state.infoLoading = true
        state.infoError = null
      })
      .addCase(fetchProfileInfo.fulfilled, (state, action: PayloadAction<ProfileInfo>) => {
        state.infoLoading = false
        state.info = action.payload
      })
      .addCase(fetchProfileInfo.rejected, (state, action) => {
        state.infoLoading = false
        state.infoError = action.payload as string
      })
      //+ 编辑个人信息成功后更新 info（merge 而非 replace）
      //+ 避免 PUT 接口返回字段不完整（如缺少 publishCount/followCount/fansCount）时丢字段
      .addCase(fetchUpdateProfile.fulfilled, (state, action: PayloadAction<ProfileInfo>) => {
        state.info = { ...state.info, ...action.payload } as ProfileInfo
      })
      //+ 笔记列表（累积）
      .addCase(fetchProfileNotes.pending, (state) => {
        state.notes.loading = true
        state.notes.error = null
      })
      .addCase(fetchProfileNotes.fulfilled, (state, action) => {
        applyListState(state.notes, action.payload, action.meta.arg.page)
      })
      .addCase(fetchProfileNotes.rejected, (state, action) => {
        state.notes.loading = false
        state.notes.error = action.payload as string
      })
      //+ 攻略列表（累积）
      .addCase(fetchProfileStrategys.pending, (state) => {
        state.strategys.loading = true
        state.strategys.error = null
      })
      .addCase(fetchProfileStrategys.fulfilled, (state, action) => {
        applyListState(state.strategys, action.payload, action.meta.arg.page)
      })
      .addCase(fetchProfileStrategys.rejected, (state, action) => {
        state.strategys.loading = false
        state.strategys.error = action.payload as string
      })
      //+ 关注/粉丝/收藏/点赞/活动等列表仅 dispatch 取 payload，不持久化到 store（页面本地管理）
  }
})

//+ 导出Action
export const { resetProfileNotes, resetProfileStrategys } = profileSlice.actions

//+ 导出Reducer
export default profileSlice.reducer
