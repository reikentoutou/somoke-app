var app = getApp();
var auth = require('../../utils/auth');
var storeUtil = require('../../utils/store');
var request = require('../../utils/request');

function decorateStores(raw, u) {
  var list = Array.isArray(raw) ? raw : [];
  var cur = u ? storeUtil.getStoreIdFromUserInfo(u) : 0;
  return list.map(function (s) {
    var sid = s.store_id;
    var nm = s.name && String(s.name).trim() ? s.name : '';
    var dn = nm ? nm : '门店 #' + sid;
    var ch = String(dn).trim().charAt(0) || '店';
    return {
      store_id: sid,
      name: nm,
      role: s.role,
      displayName: dn,
      roleLabel: s.role === 1 ? '老板' : '员工',
      isCurrent: sid === cur,
      avatarLetter: /[a-z]/i.test(ch) ? ch.toUpperCase() : ch
    };
  });
}

Page({
  data: {
    stores: [],
    hasStores: false,
    isStoreListEmpty: true,
    fromSettings: false,
    loading: false,
    joinInviteCode: '',
    joinSubmitting: false
  },

  onLoad(options) {
    this._from = (options && options.from) || '';
    var fromSettings = this._from === 'settings';
    this.setData({ fromSettings: fromSettings });
    wx.setNavigationBarTitle({
      title: fromSettings ? '我的门店' : '选择门店'
    });
  },

  onShow() {
    if (!auth.redirectToLoginIfNeeded()) {
      return;
    }
    if (storeUtil.sessionNeedsOnboarding()) {
      wx.redirectTo({ url: '/pages/onboarding/onboarding' });
      return;
    }

    var self = this;

    function applyListFromUser(userDoc) {
      var normalized = storeUtil.normalizeStores(userDoc);
      var list = decorateStores(normalized, userDoc);
      var hasStores = list.length > 0;
      self.setData({
        stores: list,
        hasStores: hasStores,
        isStoreListEmpty: !hasStores,
        loading: false
      });
      if (!hasStores) {
        return;
      }
      if (!storeUtil.sessionNeedsStoreSelection() && !self._from) {
        wx.switchTab({ url: '/pages/overview/overview' });
      }
    }

    if (this._from === 'settings') {
      self.setData({ loading: true });
      request
        .get('/get_stores.php', {})
        .then(function (data) {
          var apiList = data && data.stores;
          storeUtil.applyStoresListRefreshed(app, apiList, data && data.current_store_id);
          var u = app.globalData.userInfo || wx.getStorageSync('userInfo') || {};
          applyListFromUser(u);
        })
        .catch(function () {
          var u = app.globalData.userInfo || wx.getStorageSync('userInfo') || {};
          applyListFromUser(u);
          wx.showToast({ title: '已显示本地列表', icon: 'none' });
        });
      return;
    }

    var u = app.globalData.userInfo || wx.getStorageSync('userInfo') || {};
    applyListFromUser(u);
  },

  onPickStore(e) {
    var id = e.currentTarget.dataset.id;
    var sid = parseInt(id, 10);
    if (Number.isNaN(sid) || sid <= 0) {
      return;
    }
    var cur = storeUtil.getStoreIdFromUserInfo(app.globalData.userInfo || wx.getStorageSync('userInfo') || {});
    if (this._from === 'settings' && sid === cur) {
      wx.showToast({ title: '已是当前门店', icon: 'none' });
      return;
    }
    var self = this;
    wx.showLoading({ title: '切换中', mask: true });
    request
      .post('/store_switch.php', { store_id: sid })
      .then(function (data) {
        var ok = storeUtil.applyStoreSwitchSuccess(app, data);
        if (!ok) {
          wx.showToast({ title: '切换失败', icon: 'none' });
          return;
        }
        wx.showToast({ title: '已切换', icon: 'success' });
        if (self._from === 'settings') {
          wx.navigateBack();
        } else {
          wx.switchTab({ url: '/pages/overview/overview' });
        }
      })
      .catch(function (err) {
        wx.showToast({ title: (err && err.message) || '切换失败', icon: 'none' });
      })
      .then(function () {
        wx.hideLoading();
      });
  },

  goCreateStore() {
    wx.navigateTo({ url: '/pages/store-create/store-create?from=settings' });
  },

  onJoinCodeInput(e) {
    this.setData({ joinInviteCode: (e.detail && e.detail.value) || '' });
  },

  submitJoin() {
    if (this.data.joinSubmitting) return;
    var code = (this.data.joinInviteCode || '').trim();
    if (!code) {
      wx.showToast({ title: '请输入邀请码', icon: 'none' });
      return;
    }
    var self = this;
    self.setData({ joinSubmitting: true });
    wx.showLoading({ title: '加入中', mask: true });
    request
      .post('/store_join.php', { code: code })
      .then(function (data) {
        var merged = storeUtil.applyStoreJoinSuccess(app, data);
        if (!merged) {
          wx.showToast({ title: '加入成功但状态异常，请重新登录', icon: 'none' });
          return;
        }
        wx.showToast({ title: '已加入', icon: 'success' });
        self.setData({ joinInviteCode: '' });
        if (self._from === 'settings') {
          return request
            .get('/get_stores.php', {})
            .then(function (resp) {
              storeUtil.applyStoresListRefreshed(app, resp && resp.stores, resp && resp.current_store_id);
            })
            .catch(function () {
              /* 列表接口失败时仍展示本地已合并的门店 */
            })
            .then(function () {
              var u = app.globalData.userInfo || wx.getStorageSync('userInfo') || {};
              var list = decorateStores(storeUtil.normalizeStores(u), u);
              self.setData({
                stores: list,
                hasStores: list.length > 0,
                isStoreListEmpty: !list.length
              });
            });
        }
        wx.switchTab({ url: '/pages/overview/overview' });
      })
      .catch(function (err) {
        wx.showToast({ title: (err && err.message) || '加入失败', icon: 'none' });
      })
      .then(function () {
        try {
          wx.hideLoading();
        } catch (e) {
          /* ignore */
        }
        self.setData({ joinSubmitting: false });
      });
  }
});
