//+ 首页模块Redux状态管理
//+ 管理轮播（slides）和Feed流（feed）数据
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import { getSlidesAPI, getFeedAPI } from '@/apis/home'
import type { SlideItem, FeedItem, PageResult } from '@/types'
import type { RootState } from '@/store'

//+ Feed查询参数接口
export interface FeedQueryParams {
  category?: number
  sort?: string
  page: number
  size: number
}

//+ 首页状态接口
export interface HomeState {
  //+ 轮播数据
  slides: SlideItem[]
  slidesLoading: boolean
  slidesError: string | null
  
  //+ Feed流数据
  feed: FeedItem[]
  feedTotal: number
  feedPage: number
  feedSize: number
  feedTotalPage: number
  feedLoading: boolean
  feedHasMore: boolean
  feedError: string | null
}

//+ 初始状态
const initialState: HomeState = {
  slides: [],
  slidesLoading: false,
  slidesError: null,
  
  feed: [],
  feedTotal: 0,
  feedPage: 1,
  feedSize: 10,
  feedTotalPage: 0,
  feedLoading: false,
  feedHasMore: true,
  feedError: null
}

//+ 获取轮播数据异步Action
export const fetchSlides = createAsyncThunk(
  'home/fetchSlides',
  async (_, { rejectWithValue }) => {
    try {
      const res = await getSlidesAPI()
      if (res.code === 0 || res.code === 200) {
        return res.data
      } else {
        return rejectWithValue(res.message || '获取轮播数据失败')
      }
    } catch (error: any) {
      return rejectWithValue(error.message || '网络错误')
    }
  }
)

//+ 获取Feed流数据异步Action
export const fetchFeed = createAsyncThunk(
  'home/fetchFeed',
  async (params: FeedQueryParams, { rejectWithValue, getState }) => {
    //+ 问题1加固：双保险防重复请求 — 调用方判断 + thunk 内读 state
    const state = getState() as RootState
    if (params.page > 1 && state.home.feedLoading) {
      return rejectWithValue('loading') as any
    }
    try {
      const res = await getFeedAPI(params)
      if (res.code === 0 || res.code === 200) {
        return res.data
      } else {
        return rejectWithValue(res.message || '获取Feed流失败')
      }
    } catch (error: any) {
      return rejectWithValue(error.message || '网络错误')
    }
  }
)

//+ 问题2：软同步首页 feed（从详情返回时使用）
//+ 拉取第一页数据，但不清空原列表、不重置分页：
//+   - 已在本地 feed 中存在的项 → 整项 patch（点赞/收藏/计数等字段同步）
//+   - 本地没有的新项 → 插到列表开头（不影响后续页的顺序）
//+   - 后续页（page2+）已加载的项保持不动（保证滚动位置不变、顺序不打乱）
export const softSyncFeed = createAsyncThunk(
  'home/softSyncFeed',
  async (params: FeedQueryParams, { dispatch, rejectWithValue, getState }) => {
    const state = getState() as RootState
    if (state.home.feedLoading) return
    try {
      const res = await getFeedAPI({ ...params, page: 1 })
      if (res.code === 0 || res.code === 200) {
        const page1List = (res.data as PageResult<FeedItem>).list || []
        const currentFeed = (getState() as RootState).home.feed
        const existingIds = new Set(currentFeed.map(f => f.id))

        //+ 1. 对已存在于本地的卡片，逐项 patch 同步最新数据
        for (const item of page1List) {
          if (existingIds.has(item.id)) {
            dispatch(updateFeedItem({ id: item.id, patch: item }))
          }
        }

        //+ 2. 新出现的（本地没有的）卡片插到 feed 头部，保持相对顺序
        const newItems = page1List.filter(it => !existingIds.has(it.id))
        if (newItems.length > 0) {
          dispatch(prependFeed(newItems))
        }

        //+ 3. 更新 total/hasMore 元信息，避免 hasMore 误判
        const payload = res.data as PageResult<FeedItem>
        dispatch(setFeedMeta({
          total: payload.total,
          totalPage: payload.total_page,
          hasMore: payload.page < payload.total_page
        }))

        return payload
      } else {
        return rejectWithValue(res.message || '同步失败')
      }
    } catch (error: any) {
      return rejectWithValue(error.message || '网络错误')
    }
  }
)

//+ 首页Slice
const homeSlice = createSlice({
  name: 'home',
  initialState,
  reducers: {
    //+ 重置Feed流
    resetFeed: (state) => {
      state.feed = []
      state.feedPage = 1
      state.feedHasMore = true
      state.feedError = null
    },
    //+ 追加Feed数据（加载更多）
    appendFeed: (state, action: PayloadAction<FeedItem[]>) => {
      state.feed = [...state.feed, ...action.payload]
    },
    //+ 问题2：在 feed 头部插入新项（软同步时使用），已有 id 的跳过避免重复
    prependFeed: (state, action: PayloadAction<FeedItem[]>) => {
      const existing = new Set(state.feed.map(f => f.id))
      const unique = action.payload.filter(i => !existing.has(i.id))
      if (unique.length > 0) {
        state.feed = [...unique, ...state.feed]
      }
    },
    //+ 问题2：软同步时更新 feed 元信息（total/totalPage/hasMore），不重置 page
    setFeedMeta: (state, action: PayloadAction<{ total: number; totalPage: number; hasMore: boolean }>) => {
      state.feedTotal = action.payload.total
      state.feedTotalPage = action.payload.totalPage
      state.feedHasMore = action.payload.hasMore
    },
    //+ Q8：局部更新Feed流中单个卡片（点赞/收藏后同步）
    updateFeedItem: (state, action: PayloadAction<{ id: string; patch: Partial<FeedItem> }>) => {
      const { id, patch } = action.payload
      const item = state.feed.find(f => f.id === id)
      if (item) {
        Object.assign(item, patch)
      }
    }
  },
  extraReducers: (builder) => {
    builder
      //+ 轮播
      .addCase(fetchSlides.pending, (state) => {
        state.slidesLoading = true
        state.slidesError = null
      })
      .addCase(fetchSlides.fulfilled, (state, action: PayloadAction<SlideItem[]>) => {
        state.slidesLoading = false
        state.slides = action.payload
      })
      .addCase(fetchSlides.rejected, (state, action) => {
        state.slidesLoading = false
        state.slidesError = action.payload as string
      })
      //+ Feed流
      .addCase(fetchFeed.pending, (state) => {
        state.feedLoading = true
        state.feedError = null
      })
      .addCase(fetchFeed.fulfilled, (state, action: PayloadAction<PageResult<FeedItem>>) => {
        state.feedLoading = false
        //+ page===1 重置列表，page>1 追加（上拉加载更多）；以响应中的 page 为准
        const page = action.payload.page
        state.feed = page === 1 ? action.payload.list : [...state.feed, ...action.payload.list]
        state.feedTotal = action.payload.total
        state.feedPage = action.payload.page
        state.feedTotalPage = action.payload.total_page
        state.feedHasMore = action.payload.page < action.payload.total_page
      })
      .addCase(fetchFeed.rejected, (state, action) => {
        //+ 若因加载中被防重拦截（rejectWithValue('loading')），不要复位 loading/错误
        if (action.payload === 'loading') return
        state.feedLoading = false
        state.feedError = action.payload as string
      })
  }
})

//+ 导出Action
export const { resetFeed, appendFeed, prependFeed, setFeedMeta, updateFeedItem } = homeSlice.actions

//+ 导出Reducer
export default homeSlice.reducer
