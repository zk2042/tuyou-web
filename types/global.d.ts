/// <reference types="@tarojs/taro" />

declare module '*.png';
declare module '*.gif';
declare module '*.jpg';
declare module '*.jpeg';
declare module '*.svg';
declare module '*.css';
declare module '*.less';
declare module '*.scss';
declare module '*.sass';
declare module '*.styl';

declare namespace NodeJS {
  interface ProcessEnv {
    /** NODE 内置环境变量, 会影响到最终构建生成产物 */
    NODE_ENV: 'development' | 'production',
    /** 当前构建的平台 */
    TARO_ENV: 'weapp' | 'swan' | 'alipay' | 'h5' | 'rn' | 'tt' | 'qq' | 'jd' | 'harmony' | 'jdrn'
    /** 当前业务环境 */
    TARO_APP_ENV: 'development' | 'test' | 'production'
    /**
     * 当前构建的小程序 appid
     * @description 若不同环境有不同的小程序，可通过在 env 文件中配置环境变量`TARO_APP_ID`来方便快速切换 appid， 而不必手动去修改 dist/project.config.json 文件
     * @see https://taro-docs.jd.com/docs/next/env-mode-config#特殊环境变量-taro_app_id
     */
    TARO_APP_ID: string
    /** API 域名，后续由各环境分别填写 */
    TARO_APP_API_BASE: string
    /** 静态资源域名，默认可留空 */
    TARO_APP_ASSET_BASE: string
    /** 当前站点名称 */
    TARO_APP_SITE_NAME: string
    /** 是否启用 mock，环境变量里实际是字符串 */
    TARO_APP_ENABLE_MOCK: 'true' | 'false'
    /** 日志级别 */
    TARO_APP_LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error'
  }
}

