const auth = require('../../utils/auth');
const storeUtil = require('../../utils/store');
const request = require('../../utils/request');

Page({
  data: {
    members: [],
    loading: true,
    errMsg: '',
    canEdit: false,
    myUserId: 0,
    bossCount: 0
  },

  onShow() {
    if (!auth.redirectToLoginIfNeeded()) return;
    if (!auth.redirectToOnboardingIfNeeded()) return;
    if (!auth.redirectToStoreSelectIfNeeded()) return;
    var app = getApp();
    var u = app.globalData.userInfo || wx.getStorageSync('userInfo') || {};
    var myId =
      u.id != null ? parseInt(u.id, 10) : u.userId != null ? parseInt(u.userId, 10) : 0;
    this.setData({
      canEdit: storeUtil.isBossInCurrentStore(u),
      myUserId: !Number.isNaN(myId) ? myId : 0
    });
    this.loadMembers();
  },

  loadMembers() {
    var self = this;
    self.setData({ loading: true, errMsg: '' });
    request
      .get('/store_members.php', {})
      .then(function (data) {
        var list = data && data.members ? data.members : [];
        var arr = Array.isArray(list) ? list : [];
        var bossCount = 0;
        for (var i = 0; i < arr.length; i++) {
          if (arr[i].role === 1) bossCount++;
        }
        self.setData({ members: arr, bossCount: bossCount, loading: false });
      })
      .catch(function (err) {
        self.setData({
          loading: false,
          errMsg: (err && err.message) || '加载失败'
        });
      });
  },

  onRemoveMember(e) {
    var uid = parseInt(e.currentTarget.dataset.userId, 10);
    if (!uid) return;
    var self = this;
    wx.showModal({
      title: '移除成员',
      content: '确定将该成员从本店移除？其将无法再访问本店数据。',
      confirmText: '移除',
      confirmColor: '#ba1a1a',
      success: function (res) {
        if (!res.confirm) return;
        wx.showLoading({ title: '处理中', mask: true });
        request
          .post('/store_member_remove.php', { user_id: uid })
          .then(function () {
            try {
              wx.hideLoading();
            } catch (e) {
              /* ignore */
            }
            wx.showToast({ title: '已移除', icon: 'success' });
            self.loadMembers();
          })
          .catch(function (err) {
            try {
              wx.hideLoading();
            } catch (e2) {
              /* ignore */
            }
            wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' });
          });
      }
    });
  },

  onLeaveStore() {
    var self = this;
    wx.showModal({
      title: '退出门店',
      content: '确定退出当前门店？退出后需重新加入或切换其他门店。',
      confirmText: '退出',
      confirmColor: '#ba1a1a',
      success: function (res) {
        if (!res.confirm) return;
        var myId = self.data.myUserId;
        if (!myId) return;
        wx.showLoading({ title: '处理中', mask: true });
        request
          .post('/store_member_remove.php', { user_id: myId })
          .then(function () {
            try {
              wx.hideLoading();
            } catch (e) {
              /* ignore */
            }
            wx.showToast({ title: '已退出', icon: 'success' });
            var app = getApp();
            request
              .get('/get_stores.php', {})
              .then(function (resp) {
                storeUtil.applyStoresListRefreshed(app, resp && resp.stores, resp && resp.current_store_id);
                var left = storeUtil.normalizeStores(app.globalData.userInfo || {});
                if (!left.length) {
                  wx.reLaunch({ url: '/pages/onboarding/onboarding' });
                } else {
                  wx.reLaunch({ url: '/pages/store-select/store-select' });
                }
              })
              .catch(function () {
                wx.reLaunch({ url: '/pages/store-select/store-select' });
              });
          })
          .catch(function (err) {
            try {
              wx.hideLoading();
            } catch (e2) {
              /* ignore */
            }
            wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' });
          });
      }
    });
  },

  onSetBoss(e) {
    var uid = parseInt(e.currentTarget.dataset.userId, 10);
    if (!uid) return;
    this._setRole(uid, 1, '将该成员设为管理员？');
  },

  onSetStaff(e) {
    var uid = parseInt(e.currentTarget.dataset.userId, 10);
    if (!uid) return;
    this._setRole(uid, 2, '将该成员设为员工？');
  },

  _setRole(userId, role, content) {
    var self = this;
    wx.showModal({
      title: '调整角色',
      content: content,
      confirmText: '确定',
      success: function (res) {
        if (!res.confirm) return;
        wx.showLoading({ title: '保存中', mask: true });
        request
          .post('/store_member_set_role.php', { user_id: userId, role: role })
          .then(function () {
            try {
              wx.hideLoading();
            } catch (e) {
              /* ignore */
            }
            wx.showToast({ title: '已更新', icon: 'success' });
            self.loadMembers();
          })
          .catch(function (err) {
            try {
              wx.hideLoading();
            } catch (e2) {
              /* ignore */
            }
            wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' });
          });
      }
    });
  }
});
