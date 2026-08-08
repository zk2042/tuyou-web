# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**途友 (tuyou-web)** — a cross-platform outdoor community app built with **Taro 4.2.1** (React + TypeScript + Webpack5). Targets WeChat Mini Program and H5 web. UI library: **NutUI React 4.0** + NutUI Biz components.

## Commands

```bash
# Dev server (H5, port 10086, auto-opens browser)
pnpm run dev:h5

# Build H5
pnpm run build:h5:dev     # development mode
pnpm run build:h5:test    # test mode
pnpm run build:h5:prod    # production mode

# Build WeChat Mini Program
pnpm run build:weapp:dev
pnpm run build:weapp:test
pnpm run build:weapp:prod

# Linting (husky + lint-staged run on commit)
# Manual: eslint and stylelint configs are present but no npm scripts defined for manual runs

# Create new Taro page/component
pnpm run new
```

## Architecture

### Multi-platform build

Taro compiles React code to both H5 (SPA) and WeChat Mini Program from a single `src/` codebase. The build target is determined by `--type` flag. Environment config lives in `.env.*` files using Taro's env injection (`TARO_APP_*` prefix).

### Routing

- **Two-tier routing**: Taro page paths (e.g. `/pages/Home/index`) mapped to H5-friendly aliases (e.g. `/home`) via `config/index.ts` → `h5.router.customRoutes`. The alias map must stay in sync between `config/index.ts` and `src/router/index.ts` (`ROUTE_ALIAS`).
- Navigation uses Taro APIs wrapped in `src/router/index.ts` helper functions (`routerNavigateTo`, `routerRedirectTo`, `routerSwitchTab`). Always use these wrappers rather than calling `Taro.navigateTo` directly.
- `src/app.config.ts` defines Taro page registration (necessary for compilation). Any new page must be added there.
- `src/components/AuthRoute.tsx` provides `withAuth()` HOC and `useAuthCheck()` hook for page-level authentication gating.

### State management (Redux Toolkit)

Five slice modules in `src/store/modules/`:

| Module | Purpose |
|--------|---------|
| `user` | Auth (login/register), user profile, token management |
| `home` | Banner slides + Feed waterfall (category/sort filtering, pagination) |
| `note` | Note list, like/favorite toggles |
| `activity` | Activity banners |
| `config` | Global config: categories, sorts, content types for filtering |

All async actions are `createAsyncThunk` — they call API functions from `src/apis/`, then the slice's `extraReducers` handle pending/fulfilled/rejected states.

### API layer

- `src/apis/*.ts` — thin wrappers around the request functions. One file per domain (`user`, `note`, `activity`, `home`, `config`). API paths are all relative; the base URL is prefixed in `src/utils/request.ts` from `TARO_APP_API_BASE`.
- `src/utils/request.ts` — core HTTP client built on `Taro.request`. Features: automatic Bearer token injection, 401 interception (redirect to login), mock mode switching via `TARO_APP_USE_MOCK` env var.
- API base path convention: `{TARO_APP_API_BASE}` + relative path. Example: `TARO_APP_API_BASE=http://192.168.10.7:84/api/v1` + `/auth/login` → `http://192.168.10.7:84/api/v1/auth/login`.
- Response format (from `src/types/index.ts` `ApiResponse`): `{ code: 0, message: "成功", data: ... }`. Business success codes are `0` or `200`.

### Mock system

Controlled by `TARO_APP_USE_MOCK=true` in `.env.*`. When enabled, `src/utils/request.ts` intercepts all requests and routes them to `src/mock/index.ts`, which aggregates mock route handlers from per-domain files (`src/mock/home.ts`, `user.ts`, `note.ts`, `activity.ts`, `config.ts`). Mock routes are keyed by `"METHOD /api/v1/path"` (e.g. `"GET /api/v1/feed"`). Supports parameterized route matching (e.g. `"GET /api/v1/users/:userId"`). Mock utilities (`createPageResponse`, `successResponse`, `randomInt`, `randomItem`) are in `src/mock/utils.ts`.

To add a new mock endpoint: add the handler to the appropriate `src/mock/<domain>.ts` file, keyed by method+path.

### Shared types

`src/types/index.ts` contains domain types used across the app: `User`, `FeedItem`, `SlideItem`, `Activity`, `Comment`, `InteractionMessage`, `SystemMessage`, `PageResult<T>`, `ApiResponse<T>`. These mirror the API documentation in `docs/`.

### Shared styles

`src/styles/auth.less` is shared by Login and Register pages. `src/pages/variables.less` exists for global Less variables.

### Component conventions

- Pages go in `src/pages/<PageName>/index.tsx` with co-located `index.less` and `index.css` (compiled Less).
- Reusable components in `src/components/<ComponentName>/index.tsx`. Current components: `SearchBar`, `Banner`, `TabList` (bottom nav with 5 tabs: 社区/活动/发布/消息/我的), `NoteList` (feed waterfall), `Tag`, `AuthRoute`.
- NutUI components are imported from `@nutui/nutui-react`; their base styles are imported once in `src/app.tsx`.

### Environment variables

All custom env vars use `TARO_APP_` prefix (Taro requirement):
- `TARO_APP_API_BASE` — backend API base URL
- `TARO_APP_USE_MOCK` — `true`/`false` to enable mock mode
- `TARO_APP_LOG_LEVEL` — logging level
- `TARO_APP_ENV` — environment identifier for build mode matching

### Path aliases

`@/` maps to `src/` (configured in `tsconfig.json` paths and webpack `TsconfigPathsPlugin`).