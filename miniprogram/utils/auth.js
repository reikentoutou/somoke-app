/**
 * 未登录时跳转登录页（非 Tab 页），避免「退出后又静默登录」的错觉
 */
function redirectToLoginIfNeeded() {
  var app = getApp();
  var token = (app.globalData && app.globalData.token) || wx.getStorageSync('token');
  if (!token) {
    wx.redirectTo({ url: '/pages/login/login' });
    return false;
  }
  return true;
}

module.exports = {
  redirectToLoginIfNeeded: redirectToLoginIfNeeded
};
