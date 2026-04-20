var storeUtil = require('./utils/store');

App({
  globalData: {
    userInfo: null,
    token: '',
    currentStoreId: 0,
    baseUrl: ''
  },

  onLaunch() {
    if (!wx.cloud) {
      console.error('请使用支持云开发的基础库版本');
    } else {
      wx.cloud.init({
        /* 与开发者工具/后台当前选中云环境一致，避免硬编码 env 与部署环境不一致导致调用挂起、误报 timeout */
        env: wx.cloud.DYNAMIC_CURRENT_ENV,
        traceUser: true
      });
    }
    var token = wx.getStorageSync('token');
    var userInfo = wx.getStorageSync('userInfo');
    if (token) {
      this.globalData.token = token;
      this.globalData.userInfo = userInfo;
    }
    storeUtil.hydrateStoreFromStorage(this);
  },

  /**
   * 微信登录：wx.login → 后端换取 openid → 返回自定义 token、user_info、needs_onboarding 等
   */
  login() {
    var self = this;
    return new Promise(function (resolve, reject) {
      wx.login({
        success: function (loginRes) {
          var request = require('./utils/request');
          request
            .post('/login.php', {
              code: loginRes.code
            })
            .then(function (data) {
              storeUtil.persistSession(self, data);
              resolve(data);
            })
            .catch(reject);
        },
        fail: reject
      });
    });
  }

});
