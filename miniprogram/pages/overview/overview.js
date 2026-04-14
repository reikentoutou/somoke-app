var request = require('../../utils/request');
var util = require('../../utils/util');
var auth = require('../../utils/auth');

function formatTimeRange(start, end) {
  var s = (start || '').toString();
  var e = (end || '').toString();
  var trim = function (t) {
    if (t.length >= 5) return t.slice(0, 5);
    return t;
  };
  return trim(s) + ' - ' + trim(e);
}

function shiftIconChar(shiftName) {
  var name = (shiftName || '').trim();
  if (!name) return '班';
  return name.charAt(0);
}

function shiftIconTone(shiftName) {
  var n = shiftName || '';
  if (/早|晨/.test(n)) return 'morning';
  if (/晚|夜/.test(n)) return 'night';
  if (/白|中/.test(n)) return 'day';
  return 'neutral';
}

function mapRecord(row) {
  return {
    id: row.id,
    record_date: row.record_date,
    shift_name: row.shift_name,
    shift_start: row.shift_start,
    shift_end: row.shift_end,
    recorder_name: row.recorder_name || '—',
    qty_sold: row.qty_sold,
    total_revenue: row.total_revenue,
    timeRange: formatTimeRange(row.shift_start, row.shift_end),
    revenueStr: util.formatMoney(row.total_revenue),
    iconChar: shiftIconChar(row.shift_name),
    iconTone: shiftIconTone(row.shift_name)
  };
}

Page({
  data: {
    todayDate: '',
    totalRevenueStr: '0.00',
    wechatAmountStr: '0.00',
    alipayAmountStr: '0.00',
    wechatQty: 0,
    alipayQty: 0,
    records: [],
    loadError: false
  },

  onShow: function () {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 0 });
    }

    var self = this;
    if (!auth.redirectToLoginIfNeeded()) {
      return;
    }
    if (!auth.redirectToOnboardingIfNeeded()) {
      return;
    }
    if (!auth.redirectToStoreSelectIfNeeded()) {
      return;
    }
    self.loadTodayData();
  },

  loadTodayData: function () {
    var self = this;
    var today = util.formatDate(new Date());
    if (typeof self._loadSeq !== 'number') {
      self._loadSeq = 0;
    }
    var seq = ++self._loadSeq;
    this.setData({ todayDate: today, loadError: false });

    wx.showLoading({ title: '加载中', mask: true });

    request
      .get('/get_records.php', { date: today })
      .then(function (data) {
        if (seq !== self._loadSeq) {
          return;
        }
        var summary = (data && data.summary) || {};
        var raw = data && data.records;
        var list = Array.isArray(raw) ? raw.map(mapRecord) : [];

        self.setData({
          totalRevenueStr: util.formatMoney(summary.total_revenue),
          wechatAmountStr: util.formatMoney(summary.total_wechat_amount),
          alipayAmountStr: util.formatMoney(summary.total_alipay_amount),
          wechatQty: summary.total_wechat_qty || 0,
          alipayQty: summary.total_alipay_qty || 0,
          records: list
        });
      })
      .catch(function () {
        if (seq !== self._loadSeq) {
          return;
        }
        self.setData({ loadError: true });
        wx.showToast({ title: '数据加载失败，请稍后重试', icon: 'none' });
      })
      .then(function () {
        if (seq === self._loadSeq) {
          wx.hideLoading();
        }
      });
  },

  goShiftDetail: function (e) {
    var id = e.currentTarget.dataset.id;
    var date = e.currentTarget.dataset.date;
    if (id == null || id === '') return;
    var q =
      '/pages/shift-detail/shift-detail?id=' +
      encodeURIComponent(String(id)) +
      (date ? '&date=' + encodeURIComponent(String(date)) : '');
    wx.navigateTo({ url: q });
  },

  goViewAll: function () {
    wx.switchTab({ url: '/pages/reports/reports' });
  }
});
