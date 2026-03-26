/**
 * 封装 wx.request 网络请求工具
 * 统一处理：Token 注入、响应解析、401 自动重登
 *
 * 用法:
 *   const request = require('../../utils/request');
 *   request.post('/add_record.php', { ... }).then(data => { ... });
 *   request.get('/get_records.php', { month: '2026-03' }).then(data => { ... });
 */

const BASE_URL = 'https://api.phoenix-esportscafe.com';

var isRelogging = false;

function request(url, method, data) {
  var app = getApp();

  var token = app.globalData.token || wx.getStorageSync('token') || '';

  return new Promise(function (resolve, reject) {
    wx.request({
      url: BASE_URL + url,
      method: method,
      data: data,
      header: {
        'Content-Type': 'application/json',
        'Authorization': token ? ('Bearer ' + token) : ''
      },
      success: function (res) {
        if (res.data && res.data.code === 200) {
          resolve(res.data.data);

        } else if (res.data && res.data.code === 401) {
          wx.removeStorageSync('token');
          wx.removeStorageSync('userInfo');
          app.globalData.token = '';
          app.globalData.userInfo = null;

          wx.showToast({ title: '登录已失效，请重新登录', icon: 'none', duration: 2000 });

          if (!isRelogging) {
            isRelogging = true;
            setTimeout(function () {
              isRelogging = false;
              wx.reLaunch({ url: '/pages/login/login' });
            }, 400);
          }

          reject(new Error(res.data.msg || '登录已过期'));

        } else {
          var msg = (res.data && res.data.msg) ? res.data.msg : '请求失败';
          reject(new Error(msg));
        }
      },
      fail: function (err) {
        console.error('[request fail]', method, url, '| err:', JSON.stringify(err));
        var msg = '网络连接失败，请稍后重试';
        if (err && err.errMsg && err.errMsg.indexOf('timeout') !== -1) {
          msg = '服务器响应超时，请检查网络或稍后重试';
        }
        reject(new Error(msg));
      }
    });
  });
}

module.exports = {
  get:  function (url, data) { return request(url, 'GET', data); },
  post: function (url, data) { return request(url, 'POST', data); },
  BASE_URL: BASE_URL
};
