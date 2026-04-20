import { getCurrentInstance } from 'vue'
import { onShow } from '@dcloudio/uni-app'

/**
 * 把「当前页对应的 tabBar selected 索引」同步给 mp-weixin 自定义 tabBar 组件。
 *
 * 为什么需要这个：
 * - 自定义 tabBar 的每个 tab 页都持有 **独立的 custom-tab-bar 组件实例**；
 * - 只靠 tabBar 组件内部的 `pageLifetimes.show` 回调校准 selected，会出现先以
 *   默认值 `0` 绘制一帧、再 setData 的可见闪回（视觉上就是图标从 概览 回弹到
 *   当前 tab）；
 * - 在页面自身的 `onShow` 阶段调 `page.getTabBar().setData()` 可以让 setData
 *   在本次 paint 之前生效，跨页切换完全无闪。这是微信官方文档 custom tabBar
 *   章节里推荐的落地方式。
 *
 * 用法：
 *   setup() {
 *     useTabBarSync(1) // 录入 tab
 *   }
 *
 * 非 mp-weixin 平台（H5 / app）上 `getTabBar` 不存在，函数静默跳过。
 */
export function useTabBarSync(index: number): void {
  onShow(() => {
    const inst = getCurrentInstance()
    /** uni-app 把原生 mp-weixin 的 Page 实例挂在 `proxy.$scope` 上 */
    const page = (inst as unknown as { proxy?: { $scope?: unknown } })?.proxy?.$scope as
      | {
          getTabBar?: () => {
            data?: { selected?: number }
            setData: (p: Record<string, unknown>) => void
          }
        }
      | undefined
    if (!page || typeof page.getTabBar !== 'function') return
    const tb = page.getTabBar()
    if (!tb || typeof tb.setData !== 'function') return
    if (tb.data?.selected === index) return
    tb.setData({ selected: index })
  })
}
