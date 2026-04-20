/// <reference types="vite/client" />
/// <reference types="@dcloudio/types" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

/**
 * 微信云开发全局声明：uni-app 编译到 mp-weixin 时，运行时暴露 `wx.cloud.*`，
 * 但 @dcloudio/types 不含此声明，这里按实际用到的方法手工补齐即可。
 */
declare const wx: {
  cloud: {
    init(opts?: { env?: string; traceUser?: boolean }): void
    callFunction<T = unknown>(opts: {
      name: string
      data?: Record<string, unknown>
      timeout?: number
    }): Promise<{ result: T }>
  }
}
