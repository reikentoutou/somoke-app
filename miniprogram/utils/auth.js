var storeUtil = require('./store');

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

/**
 * 已登录但需 onboarding 或无有效门店时，跳转 onboarding（须在 redirectToLoginIfNeeded 通过之后调用）
 */
function redirectToOnboardingIfNeeded() {
  if (!storeUtil.sessionNeedsOnboarding()) {
    return true;
  }
  wx.redirectTo({ url: '/pages/onboarding/onboarding' });
  return false;
}

/**
 * 多门店且当前门店未在服务端选中时，先选店（须在登录、onboarding 校验之后）
 */
function redirectToStoreSelectIfNeeded() {
  if (!storeUtil.sessionNeedsStoreSelection()) {
    return true;
  }
  wx.redirectTo({ url: '/pages/store-select/store-select' });
  return false;
}

module.exports = {
  redirectToLoginIfNeeded: redirectToLoginIfNeeded,
  redirectToOnboardingIfNeeded: redirectToOnboardingIfNeeded,
  redirectToStoreSelectIfNeeded: redirectToStoreSelectIfNeeded
};
