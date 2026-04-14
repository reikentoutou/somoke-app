const auth = require('../../utils/auth');
const storeUtil = require('../../utils/store');
const request = require('../../utils/request');

Page({
  data: {
    loading: true,
    errMsg: '',
    names: [],
    newName: '',
    canEdit: false
  },

  onShow() {
    if (!auth.redirectToLoginIfNeeded()) return;
    if (!auth.redirectToOnboardingIfNeeded()) return;
    if (!auth.redirectToStoreSelectIfNeeded()) return;
    var app = getApp();
    var u = app.globalData.userInfo || wx.getStorageSync('userInfo');
    this.setData({ canEdit: storeUtil.isBossInCurrentStore(u) });
    this.loadNames();
  },

  loadNames() {
    var self = this;
    self.setData({ loading: true, errMsg: '' });
    request
      .get('/store_detail.php', {})
      .then(function (detail) {
        var raw = detail && detail.recorder_names;
        var list = Array.isArray(raw) ? raw.slice() : [];
        self.setData({ names: list, loading: false });
      })
      .catch(function (err) {
        self.setData({
          loading: false,
          errMsg: (err && err.message) || '加载失败'
        });
      });
  },

  onNewNameInput(e) {
    this.setData({ newName: (e.detail && e.detail.value) || '' });
  },

  onAddName() {
    var self = this;
    if (!self.data.canEdit) return;
    var nm = (self.data.newName || '').trim();
    if (!nm) {
      wx.showToast({ title: '请输入姓名', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '保存中', mask: true });
    request
      .post('/recorder_name_add.php', { name: nm })
      .then(function (data) {
        try {
          wx.hideLoading();
        } catch (e) {
          /* ignore */
        }
        var list = data && data.recorder_names ? data.recorder_names : [];
        self.setData({ names: Array.isArray(list) ? list : [], newName: '' });
        wx.showToast({ title: '已添加', icon: 'success' });
      })
      .catch(function (err) {
        try {
          wx.hideLoading();
        } catch (e2) {
          /* ignore */
        }
        wx.showToast({ title: (err && err.message) || '添加失败', icon: 'none' });
      });
  },

  onDeleteName(e) {
    var self = this;
    if (!self.data.canEdit) return;
    var nm = e.currentTarget.dataset.name;
    if (nm == null || String(nm).trim() === '') return;
    var nameStr = String(nm);
    wx.showModal({
      title: '删除记账姓名',
      content: '确定从名单中删除「' + nameStr + '」？历史记录中的记账人显示不受影响。',
      confirmText: '删除',
      confirmColor: '#ba1a1a',
      success: function (res) {
        if (!res.confirm) return;
        wx.showLoading({ title: '删除中', mask: true });
        request
          .post('/recorder_name_delete.php', { name: nameStr })
          .then(function (data) {
            try {
              wx.hideLoading();
            } catch (e3) {
              /* ignore */
            }
            var list = data && data.recorder_names ? data.recorder_names : [];
            self.setData({ names: Array.isArray(list) ? list : [] });
            wx.showToast({ title: '已删除', icon: 'success' });
          })
          .catch(function (err) {
            try {
              wx.hideLoading();
            } catch (e4) {
              /* ignore */
            }
            wx.showToast({ title: (err && err.message) || '删除失败', icon: 'none' });
          });
      }
    });
  }
});
