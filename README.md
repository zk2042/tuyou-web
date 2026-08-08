# 途友 - 户外徒步社交 APP

> 探索自然，结伴前行

## 项目介绍

途友是一款面向户外徒步爱好者的社交应用，提供活动发布、组队匹配、行程记录等功能。本项目基于 Taro 框架开发，支持 H5 和微信小程序双端运行。

## 技术栈

| 分类   | 技术            | 版本           |
| ---- | ------------- | ------------ |
| 框架   | Taro          | 4.2.1        |
| UI 库 | NutUI React   | 4.0.0-beta.5 |
| 状态管理 | Redux Toolkit | 2.x          |
| 语言   | TypeScript    | 5.x          |
| 样式   | Less          | 4.x          |
| 包管理  | pnpm          | latest       |

## 环境要求

- **Node.js**: ≥ 18.0.0
- **pnpm**: ≥ 8.0.0
- **Taro CLI**: 4.2.1（已在项目依赖中，无需全局安装）

## 快速开始

### 安装依赖

```bash
pnpm install
```

### 开发模式

**H5 开发（推荐）**

```bash
pnpm dev:h5
```

启动后访问：`http://localhost:10086`

**微信小程序开发**

```bash
pnpm dev:weapp
```

启动后使用微信开发者工具打开项目根目录。

### 构建命令

| 命令                     | 说明              |
| ---------------------- | --------------- |
| `pnpm build:h5`        | 构建 H5 生产版本      |
| `pnpm build:weapp`     | 构建微信小程序生产版本     |
| `pnpm build:h5:dev`    | 构建 H5 开发版本（不压缩） |
| `pnpm build:weapp:dev` | 构建微信小程序开发版本     |

## 项目结构

```
src/
├── apis/              # API 接口封装
│   └── user.ts        # 用户相关接口
├── components/        # 公共组件
│   └── AuthRoute.tsx  # 路由鉴权组件
├── pages/             # 页面组件
│   ├── Home/          # 首页（需登录）
│   ├── Login/         # 登录页
│   ├── Logout/        # 退出登录页
│   └── Register/      # 注册页
├── router/            # 路由工具
│   └── index.ts       # 路由常量、跳转工具函数
├── store/             # Redux 状态管理
│   ├── modules/       # 各模块状态
│   │   └── user.ts    # 用户状态管理
│   └── index.ts       # Store 配置
├── utils/             # 工具函数
│   ├── request.ts     # 请求封装（基于 Taro.request）
│   ├── token.ts       # Token 管理
│   ├── mock.ts        # Mock 数据（后端未就绪时使用）
│   └── index.ts       # 工具统一导出
├── app.config.ts      # Taro 应用配置（页面路由、窗口样式）
├── app.tsx            # 应用入口
└── index.html         # H5 入口 HTML
```

## 路由说明

> ⚠️ **重要提示**：本项目使用 Taro 内置路由系统，**不支持** `react-router-dom`

### 路由配置

路由在 `src/app.config.ts` 中配置：

```ts
pages: [
  'pages/Login/index',    // 登录页
  'pages/Register/index', // 注册页
  'pages/Home/index',     // 首页
  'pages/Logout/index'    // 退出登录页
]
```

### 路由别名（H5 端）

H5 路由别名在 `config/index.ts` 的 `h5.router.customRoutes` 中配置：

```ts
h5: {
  router: {
    customRoutes: {
      '/login': '/pages/Login/index',
      '/register': '/pages/Register/index',
      '/home': '/pages/Home/index',
      '/logout': '/pages/Logout/index'
    }
  }
}
```

访问 `http://localhost:10086/#/login` 即可打开登录页。

### 路由工具

使用 `src/router/index.ts` 提供的工具函数进行页面跳转：

```ts
import { routerNavigateTo, routerRedirectTo, goHomeAfterLogin } from '@/router'

routerNavigateTo('REGISTER')   // 保留当前页，跳转到注册页
routerRedirectTo('HOME')       // 关闭当前页，跳转到首页
goHomeAfterLogin()             // 登录成功后跳转首页
```

**路由工具函数列表：**

| 函数名 | 说明 |
|--------|------|
| `routerNavigateTo(key)` | 保留当前页面，跳转到应用内的某个页面 |
| `routerRedirectTo(key)` | 关闭当前页面，跳转到应用内的某个页面 |
| `routerSwitchTab(key)` | 跳转到 tabBar 页面 |
| `routerReLaunch(key)` | 关闭所有页面，打开到应用内的某个页面 |
| `routerNavigateBack(delta)` | 返回上一页 |
| `goHomeAfterLogin()` | 登录成功后跳转首页 |
| `goToLogin()` | 跳转到登录页 |

### 路由鉴权

使用 `src/components/AuthRoute.tsx` 提供的 `useAuthCheck` Hook：

```tsx
import { useAuthCheck } from '@/components/AuthRoute'

const Home = () => {
  const isAuth = useAuthCheck()
  if (!isAuth) return null  // 未登录自动跳转到登录页
  return <div>首页内容</div>
}
```

