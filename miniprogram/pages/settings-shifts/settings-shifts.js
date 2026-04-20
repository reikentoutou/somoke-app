const request = require('../../utils/request');
const auth = require('../../utils/auth');
const storeUtil = require('../../utils/store');

function timeToPickerValue(t) {
  if (!t) return '09:00';
  var p = String(t).split(':');
  var h = (p[0] || '9').trim();
  var m = (p[1] || '00').trim().replace(/\D/g, '').slice(0, 2) || '00';
  if (h.length === 1) h = '0' + h;
  if (h.length > 2) h = h.slice(-2);
  if (m.length === 1) m = '0' + m;
  return h + ':' + m;
}

Page({
  data: {
    shifts: [],
    loading: true,
    errMsg: '',
    canEdit: false,
    editorVisible: false,
    isAdd: true,
    editId: 0,
    formName: '',
    formStart: '09:00',
    formEnd: '18:00',
    formSort: '1',
    /** 编辑时沿用原图标，不在表单展示 */
    editIconSnapshot: '',
    saving: false
  },

  onShow() {
    if (!auth.redirectToLoginIfNeeded()) return;
    if (!auth.redirectToOnboardingIfNeeded()) return;
    if (!auth.redirectToStoreSelectIfNeeded()) return;
    var app = getApp();
    var u = app.globalData.userInfo || wx.getStorageSync('userInfo');
    this.setData({ canEdit: storeUtil.isBossInCurrentStore(u) });
    this.loadShifts();
  },

  loadShifts() {
    var self = this;
    /** 序号防竞态：保存/停用后立刻重拉，避免被慢请求覆盖新结果 */
    self._loadSeq = (self._loadSeq || 0) + 1;
    var seq = self._loadSeq;
    self.setData({ loading: true, errMsg: '' });
    request
      .get('/get_shifts.php', {})
      .then(function (list) {
        if (seq !== self._loadSeq) return;
        self.setData({
          shifts: Array.isArray(list) ? list : [],
          loading: false
        });
      })
      .catch(function (err) {
        if (seq !== self._loadSeq) return;
        self.setData({
          loading: false,
          errMsg: (err && err.message) || '加载失败'
        });
      });
  },

  noop() {},

  onShiftCardTap(e) {
    if (!this.data.canEdit) return;
    var id = e.currentTarget.dataset.id;
    var sid = parseInt(id, 10);
    if (Number.isNaN(sid) || sid <= 0) return;
    var list = this.data.shifts || [];
    var item = null;
    for (var i = 0; i < list.length; i++) {
      if (parseInt(list[i].id, 10) === sid) {
        item = list[i];
        break;
      }
    }
    if (!item) return;
    this.setData({
      editorVisible: true,
      isAdd: false,
      editId: sid,
      formName: item.name || '',
      formStart: timeToPickerValue(item.start_time),
      formEnd: timeToPickerValue(item.end_time),
      formSort: String(item.sort_order != null ? item.sort_order : 1),
      editIconSnapshot: item.icon || 'schedule'
    });
  },

  openAdd() {
    var list = this.data.shifts || [];
    var nextOrder = list.length ? Math.max.apply(null, list.map(function (x) { return x.sort_order || 0; })) + 1 : 1;
    this.setData({
      editorVisible: true,
      isAdd: true,
      editId: 0,
      formName: '',
      formStart: '09:00',
      formEnd: '18:00',
      formSort: String(nextOrder),
      editIconSnapshot: ''
    });
  },

  closeEditor() {
    if (this.data.saving) return;
    this.setData({ editorVisible: false });
  },

  onFormName(e) {
    this.setData({ formName: (e.detail && e.detail.value) || '' });
  },

  onFormStart(e) {
    this.setData({ formStart: e.detail.value || '09:00' });
  },

  onFormEnd(e) {
    this.setData({ formEnd: e.detail.value || '18:00' });
  },

  onFormSort(e) {
    this.setData({ formSort: (e.detail && e.detail.value) || '1' });
  },

  submitEditor() {
    if (this.data.saving) return;
    var name = (this.data.formName || '').trim();
    if (!name) {
      wx.showToast({ title: '请填写班次名称', icon: 'none' });
      return;
    }
    var self = this;
    var body = {
      name: name,
      start_time: self.data.formStart,
      end_time: self.data.formEnd,
      sort_order: parseInt(self.data.formSort, 10) || 0,
      icon: self.data.isAdd
        ? 'schedule'
        : ((self.data.editIconSnapshot || '').trim() || 'schedule')
    };
    if (!self.data.isAdd) {
      body.id = self.data.editId;
    }
    self.setData({ saving: true });
    request
      .post('/shift_config_save.php', body)
      .then(function () {
        wx.showToast({ title: self.data.isAdd ? '已添加' : '已保存', icon: 'success' });
        self.setData({ editorVisible: false });
        self.loadShifts();
      })
      .catch(function (err) {
        wx.showToast({ title: (err && err.message) || '保存失败', icon: 'none' });
      })
      .then(function () {
        self.setData({ saving: false });
      });
  },

  confirmDelete() {
    var self = this;
    if (self.data.isAdd || !self.data.editId) return;
    wx.showModal({
      title: '停用班次',
      content: '停用后录入页将不再显示该班次；已有历史记录仍保留。确定停用？',
      confirmText: '停用',
      confirmColor: '#ba1a1a',
      success: function (res) {
        if (!res.confirm) return;
        self.setData({ saving: true });
        request
          .post('/shift_config_delete.php', { id: self.data.editId })
          .then(function () {
            wx.showToast({ title: '已停用', icon: 'success' });
            self.setData({ editorVisible: false });
            self.loadShifts();
          })
          .catch(function (err) {
            wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' });
          })
          .then(function () {
            self.setData({ saving: false });
          });
      }
    });
  }
});
