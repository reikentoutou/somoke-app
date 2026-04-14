/**
 * 业务 API：统一走微信云函数 `api`（腾讯云开发），不再请求自建 PHP 域名。
 * 兼容原 request.get/post(path, data) 写法，内部映射为 callFunction action。
 */

var isRelogging = false;

var ACTION_MAP = {
  '/login.php': 'login',
  '/get_stores.php': 'getStores',
  '/store_create.php': 'storeCreate',
  '/store_switch.php': 'storeSwitch',
  '/store_join.php': 'storeJoin',
  '/store_invite_create.php': 'storeInviteCreate',
  '/get_shifts.php': 'getShifts',
  '/shift_config_save.php': 'shiftConfigSave',
  '/shift_config_delete.php': 'shiftConfigDelete',
  '/get_records.php': 'getRecords',
  '/get_record.php': 'getRecord',
  '/add_record.php': 'addRecord',
  '/update_record.php': 'updateRecord',
  '/store_detail.php': 'storeDetail',
  '/recorder_name_add.php': 'recorderNameAdd',
  '/recorder_name_delete.php': 'recorderNameDelete',
  '/store_members.php': 'getStoreMembers',
  '/store_member_remove.php': 'storeMemberRemove',
  '/store_member_set_role.php': 'storeMemberSetRole',
  '/store_restock.php': 'storeRestock',
  '/withdraw_list.php': 'withdrawList',
  '/withdraw_add.php': 'withdrawAdd',
  '/profile_update.php': 'updateProfile'
};

function isTimeoutLikeErr(err) {
  var m = String((err && (err.errMsg || err.message)) || '');
  return m.indexOf('timeout') !== -1 || m.indexOf('Timed out') !== -1;
}

function wxFailToError(err) {
  var msg = '网络异常，请稍后重试';
  if (err && err.errMsg && err.errMsg.indexOf('timeout') !== -1) {
    msg = '请求超时，请稍后重试';
  }
  return new Error(msg);
}

function handleCloudBody(body, app, resolve, reject) {
  if (!body || typeof body !== 'object') {
    reject(new Error('服务响应异常，请稍后重试'));
    return;
  }
  if (body.code === 200) {
    resolve(body.data);
    return;
  }
  if (body.code === 401) {
    wx.removeStorageSync('token');
    wx.removeStorageSync('userInfo');
    wx.removeStorageSync('currentStoreId');
    wx.removeStorageSync('needsOnboarding');
    wx.removeStorageSync('needsStoreSelection');
    app.globalData.token = '';
    app.globalData.userInfo = null;
    app.globalData.currentStoreId = 0;
    wx.showToast({ title: '登录已失效，请重新登录', icon: 'none', duration: 2000 });
    if (!isRelogging) {
      isRelogging = true;
      setTimeout(function () {
        isRelogging = false;
        wx.reLaunch({ url: '/pages/login/login' });
      }, 400);
    }
    reject(new Error(body.msg || '登录已过期'));
    return;
  }
  var errText = body.msg || '请求失败';
  if (typeof errText === 'string' && errText.indexOf('未知 action') !== -1) {
    errText = '服务暂时不可用，请稍后再试';
  }
  reject(new Error(errText));
}

/** 单次 callFunction，不重试 */
function callCloudOnce(action, data) {
  var app = getApp();
  /** action 放最后，避免 data 里误带 action 覆盖路由名 */
  var payload = Object.assign({}, data || {}, { action: action });
  return new Promise(function (resolve, reject) {
    if (!wx.cloud) {
      reject(new Error('请更新微信后重试'));
      return;
    }
    wx.cloud.callFunction({
      name: 'api',
      data: payload,
      timeout: 60000,
      success: function (res) {
        try {
          handleCloudBody(res.result, app, resolve, reject);
        } catch (e) {
          reject(e);
        }
      },
      fail: function (err) {
        console.error('[cloud fail]', action, err);
        reject(err);
      }
    });
  });
}

/**
 * 云函数调用：超时类错误自动重试 1 次（缓解冷启动、热重载打断、网络抖动）
 */
function callCloud(action, data) {
  return callCloudOnce(action, data).catch(function (firstErr) {
    if (!isTimeoutLikeErr(firstErr)) {
      if (firstErr instanceof Error) {
        return Promise.reject(firstErr);
      }
      return Promise.reject(wxFailToError(firstErr));
    }
    return new Promise(function (r) {
      setTimeout(r, 500);
    }).then(function () {
      return callCloudOnce(action, data);
    });
  }).catch(function (err) {
    if (err instanceof Error) {
      return Promise.reject(err);
    }
    return Promise.reject(wxFailToError(err));
  });
}

function request(url, method, data) {
  var act = ACTION_MAP[url];
  if (!act) {
    return Promise.reject(new Error('未配置的云接口: ' + url));
  }
  return callCloud(act, data || {});
}

module.exports = {
  get: function (url, data) {
    return request(url, 'GET', data || {});
  },
  post: function (url, data) {
    return request(url, 'POST', data || {});
  },
  callCloud: callCloud,
  BASE_URL: ''
};
