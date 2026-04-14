const app = getApp();
const storeUtil = require('../../utils/store');

Page({
  data: {
    loading: false
  },

  onShow() {
    var token = app.globalData.token || wx.getStorageSync('token');
    if (token) {
      if (storeUtil.sessionNeedsOnboarding()) {
        wx.redirectTo({ url: '/pages/onboarding/onboarding' });
      } else if (storeUtil.sessionNeedsStoreSelection()) {
        wx.redirectTo({ url: '/pages/store-select/store-select' });
      } else {
        wx.switchTab({ url: '/pages/overview/overview' });
      }
    }
  },

  onWxLogin() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    app
      .login()
      .then(function (data) {
        if (storeUtil.loginPayloadNeedsOnboarding(data)) {
          wx.redirectTo({ url: '/pages/onboarding/onboarding' });
        } else if (storeUtil.loginPayloadNeedsStoreSelection(data)) {
          wx.redirectTo({ url: '/pages/store-select/store-select' });
        } else {
          wx.switchTab({ url: '/pages/overview/overview' });
        }
      })
      .catch(function () {
        wx.showToast({ title: '登录失败，请重试', icon: 'none' });
      })
      .then(() => {
        this.setData({ loading: false });
      });
  }
});
