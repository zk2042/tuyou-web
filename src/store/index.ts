//+ Redux Store配置
import { configureStore } from '@reduxjs/toolkit'
import userReducer from './modules/user'
import noteReducer from './modules/note'
import guideReducer from './modules/guide'
import activityReducer from './modules/activity'
import homeReducer from './modules/home'
import profileReducer from './modules/profile'
import tagReducer from './modules/tag'

//+ 创建Store
export const store = configureStore({
  reducer: {
    user: userReducer,
    note: noteReducer,
    guide: guideReducer,
    activity: activityReducer,
    home: homeReducer,
    profile: profileReducer,
    tag: tagReducer
  }
})

//+ 导出类型
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch

export default store
