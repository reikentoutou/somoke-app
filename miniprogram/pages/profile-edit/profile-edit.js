const request = require('../../utils/request');
const auth = require('../../utils/auth');
const storeUtil = require('../../utils/store');

Page({
  data: {
    nickname: '',
    submitting: false
  },

  onShow() {
    if (!auth.redirectToLoginIfNeeded()) {
      return;
    }
    var app = getApp();
    var u = app.globalData.userInfo || wx.getStorageSync('userInfo') || {};
    var n = u.nickname != null && String(u.nickname).trim() ? String(u.nickname).trim() : '';
    this.setData({ nickname: n });
  },

  onNicknameInput(e) {
    this.setData({ nickname: (e.detail && e.detail.value) || '' });
  },

  onSubmit() {
    if (this.data.submitting) return;
    var name = (this.data.nickname || '').trim();
    if (!name) {
      wx.showToast({ title: '请填写昵称', icon: 'none' });
      return;
    }
    this.setData({ submitting: true });
    var app = getApp();
    var self = this;
    request
      .post('/profile_update.php', { nickname: name })
      .then(function (data) {
        storeUtil.mergeUserInfoFromApiResponse(app, data);
        wx.showToast({ title: '已保存', icon: 'success' });
        setTimeout(function () {
          wx.navigateBack();
        }, 450);
      })
      .catch(function (err) {
        wx.showToast({ title: (err && err.message) || '保存失败', icon: 'none' });
      })
      .then(function () {
        self.setData({ submitting: false });
      });
  }
});
