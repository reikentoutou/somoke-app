App({
  globalData: {
    userInfo: null,
    token: '',
    baseUrl: 'https://api.phoenix-esportscafe.com'
  },

  onLaunch() {
    const token = wx.getStorageSync('token');
    const userInfo = wx.getStorageSync('userInfo');
    if (token) {
      this.globalData.token = token;
      this.globalData.userInfo = userInfo;
    }
  },

  /**
   * 微信登录：wx.login → 后端换取 openid → 返回自定义 token
   */
  login() {
    return new Promise((resolve, reject) => {
      wx.login({
        success: (loginRes) => {
          if (!loginRes.code) {
            reject(new Error('wx.login 失败'));
            return;
          }
          const request = require('./utils/request');
          request.post('/login.php', { code: loginRes.code })
            .then(data => {
              this.globalData.token = data.token;
              this.globalData.userInfo = data.user_info;
              wx.setStorageSync('token', data.token);
              wx.setStorageSync('userInfo', data.user_info);
              resolve(data);
            })
            .catch(reject);
        },
        fail: reject
      });
    });
  },

});
