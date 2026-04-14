var auth = require('../../utils/auth');
var storeUtil = require('../../utils/store');
var request = require('../../utils/request');

Page({
  data: {
    storeName: '',
    submitting: false
  },

  onLoad(options) {
    this._from = (options && options.from) || '';
  },

  onShow() {
    if (!auth.redirectToLoginIfNeeded()) {
      return;
    }
    /* 从设置「创建新门店」进入时，即使用户已有门店也允许停留本页 */
    if (!storeUtil.sessionNeedsOnboarding() && this._from !== 'settings') {
      wx.switchTab({ url: '/pages/overview/overview' });
    }
  },

  onNameInput(e) {
    this.setData({ storeName: (e.detail && e.detail.value) || '' });
  },

  onSubmit() {
    if (this.data.submitting) return;
    var name = (this.data.storeName || '').trim();
    if (!name) {
      wx.showToast({ title: '请输入门店名称', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    var app = getApp();
    request
      .post('/store_create.php', { name: name })
      .then(function (data) {
        var merged = storeUtil.applyStoreCreateSuccess(app, data);
        if (!merged) {
          wx.showToast({ title: '创建成功但未解析到门店，请重新登录', icon: 'none' });
          return;
        }
        wx.showToast({ title: '创建成功', icon: 'success' });
        /* 略延迟再切 Tab，减少与上一笔云调用在客户端通道上重叠、被热重载打断而误报 timeout */
        setTimeout(function () {
          wx.switchTab({ url: '/pages/overview/overview' });
        }, 200);
      })
      .catch(function (err) {
        wx.showToast({
          title: (err && err.message) || '创建失败',
          icon: 'none'
        });
      })
      .then(() => {
        this.setData({ submitting: false });
      });
  }
});
