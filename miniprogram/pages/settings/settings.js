const app = getApp();
const auth = require('../../utils/auth');

function avatarLetter(name) {
  const c = (name || '?').trim().charAt(0);
  return /[a-z]/i.test(c) ? c.toUpperCase() : c;
}

Page({
  data: {
    userInfo: null,
    storeInfo: {
      stock: 128,
      price: '0.00',
      withdrawnFormatted: '4,200.00'
    },
    displayName: '—',
    roleText: '—',
    avatarLetter: '?',
    restockQty: ''
  },

  onShow() {
    if (typeof this.getTabBar === 'function') {
      this.getTabBar().setData({ selected: 3 });
    }
    if (!auth.redirectToLoginIfNeeded()) {
      return;
    }
    this.loadUserInfo();
  },

  loadUserInfo() {
    const u = app.globalData.userInfo || wx.getStorageSync('userInfo') || null;
    const name = (u && u.nickname) ? u.nickname : '未设置昵称';
    const roleText =
      u && Number(u.role) === 1 ? '管理员' : '员工';
    this.setData({
      userInfo: u,
      displayName: name,
      roleText: roleText,
      avatarLetter: avatarLetter(name)
    });
  },

  onRestockInput(e) {
    this.setData({ restockQty: e.detail.value });
  },

  doRestock() {
    wx.showToast({
      title: '补货已记录（演示）',
      icon: 'none'
    });
  },

  logout() {
    wx.removeStorageSync('token');
    wx.removeStorageSync('userInfo');
    app.globalData.token = '';
    app.globalData.userInfo = null;
    wx.reLaunch({ url: '/pages/login/login' });
  }
});
