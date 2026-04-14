const request = require('../../utils/request');
const util = require('../../utils/util');
const auth = require('../../utils/auth');
const storeUtil = require('../../utils/store');
const ledgerForm = require('../../utils/ledgerRecordForm');

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
    canEdit: false,
    editing: false,
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
    unitPrice: 0,
    /** 内联编辑（与录入页字段对齐） */
    shiftConfigs: [],
    selectedShiftIndex: 0,
    shiftPickerLabel: '请选择',
    recorderNameList: [''],
    recorderNameIndex: 0,
    recorderPickerDisplay: '',
    recordDate: '',
    qtyOpening: '',
    qtyClosing: '',
    qtyGift: '',
    soldWechatStr: '',
    soldAlipayStr: '',
    soldCashStr: '',
    cashOpening: '',
    cashClosing: '',
    qtySold: 0,
    paymentSoldTotal: 0,
    totalRevenueJpy: '0',
    unitPriceLabel: String(ledgerForm.ITEM_UNIT_PRICE_JPY),
    softWarnings: [],
    hasSoftWarnings: false,
    editSubmitting: false
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
    if (!auth.redirectToOnboardingIfNeeded()) {
      return;
    }
    if (!auth.redirectToStoreSelectIfNeeded()) {
      return;
    }
    const idRaw = options.id;
    const id = idRaw != null && idRaw !== '' ? parseInt(String(idRaw), 10) : NaN;
    const date =
      options.date && /^\d{4}-\d{2}-\d{2}$/.test(String(options.date).trim())
        ? String(options.date).trim()
        : util.formatDate(new Date());

    if (Number.isNaN(id) || id <= 0) {
      this.setData(emptyDetailState());
      wx.showToast({ title: '缺少记录参数', icon: 'none' });
      return;
    }

    this._recordId = id;
    this._recordDate = date;
    this._editSourceRow = null;
    this.loadRecord(id, date);
  },

  computeCanEdit(row) {
    var app = getApp();
    var u = app.globalData.userInfo || wx.getStorageSync('userInfo') || {};
    var myId =
      u.id != null ? parseInt(u.id, 10) : u.userId != null ? parseInt(u.userId, 10) : NaN;
    var rid = row.recorder_id != null ? parseInt(row.recorder_id, 10) : NaN;
    if (storeUtil.isBossInCurrentStore(u)) return true;
    if (!Number.isNaN(myId) && myId > 0 && !Number.isNaN(rid) && rid === myId) return true;
    return false;
  },

  loadRecord(id, date) {
    var self = this;
    wx.showLoading({ title: '加载中', mask: true });

    function applyRow(row) {
      if (!row) {
        wx.showToast({ title: '未找到该记录', icon: 'none' });
        self._editSourceRow = null;
        self.setData(emptyDetailState());
        return;
      }
      self._editSourceRow = row;
      self.setData(Object.assign(emptyDetailState(), mapRowToPageData(row), { canEdit: self.computeCanEdit(row) }));
    }

    request
      .get('/get_record.php', { id: id })
      .then(function (data) {
        var rec = data && data.record;
        if (rec) {
          applyRow(rec);
          return;
        }
        return request.get('/get_records.php', { date: date }).then(function (data2) {
          var raw = data2 && data2.records;
          var list = Array.isArray(raw) ? raw : [];
          var row = list.find(function (r) {
            return parseInt(r.id, 10) === id;
          });
          applyRow(row);
        });
      })
      .catch(function () {
        return request.get('/get_records.php', { date: date }).then(function (data2) {
          var raw = data2 && data2.records;
          var list = Array.isArray(raw) ? raw : [];
          var row = list.find(function (r) {
            return parseInt(r.id, 10) === id;
          });
          applyRow(row);
        });
      })
      .catch(function () {
        self._editSourceRow = null;
        self.setData(emptyDetailState());
      })
      .then(function () {
        try {
          wx.hideLoading();
        } catch (e) {
          /* ignore */
        }
      });
  },

  onTapEditRecord() {
    var self = this;
    var row = this._editSourceRow;
    if (!this._recordId || !row) {
      wx.showToast({ title: '记录未加载完成', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '加载中', mask: true });
    Promise.all([request.get('/get_shifts.php', {}), request.get('/store_detail.php', {})])
      .then(function (results) {
        var shiftConfigs = Array.isArray(results[0]) ? results[0] : [];
        var detail = results[1] || {};
        if (!shiftConfigs.length) {
          wx.showToast({ title: '请先在设置中配置班次', icon: 'none' });
          return;
        }
        if (!ledgerForm.shiftConfigMatched(shiftConfigs, row.shift_config_id)) {
          wx.showModal({
            title: '无法编辑',
            content:
              '该记录关联的班次已停用或已删除。请先在「设置 → 班次设置」中恢复对应班次后，再尝试修改。',
            showCancel: false
          });
          return;
        }
        var app = getApp();
        var u = app.globalData.userInfo || wx.getStorageSync('userInfo') || {};
        var sid = storeUtil.getStoreIdFromUserInfo(u);
        var key = sid ? 'ledger_recorder_' + sid : 'ledger_recorder';
        var saved = wx.getStorageSync(key) || '';
        var rawNames = detail && detail.recorder_names;
        var list = [];
        if (Array.isArray(rawNames)) {
          for (var j = 0; j < rawNames.length; j++) {
            var one = rawNames[j];
            if (one == null) continue;
            var t = String(one).trim();
            if (t) list.push(t);
          }
        }
        var nm = row.recorder_name ? String(row.recorder_name).trim() : '';
        if (nm && list.indexOf(nm) < 0) {
          list.unshift(nm);
        }
        if (!list.length) {
          var nick = (u && u.nickname && String(u.nickname).trim()) || '员工';
          list = [nick];
        }
        var ridx = 0;
        for (var i = 0; i < list.length; i++) {
          if (list[i] === saved) {
            ridx = i;
            break;
          }
        }
        if (nm) {
          var hit = list.indexOf(nm);
          if (hit >= 0) ridx = hit;
        }
        var ix = ledgerForm.shiftIndexForConfigId(shiftConfigs, row.shift_config_id);
        var label =
          shiftConfigs[ix] && shiftConfigs[ix].name
            ? shiftConfigs[ix].name
            : row.shift_name || '请选择';
        var picked = list[ridx] || list[0] || '';
        var formData = {
          editing: true,
          shiftConfigs: shiftConfigs,
          selectedShiftIndex: ix,
          shiftPickerLabel: label,
          recorderNameList: list,
          recorderNameIndex: ridx,
          recorderPickerDisplay: picked || nm,
          recordDate: row.record_date || '',
          qtyOpening: row.qty_opening != null ? String(row.qty_opening) : '',
          qtyClosing: row.qty_closing != null ? String(row.qty_closing) : '',
          qtyGift: row.qty_gift != null ? String(row.qty_gift) : '',
          soldWechatStr: row.sold_wechat != null ? String(row.sold_wechat) : '',
          soldAlipayStr: row.sold_alipay != null ? String(row.sold_alipay) : '',
          soldCashStr: row.sold_cash != null ? String(row.sold_cash) : '',
          cashOpening: row.cash_opening != null ? String(row.cash_opening) : '',
          cashClosing: row.cash_closing != null ? String(row.cash_closing) : '',
          unitPriceLabel: String(ledgerForm.ITEM_UNIT_PRICE_JPY),
          editSubmitting: false
        };
        self.setData(formData, function () {
          self.calculateEditSummary();
        });
        try {
          wx.setNavigationBarTitle({ title: '修改记账' });
        } catch (e) {
          /* ignore */
        }
      })
      .catch(function () {
        wx.showToast({ title: '加载失败，请重试', icon: 'none' });
      })
      .then(function () {
        try {
          wx.hideLoading();
        } catch (e2) {
          /* ignore */
        }
      });
  },

  cancelInlineEdit() {
    var self = this;
    var id = this._recordId;
    var date = this._recordDate;
    this.setData({ editing: false, editSubmitting: false }, function () {
      try {
        wx.setNavigationBarTitle({ title: '班次详情' });
      } catch (e) {
        /* ignore */
      }
      if (id) {
        self.loadRecord(id, date);
      }
    });
  },

  onEditDateChange(e) {
    this.setData({ recordDate: e.detail.value });
  },

  onEditShiftChange(e) {
    var ix = parseInt(e.detail.value, 10);
    if (Number.isNaN(ix)) ix = 0;
    var list = this.data.shiftConfigs || [];
    if (ix < 0 || ix >= list.length) ix = 0;
    var label =
      list[ix] && list[ix].name ? list[ix].name : list[0] && list[0].name ? list[0].name : '请选择';
    this.setData({ selectedShiftIndex: ix, shiftPickerLabel: label });
  },

  onEditRecorderPick(e) {
    var ix = parseInt(e.detail.value, 10);
    if (Number.isNaN(ix)) ix = 0;
    var list = this.data.recorderNameList || [];
    if (ix < 0 || ix >= list.length) ix = 0;
    var app = getApp();
    var u = app.globalData.userInfo || wx.getStorageSync('userInfo') || {};
    var sid = storeUtil.getStoreIdFromUserInfo(u);
    var key = sid ? 'ledger_recorder_' + sid : 'ledger_recorder';
    var picked = list[ix] || '';
    wx.setStorageSync(key, picked);
    this.setData({ recorderNameIndex: ix, recorderPickerDisplay: picked });
  },

  onEditInput(e) {
    var field = e.currentTarget.dataset.field;
    if (!field) return;
    this.setData({ [field]: e.detail.value });
    this.calculateEditSummary();
  },

  calculateEditSummary() {
    var d = {
      qtyOpening: this.data.qtyOpening,
      qtyClosing: this.data.qtyClosing,
      qtyGift: this.data.qtyGift,
      soldWechat: this.data.soldWechatStr,
      soldAlipay: this.data.soldAlipayStr,
      soldCash: this.data.soldCashStr,
      cashOpening: this.data.cashOpening,
      cashClosing: this.data.cashClosing
    };
    var s = ledgerForm.computeSummary(d);
    this.setData(s);
  },

  submitInlineEdit() {
    if (this.data.editSubmitting) return;
    var self = this;
    var id = this._recordId;
    if (!id) return;

    var recordDate = this.data.recordDate;
    var shiftConfigs = this.data.shiftConfigs || [];
    if (!recordDate) {
      wx.showToast({ title: '请选择日期', icon: 'none' });
      return;
    }
    if (!shiftConfigs.length) {
      wx.showToast({ title: '班次配置无效', icon: 'none' });
      return;
    }
    var recorderName = String(this.data.recorderPickerDisplay || '').trim();
    if (!recorderName) {
      wx.showToast({ title: '请选择记账姓名', icon: 'none' });
      return;
    }

    var postBody = {
      id: id,
      record_date: recordDate,
      shift_config_id: shiftConfigs[this.data.selectedShiftIndex].id,
      recorder_name: recorderName,
      qty_opening: parseInt(this.data.qtyOpening, 10) || 0,
      qty_closing: parseInt(this.data.qtyClosing, 10) || 0,
      qty_gift: parseInt(this.data.qtyGift, 10) || 0,
      sold_wechat: parseInt(this.data.soldWechatStr, 10) || 0,
      sold_alipay: parseInt(this.data.soldAlipayStr, 10) || 0,
      sold_cash: parseInt(this.data.soldCashStr, 10) || 0,
      cash_opening: parseFloat(this.data.cashOpening) || 0,
      cash_closing: parseFloat(this.data.cashClosing) || 0
    };

    var runPost = function () {
      self.setData({ editSubmitting: true });
      request
        .post('/update_record.php', postBody)
        .then(function () {
          wx.showToast({ title: '已保存修改', icon: 'success', duration: 2000 });
          self.setData({ editing: false, editSubmitting: false });
          try {
            wx.setNavigationBarTitle({ title: '班次详情' });
          } catch (e) {
            /* ignore */
          }
          self.loadRecord(id, recordDate);
        })
        .catch(function (err) {
          self.setData({ editSubmitting: false });
          wx.showToast({ title: (err && err.message) || '保存失败', icon: 'none' });
        });
    };

    var warns = this.data.softWarnings || [];
    if (warns.length) {
      wx.showModal({
        title: '数据核对提醒',
        content: warns.join('\n\n'),
        confirmText: '仍要保存',
        cancelText: '返回修改',
        success: function (res) {
          if (res.confirm) runPost();
        }
      });
      return;
    }
    runPost();
  }
});
