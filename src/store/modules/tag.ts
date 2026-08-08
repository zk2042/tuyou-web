//+ 标签模块Redux状态管理
//+ 管理标签列表（发布笔记/攻略时供用户选择）
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { getTagsAPI } from '@/apis/tag'
import type { Tag } from '@/types'

//+ 标签状态接口
export interface TagState {
  tags: Tag[]
  loading: boolean
  error: string | null
}

//+ 初始状态
const initialState: TagState = {
  tags: [],
  loading: false,
  error: null
}

//+ 获取标签列表异步Action
export const fetchTags = createAsyncThunk(
  'tag/fetchTags',
  async (_, { rejectWithValue }) => {
    try {
      const res = await getTagsAPI()
      if (res.code === 0 || res.code === 200) {
        return res.data
      } else {
        return rejectWithValue(res.message || '获取标签列表失败')
      }
    } catch (error: any) {
      return rejectWithValue(error?.message || '网络错误')
    }
  }
)

//+ 标签Slice
const tagSlice = createSlice({
  name: 'tag',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchTags.pending, (state) => {
        state.loading = true
        state.error = null
      })
      .addCase(fetchTags.fulfilled, (state, action: PayloadAction<Tag[]>) => {
        state.loading = false
        state.tags = action.payload
      })
      .addCase(fetchTags.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
  }
})

//+ 导出Reducer
export default tagSlice.reducer
