const request = require('../../utils/request');
const util = require('../../utils/util');
const auth = require('../../utils/auth');

function formatInt(n) {
  const num = parseInt(n, 10);
  if (Number.isNaN(num)) return '0';
  return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function recorderInitial(name) {
  const s = (name || '').trim();
  if (!s) return '';
  return s.charAt(0);
}

function emptyDetailState() {
  return {
    shiftName: '—',
    recordDateDisplay: '—',
    recorderName: '—',
    recorderInitial: '',
    qtySoldFormatted: '0',
    qtyOpeningFormatted: '0',
    qtyClosingFormatted: '0',
    qtyGiftFormatted: '0',
    soldWechat: 0,
    soldAlipay: 0,
    soldCash: 0,
    wechatAmountStr: '0.00',
    alipayAmountStr: '0.00',
    cashAmountStr: '0.00',
    cashOpeningStr: '0.00',
    cashClosingStr: '0.00',
    unitPrice: 0
  };
}

function mapRowToPageData(row) {
  const up = parseFloat(row.unit_price) || 0;
  const w = parseInt(row.sold_wechat, 10) || 0;
  const a = parseInt(row.sold_alipay, 10) || 0;
  const c = parseInt(row.sold_cash, 10) || 0;
  const dateStr = row.record_date || '';
  let recordDateDisplay = dateStr;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    recordDateDisplay = dateStr + ' ' + util.getWeekday(dateStr);
  }
  return {
    shiftName: row.shift_name || '班次记录',
    recordDateDisplay,
    recorderName: row.recorder_name || '—',
    recorderInitial: recorderInitial(row.recorder_name),
    qtySoldFormatted: formatInt(row.qty_sold),
    qtyOpeningFormatted: formatInt(row.qty_opening),
    qtyClosingFormatted: formatInt(row.qty_closing),
    qtyGiftFormatted: formatInt(row.qty_gift),
    soldWechat: w,
    soldAlipay: a,
    soldCash: c,
    wechatAmountStr: util.formatMoney(w * up),
    alipayAmountStr: util.formatMoney(a * up),
    cashAmountStr: util.formatMoney(c * up),
    cashOpeningStr: util.formatMoney(row.cash_opening),
    cashClosingStr: util.formatMoney(row.cash_closing),
    unitPrice: up
  };
}

Page({
  data: emptyDetailState(),

  onLoad(options) {
    if (!auth.redirectToLoginIfNeeded()) {
      return;
    }
    const idRaw = options.id;
    const id = idRaw != null && idRaw !== '' ? parseInt(String(idRaw), 10) : NaN;
    const date =
      options.date && /^\d{4}-\d{2}-\d{2}$/.test(String(options.date).trim())
        ? String(options.date).trim()
        : util.formatDate(new Date());

    if (Number.isNaN(id) || id <= 0) {
      // TODO: 接入单条记录接口后，可仅传 id 拉取详情；当前需 id + date 从列表接口筛选
      this.setData(emptyDetailState());
      wx.showToast({ title: '缺少记录参数', icon: 'none' });
      return;
    }

    this._recordId = id;
    this._recordDate = date;
    this.loadRecord(id, date);
  },

  loadRecord(id, date) {
    wx.showLoading({ title: '加载中', mask: true });

    request
      .get('/get_records.php', { date })
      .then((data) => {
        const raw = data && data.records;
        const list = Array.isArray(raw) ? raw : [];
        const row = list.find(function (r) {
          return parseInt(r.id, 10) === id;
        });
        if (!row) {
          wx.showToast({ title: '未找到该记录', icon: 'none' });
          this.setData(emptyDetailState());
          return;
        }
        this.setData(mapRowToPageData(row));
      })
      .catch(function () {
        this.setData(emptyDetailState());
      })
      .then(function () {
        wx.hideLoading();
      }.bind(this));
  }
});
