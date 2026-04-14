const request = require('../../utils/request');
const auth = require('../../utils/auth');

var TYPE_LABEL = {
  restock: '补货',
  adjust: '库存校准',
  record_add: '记账出库',
  record_update: '记账调整'
};

function formatDelta(n) {
  var v = parseInt(n, 10);
  if (Number.isNaN(v)) return '0';
  if (v > 0) return '+' + v;
  return String(v);
}

Page({
  data: {
    loading: true,
    errMsg: '',
    items: []
  },

  onShow() {
    if (!auth.redirectToLoginIfNeeded()) return;
    if (!auth.redirectToOnboardingIfNeeded()) return;
    if (!auth.redirectToStoreSelectIfNeeded()) return;
    this.loadList();
  },

  loadList() {
    var self = this;
    self.setData({ loading: true, errMsg: '' });
    request
      .get('/stock_ledger_list.php', { limit: 50 })
      .then(function (data) {
        var raw = data && data.items;
        var list = Array.isArray(raw) ? raw : [];
        var rows = list.map(function (it) {
          return Object.assign({}, it, {
            type_label: TYPE_LABEL[it.event_type] || it.event_type || '—',
            delta_display: formatDelta(it.delta),
            ref_line: it.ref_record_id ? '关联记录 #' + it.ref_record_id : ''
          });
        });
        self.setData({ items: rows, loading: false });
      })
      .catch(function (err) {
        self.setData({
          loading: false,
          errMsg: (err && err.message) || '加载失败',
          items: []
        });
      })
      .then(function () {
        try {
          wx.stopPullDownRefresh();
        } catch (e) {
          /* ignore */
        }
      });
  },

  onPullDownRefresh() {
    this.loadList();
  }
});
