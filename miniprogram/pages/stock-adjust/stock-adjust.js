const request = require('../../utils/request');
const auth = require('../../utils/auth');
const storeUtil = require('../../utils/store');

Page({
  data: {
    currentStock: 0,
    targetStock: '',
    note: '',
    submitting: false,
    loadError: '',
    stockLoading: true
  },

  onShow() {
    if (!auth.redirectToLoginIfNeeded()) return;
    if (!auth.redirectToOnboardingIfNeeded()) return;
    if (!auth.redirectToStoreSelectIfNeeded()) return;
    var app = getApp();
    var u = app.globalData.userInfo || wx.getStorageSync('userInfo') || {};
    if (!storeUtil.isBossInCurrentStore(u)) {
      wx.showToast({ title: '仅管理员可使用', icon: 'none' });
      setTimeout(function () {
        wx.navigateBack({ delta: 1 });
      }, 400);
      return;
    }
    this.loadCurrentStock();
  },

  loadCurrentStock() {
    var self = this;
    self.setData({ loadError: '', stockLoading: true });
    request
      .get('/store_detail.php', {})
      .then(function (detail) {
        var n = detail && detail.current_stock != null ? parseInt(detail.current_stock, 10) : 0;
        if (Number.isNaN(n) || n < 0) n = 0;
        self.setData({ currentStock: n, targetStock: String(n), stockLoading: false });
      })
      .catch(function (err) {
        self.setData({
          loadError: (err && err.message) || '加载失败',
          stockLoading: false
        });
      });
  },

  onTargetInput(e) {
    this.setData({ targetStock: (e.detail && e.detail.value) || '' });
  },

  onNoteInput(e) {
    this.setData({ note: (e.detail && e.detail.value) || '' });
  },

  onSubmit() {
    if (this.data.submitting) return;
    var target = parseInt(this.data.targetStock, 10);
    if (Number.isNaN(target) || target < 0) {
      wx.showToast({ title: '请输入有效的实盘件数', icon: 'none' });
      return;
    }
    if (target > 10000000) {
      wx.showToast({ title: '实盘件数不能超过 10000000', icon: 'none' });
      return;
    }
    var self = this;
    self.setData({ submitting: true });
    request
      .post('/stock_adjust.php', {
        target_stock: target,
        note: (self.data.note || '').trim()
      })
      .then(function (data) {
        var next = data && data.current_stock != null ? data.current_stock : target;
        self.setData({ currentStock: next, targetStock: String(next), note: '', submitting: false });
        if (data && data.skipped) {
          wx.showToast({ title: '未变化', icon: 'none' });
        } else {
          wx.showToast({ title: '已校准', icon: 'success' });
        }
      })
      .catch(function (err) {
        self.setData({ submitting: false });
        wx.showToast({ title: (err && err.message) || '保存失败', icon: 'none' });
      });
  }
});
