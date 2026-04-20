/**
 * 微信小程序原生自定义 tabBar 组件。
 *
 * 为什么是原生组件：uni-app (vue3 + vite-plugin-uni) 不会把 `src/custom-tab-bar/index.vue`
 * 编译成 mp-weixin 的 `index.js/.wxml/.wxss/.json`，于是运行时 tabBar 直接消失。
 * 这里写回原生 Component()，由 vite.config.ts 里的 copy 插件把本目录拷贝到 dist 根。
 *
 * 高亮同步的要点：
 *   微信 tabBar 每页都有 **独立的组件实例**。A 页 setData({selected:1}) 不会传给 B 页。
 *   所以必须在 `pageLifetimes.show` / `attached` 里根据 `getCurrentPages()` 的当前
 *   路由，回写自己的 selected，这样每个页面 show 出来时都会落到正确档位。
 *   同时在 tap 时立即 setData 以保证点击反馈是即时的（不等待 show 回调）。
 */

const TAB_LIST = [
  { pagePath: '/pages/overview/index', text: '概览', icon: 'grid' },
  { pagePath: '/pages/entry/index', text: '录入', icon: 'plus' },
  { pagePath: '/pages/reports/index', text: '报表', icon: 'chart' },
  { pagePath: '/pages/settings/index', text: '设置', icon: 'sliders' }
]

function routeToIndex(route) {
  if (!route) return -1
  const target = '/' + route
  for (let i = 0; i < TAB_LIST.length; i++) {
    if (TAB_LIST[i].pagePath === target) return i
  }
  return -1
}

function currentRouteIndex() {
  try {
    const pages = getCurrentPages()
    const top = pages && pages.length ? pages[pages.length - 1] : null
    return routeToIndex(top && top.route)
  } catch (e) {
    return -1
  }
}

Component({
  data: {
    selected: 0,
    color: '#c6c6c6',
    selectedColor: '#1a1c1d',
    list: TAB_LIST
  },

  lifetimes: {
    attached() {
      /**
       * 首次挂载就把 selected 校准到当前页。否则登录后第一次进 overview 时，
       * 如果 selected 默认 0 恰好正确，其他页就会闪一下默认激活 "概览"。
       */
      const idx = currentRouteIndex()
      if (idx >= 0 && idx !== this.data.selected) {
        this.setData({ selected: idx })
      }
    }
  },

  pageLifetimes: {
    show() {
      /**
       * 每次页面 show（包括 switchTab 过来、从详情页 navigateBack、小程序切前台）
       * 都同步一次 selected，避免不同页面实例之间状态不一致。
       */
      const idx = currentRouteIndex()
      if (idx >= 0 && idx !== this.data.selected) {
        this.setData({ selected: idx })
      }
    }
  },

  methods: {
    switchTab(e) {
      const ds = e.currentTarget.dataset
      const url = ds.path
      const index = Number(ds.index)
      if (!Number.isFinite(index) || index < 0) return
      /**
       * 立即回写 selected 是为了让图标变色/放大动画跟手；
       * wx.switchTab 触发目标页后，那边的 tabBar 会自己在 pageLifetimes.show
       * 里再校准一次，所以点击的页面即使稍后被销毁也不会有视觉跳跃。
       */
      if (this.data.selected !== index) {
        this.setData({ selected: index })
      }
      if (url) wx.switchTab({ url })
    }
  }
})
