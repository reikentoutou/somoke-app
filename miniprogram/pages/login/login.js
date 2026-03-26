const app = getApp();

Page({
  data: {
    loading: false
  },

  onShow() {
    var token = app.globalData.token || wx.getStorageSync('token');
    if (token) {
      wx.switchTab({ url: '/pages/overview/overview' });
    }
  },

  onWxLogin() {
    if (this.data.loading) return;
    this.setData({ loading: true });
    app
      .login()
      .then(function () {
        wx.switchTab({ url: '/pages/overview/overview' });
      })
      .catch(function () {
        wx.showToast({ title: '登录失败，请重试', icon: 'none' });
      })
      .then(() => {
        this.setData({ loading: false });
      });
  }
});