## 状态管理

项目使用 Redux Toolkit 进行状态管理，主要模块：

- **user**: 用户状态（登录状态、用户信息）

### 核心概念

```ts
// 创建异步 Action
export const fetchLogin = createAsyncThunk(
  'user/fetchLogin',
  async (params, { rejectWithValue }) => {
    const res = await loginAPI(params)
    if (res.code === 0) {
      setToken(res.data.token)  // 登录成功后存储 token
      return res.data
    }
    return rejectWithValue(res.message)
  }
)
```

### 使用方式

```tsx
import { useDispatch, useSelector } from 'react-redux'
import { fetchLogin, logout } from '@/store/modules/user'

const dispatch = useDispatch()
const { userInfo, isLoggedIn } = useSelector((state) => state.user)

// 发起登录
dispatch(fetchLogin({ phone, password }))

// 退出登录
dispatch(logout())
```

## API 请求

### 请求封装

`src/utils/request.ts` 封装了基于 `Taro.request` 的请求工具：

- **请求拦截器**: 自动添加 `Authorization: Bearer {token}` 头
- **响应拦截器**: 统一处理错误、401 未授权自动跳转登录页
- **统一响应格式**: `{ code: number, message: string, data: T }`

### 接口定义

在 `src/apis/` 目录下定义接口：

```ts
export function loginAPI(params: { phone: string; password: string }) {
  return post('/auth/login', params)
}
```

### Mock 数据模式

由于后端尚未开发完成，项目支持 Mock 数据模式，可在无真实接口的情况下进行前端开发：

- **Mock 数据文件**: `src/utils/mock.ts` - 存放各接口的模拟响应数据
- **启用方式**: 设置环境变量 `TARO_APP_USE_MOCK=true`
- **切换方式**: 后端就绪后改为 `false` 即可切换到真实接口

### 环境配置

API 基础地址和 Mock 模式在 `.env.development` 和 `.env.production` 中配置：

```env
TARO_APP_API_BASE=http://192.168.10.7:84/api/v1
TARO_APP_USE_MOCK=true
```

| 环境变量 | 说明 | 默认值 |
|----------|------|--------|
| `TARO_APP_API_BASE` | API 接口基础地址 | - |
| `TARO_APP_USE_MOCK` | 是否启用 Mock 数据模式 | `true` |

## 样式规范

### NutUI 样式导入

必须导入编译后的 CSS 文件，**不要导入 SCSS 源文件**（会导致变量冲突）：

```ts
import '@nutui/nutui-react/dist/style.css'
import '@nutui/nutui-biz/dist/style.css'
```

### 页面样式

每个页面使用独立的 `.less` 文件，通过 `import './index.less'` 导入。

## 常见问题

### Q: 为什么不能用 react-router-dom？

A: Taro 是跨端框架，重写了路由系统，与 `react-router-dom` 完全不兼容。路由必须通过 `app.config.ts` 配置和 `Taro.navigate*` API 跳转。

### Q: 样式报错 `variable undefined`？

A: 确保只导入 NutUI 的 CSS 文件（`.css`），不要导入 SCSS 文件（`.scss`）。

### Q: 登录后仍然无法访问首页？

A: 检查 `fetchLogin` 是否正确调用了 `setToken`，以及 `request.ts` 是否正确从本地存储读取 token。

### Q: 开发模式下修改代码不热更新？

A: 使用 `pnpm dev:h5` 命令，确保是开发模式（代码不压缩、热更新、source map）。

### Q: IDE 显示 `Taro.General.CallbackResult` 类型错误？

A: `Taro.General` 不存在，`CallbackResult` 定义在全局命名空间 `TaroGeneral` 中。正确写法：

```ts
// 错误
Promise<Taro.General.CallbackResult>

// 正确
Promise<TaroGeneral.CallbackResult>
```

### Q: 路由函数名与 Taro API 冲突？

A: 避免使用与 `Taro.navigateTo`、`Taro.redirectTo` 等同名的函数名，建议添加 `router` 前缀（如 `routerNavigateTo`）。

## 开发规范

### 代码提交

提交信息格式不受限制，建议使用清晰描述：

```
完成登录页面
修复注册接口返回处理
优化首页样式
```

### 新增页面流程

1. 在 `src/pages/` 下创建新目录
2. 创建 `index.tsx` 和 `index.less` 文件
3. 在 `src/app.config.ts` 的 `pages` 数组中注册页面
4. 在 `config/index.ts` 的 `h5.router.customRoutes` 中添加路由别名
5. 在 `src/router/index.ts` 的 `ROUTE_PATHS` 和 `ROUTE_ALIAS` 中添加常量
6. 在 `src/router/index.ts` 的 `AUTH_REQUIRED_ROUTES` 或 `PUBLIC_ROUTES` 中添加路由分类

## 联系方式

<br />

***

