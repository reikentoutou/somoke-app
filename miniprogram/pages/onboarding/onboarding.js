var auth = require('../../utils/auth');
var storeUtil = require('../../utils/store');

Page({
  onShow() {
    if (!auth.redirectToLoginIfNeeded()) {
      return;
    }
    if (!storeUtil.sessionNeedsOnboarding()) {
      wx.switchTab({ url: '/pages/overview/overview' });
    }
  }
});
