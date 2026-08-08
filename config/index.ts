import { defineConfig, type UserConfigExport } from '@tarojs/cli'
import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin'
import devConfig from './dev'
import prodConfig from './prod'

// https://taro-docs.jd.com/docs/next/config#defineconfig-辅助函数
export default defineConfig<'webpack5'>(async (merge, { command, mode }) => {
  const currentMode = mode || process.env.NODE_ENV || 'development'
  const rawEnv = {
    command,
    mode,
    nodeEnv: process.env.NODE_ENV,
    taroEnv: process.env.TARO_ENV,
    appEnv: process.env.TARO_APP_ENV,
    appId: process.env.TARO_APP_ID,
    apiBase: process.env.TARO_APP_API_BASE
  }
  const currentEnv = {
    mode: currentMode,
    isDevelopmentMode: currentMode === 'development',
    isTestEnv: currentMode === 'test',
    isProductionEnv: currentMode === 'production'
  }

  console.log('rawEnv', rawEnv)
  console.log('currentEnv', currentEnv)

  const baseConfig: UserConfigExport<'webpack5'> = {
    projectName: 'tuyou-web',
    date: '2026-7-21',
    designWidth: 750,
    deviceRatio: {
      640: 2.34 / 2,
      750: 1,
      375: 2,
      828: 1.81 / 2
    },
    sourceRoot: 'src',
    outputRoot: 'dist',
    plugins: [
      "@tarojs/plugin-generator"
    ],
    defineConstants: {
    },
    copy: {
      patterns: [
      ],
      options: {
      }
    },
    framework: 'react',
    compiler: 'webpack5',
    cache: {
      enable: false // Webpack 持久化缓存配置，建议开启。默认配置请参考：https://docs.taro.zone/docs/config-detail#cache
    },
    mini: {
      postcss: {
        pxtransform: {
          enable: true,
          config: {

          }
        },
        cssModules: {
          enable: false, // 默认为 false，如需使用 css modules 功能，则设为 true
          config: {
            namingPattern: 'module', // 转换模式，取值为 global/module
            generateScopedName: '[name]__[local]___[hash:base64:5]'
          }
        }
      },
      webpackChain(chain) {
        chain.resolve.plugin('tsconfig-paths').use(TsconfigPathsPlugin)
      }
    },
    h5: {
      publicPath: '/',
      staticDirectory: 'static',
      devServer: {
        open: true, // 自动打开浏览器
        port: 10086,
        //+ 支持HTML5 History模式，所有路由都指向index.html
        historyApiFallback: true
      },
      router: {

        //+ 路由模式：browser模式使用HTML5 history API，去掉#号
        mode: 'browser',
        //+ H5端路由别名配置（key为实际页面路径，value为别名）
        customRoutes: {
          //认证界面
          '/pages/Login/index': '/login',
          '/pages/Register/index': '/register',
          '/pages/ForgotPassword/index': '/forgot-password',
          // 主界面
          '/pages/Home/index': '/home',
          '/pages/Activity/index': '/activity',
          '/pages/Message/index': '/message',
          '/pages/Profile/index': '/profile',
          //发布界面
          '/pages/PublishNote/index': '/publish/note',
          '/pages/PublishGuide/index': '/publish/guide',
          '/pages/PublishActivity/index': '/publish/activity',
          '/pages/Logout/index': '/logout',
          //详情页
          '/pages/NoteDetail/index': '/note-detail',
          '/pages/GuideDetail/index': '/guide-detail',
          '/pages/ActivityDetail/index': '/activity-detail',
          // 个人中心
          '/pages/Content/index': '/content',
          '/pages/FollowList/index': '/follow-list',
          '/pages/FollowerList/index': '/follower-list',
          '/pages/Favorite/index': '/favorite',
          '/pages/Like/index': '/like',
          '/pages/Settings/index': '/settings',
          '/pages/MyActivity/index': '/my-activity',
          '/pages/EditProfile/index': '/edit-profile',
          '/pages/EditUserInfo/index': '/edit-user-info',
        }
      },
      output: {
        filename: 'js/[name].[hash:8].js',
        chunkFilename: 'js/[name].[chunkhash:8].js'
      },
      miniCssExtractPluginOption: {
        ignoreOrder: true,
        filename: 'css/[name].[hash].css',
        chunkFilename: 'css/[name].[chunkhash].css'
      },
      postcss: {
        autoprefixer: {
          enable: true,
          config: {rootValue:37.5}
        },
        cssModules: {
          enable: false, // 默认为 false，如需使用 css modules 功能，则设为 true
          config: {
            namingPattern: 'module', // 转换模式，取值为 global/module
            generateScopedName: '[name]__[local]___[hash:base64:5]'
          }
        }
      },
      webpackChain(chain) {
        chain.resolve.plugin('tsconfig-paths').use(TsconfigPathsPlugin)
        //+ 关闭 webpack bundle size 警告（NutUI 组件库体积较大）
        chain.performance.hints(false)
      }
    },
    rn: {
      appName: 'taroDemo',
      postcss: {
        cssModules: {
          enable: false, // 默认为 false，如需使用 css modules 功能，则设为 true
        }
      }
    }
  }


  if (process.env.NODE_ENV === 'development') {
    // 本地开发构建配置（不混淆压缩）
    return merge({}, baseConfig, devConfig)
  }
  // 生产构建配置（默认开启压缩混淆等）
  return merge({}, baseConfig, prodConfig)
})
