var auth = require('../../utils/auth');
var storeUtil = require('../../utils/store');
var request = require('../../utils/request');

Page({
  data: {
    inviteCode: '',
    submitting: false
  },

  onShow() {
    if (!auth.redirectToLoginIfNeeded()) {
      return;
    }
    if (!storeUtil.sessionNeedsOnboarding()) {
      wx.switchTab({ url: '/pages/overview/overview' });
    }
  },

  onCodeInput(e) {
    this.setData({ inviteCode: (e.detail && e.detail.value) || '' });
  },

  onSubmit() {
    if (this.data.submitting) return;
    var code = (this.data.inviteCode || '').trim();
    if (!code) {
      wx.showToast({ title: '请输入邀请码', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    var app = getApp();
    request
      .post('/store_join.php', { code: code })
      .then(function (data) {
        var merged = storeUtil.applyStoreJoinSuccess(app, data);
        if (!merged) {
          wx.showToast({ title: '加入成功但状态异常，请重新登录', icon: 'none' });
          return;
        }
        wx.showToast({ title: '加入成功', icon: 'success' });
        wx.switchTab({ url: '/pages/overview/overview' });
      })
      .catch(function (err) {
        wx.showToast({
          title: (err && err.message) || '加入失败',
          icon: 'none'
        });
      })
      .then(() => {
        this.setData({ submitting: false });
      });
  }
});
