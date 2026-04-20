const auth = require('../../utils/auth');

/**
 * 录入 Tab 只负责新增；修改入口统一走「班次详情页」的内联编辑，
 * 保持两类场景的状态彼此不串扰。
 */
Page({
  data: {
    isEditMode: false,
    entryTagLabel: '新增条目',
    entryTitle: '新增记账数据'
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
    if (!auth.redirectToLoginIfNeeded()) return;
    if (!auth.redirectToOnboardingIfNeeded()) return;
    if (!auth.redirectToStoreSelectIfNeeded()) return;

    const form = this.selectComponent('#form');
    if (!form) return;

    form.reloadDeps().catch(function (err) {
      console.error('[entry/onShow reloadDeps]', err);
      wx.showToast({ title: '页面数据加载失败，请稍后重试', icon: 'none' });
    });
  },

  /** wxml 上的"取消修改"按钮与编辑模式成对存在；保留空钩子防止历史 wxml 绑定报错 */
  cancelEdit() {
    const form = this.selectComponent('#form');
    if (form) form.resetToCreate();
  },

  onFormSuccess() {
    /* 提交成功后停留在新增态，无需额外状态切换 */
  }
});
