const request = require('../../utils/request');
const util = require('../../utils/util');
const auth = require('../../utils/auth');
const storeUtil = require('../../utils/store');
const ledgerForm = require('../../utils/ledgerRecordForm');

Page({
  data: {
    recordDate: '',
    shiftConfigs: [],
    selectedShiftIndex: 0,
    shiftPickerLabel: '请选择',
    /** 避免 selector 首帧 range=[] 触发渲染层异常，占位一项，加载后覆盖 */
    recorderNameList: [''],
    recorderNameIndex: 0,
    recorderPickerDisplay: '',

    qtyOpening: '',
    qtyClosing: '',
    qtyGift: '',
    soldWechat: '',
    soldAlipay: '',
    soldCash: '',
    cashOpening: '',
    cashClosing: '',

    qtySold: 0,
    paymentSoldTotal: 0,
    totalRevenueJpy: '0',
    unitPriceLabel: String(ledgerForm.ITEM_UNIT_PRICE_JPY),
    submitting: false,
    softWarnings: [],
    hasSoftWarnings: false,
    isEditMode: false,
    editRecordId: 0,
    entryTagLabel: '新增条目',
    entryTitle: '新增记账数据',
    submitBtnText: '确认提交数据'
  },

  onLoad() {
    this.setData({ recordDate: util.formatDate(new Date()) });
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({ selected: 1 });
    }
    if (!auth.redirectToLoginIfNeeded()) {
      return;
    }
    if (!auth.redirectToOnboardingIfNeeded()) {
      return;
    }
    if (!auth.redirectToStoreSelectIfNeeded()) {
      return;
    }
    var app = getApp();
    var pending = app.globalData && app.globalData.entryEdit;
    if (pending && pending.id) {
      app.globalData.entryEdit = null;
      this._pendingEditId = parseInt(pending.id, 10);
    } else {
      this._pendingEditId = null;
    }

    var self = this;
    this.loadShiftConfigs()
      .then(function () {
        return self.loadRecorderNames();
      })
      .then(function () {
        if (self._pendingEditId && !Number.isNaN(self._pendingEditId) && self._pendingEditId > 0) {
          var pid = self._pendingEditId;
          self._pendingEditId = null;
          return self.fillFormFromRecord(pid);
        }
        if (!self.data.isEditMode) {
          self.setData({ recordDate: util.formatDate(new Date()) });
        }
      })
      .then(function () {
        self.calculateSummary();
      })
      .catch(function () {});
  },

  fillFormFromRecord(rid) {
    var self = this;
    return request.get('/get_record.php', { id: rid }).then(function (data) {
      var rec = data && data.record;
      if (!rec) {
        wx.showToast({ title: '记录不存在', icon: 'none' });
        return;
      }
      var list = self.data.shiftConfigs || [];
      var ix = ledgerForm.shiftIndexForConfigId(list, rec.shift_config_id);
      var nm = rec.recorder_name ? String(rec.recorder_name).trim() : '';
      var rlist = (self.data.recorderNameList || []).slice();
      if (nm && rlist.indexOf(nm) < 0) {
        rlist.unshift(nm);
      }
      var ridx = nm ? Math.max(0, rlist.indexOf(nm)) : 0;
      self.setData({
        isEditMode: true,
        editRecordId: rid,
        entryTagLabel: '修改条目',
        entryTitle: '修改记账数据',
        submitBtnText: '保存修改',
        recordDate: rec.record_date || '',
        selectedShiftIndex: ix,
        shiftPickerLabel:
          list[ix] && list[ix].name ? list[ix].name : rec.shift_name || '请选择',
        qtyOpening: rec.qty_opening != null ? String(rec.qty_opening) : '',
        qtyClosing: rec.qty_closing != null ? String(rec.qty_closing) : '',
        qtyGift: rec.qty_gift != null ? String(rec.qty_gift) : '',
        soldWechat: rec.sold_wechat != null ? String(rec.sold_wechat) : '',
        soldAlipay: rec.sold_alipay != null ? String(rec.sold_alipay) : '',
        soldCash: rec.sold_cash != null ? String(rec.sold_cash) : '',
        cashOpening: rec.cash_opening != null ? String(rec.cash_opening) : '',
        cashClosing: rec.cash_closing != null ? String(rec.cash_closing) : '',
        recorderNameList: rlist.length ? rlist : self.data.recorderNameList,
        recorderNameIndex: ridx,
        recorderPickerDisplay: nm || self.data.recorderPickerDisplay
      });
      try {
        wx.setNavigationBarTitle({ title: '修改记账' });
      } catch (e) {
        /* ignore */
      }
    });
  },

  cancelEdit() {
    this.clearEditMode();
  },

  clearEditMode() {
    try {
      wx.setNavigationBarTitle({ title: 'Ledger' });
    } catch (e) {
      /* ignore */
    }
    this.setData({
      isEditMode: false,
      editRecordId: 0,
      entryTagLabel: '新增条目',
      entryTitle: '新增记账数据',
      submitBtnText: '确认提交数据',
      recordDate: util.formatDate(new Date())
    });
    this.resetForm();
  },

  /**
   * 加载班次配置
   */
  loadShiftConfigs() {
    var self = this;
    return request.get('/get_shifts.php').then(function (data) {
      var list = Array.isArray(data) ? data : [];
      var idx = self.data.selectedShiftIndex || 0;
      if (idx >= list.length) idx = 0;
      var label = '请选择';
      if (list.length && list[idx] && list[idx].name) {
        label = list[idx].name;
      } else if (list.length && list[0] && list[0].name) {
        label = list[0].name;
      }
      self.setData({ shiftConfigs: list, selectedShiftIndex: idx, shiftPickerLabel: label });
    }).catch(function () {
      wx.showToast({ title: '班次加载失败', icon: 'none' });
    });
  },

  loadRecorderNames() {
    var app = getApp();
    var self = this;
    var u = app.globalData.userInfo || wx.getStorageSync('userInfo') || {};
    var sid = storeUtil.getStoreIdFromUserInfo(u);
    var key = sid ? 'ledger_recorder_' + sid : 'ledger_recorder';
    var saved = wx.getStorageSync(key) || '';

    return request
      .get('/store_detail.php', {})
      .then(function (detail) {
        var raw = detail && detail.recorder_names;
        var list = [];
        if (Array.isArray(raw)) {
          for (var j = 0; j < raw.length; j++) {
            var one = raw[j];
            if (one == null) continue;
            var t = String(one).trim();
            if (t) list.push(t);
          }
        }
        if (!list.length) {
          var nick = (u && u.nickname && String(u.nickname).trim()) || '员工';
          list = [nick];
        }
        var idx = 0;
        for (var i = 0; i < list.length; i++) {
          if (list[i] === saved) {
            idx = i;
            break;
          }
        }
        var picked = list[idx] || list[0] || '';
        self.setData({
          recorderNameList: list,
          recorderNameIndex: idx,
          recorderPickerDisplay: picked
        });
      })
      .catch(function () {
        var nick = (u && u.nickname && String(u.nickname).trim()) || '员工';
        self.setData({
          recorderNameList: [nick],
          recorderNameIndex: 0,
          recorderPickerDisplay: nick
        });
        return Promise.resolve();
      });
  },

  onRecorderPick(e) {
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

  // ===== 事件处理 =====

  onDateChange(e) {
    this.setData({ recordDate: e.detail.value });
  },

  onShiftChange(e) {
    var ix = parseInt(e.detail.value, 10);
    if (Number.isNaN(ix)) ix = 0;
    var list = this.data.shiftConfigs || [];
    if (ix < 0 || ix >= list.length) ix = 0;
    var label =
      list[ix] && list[ix].name ? list[ix].name : list[0] && list[0].name ? list[0].name : '请选择';
    this.setData({ selectedShiftIndex: ix, shiftPickerLabel: label });
  },

  /**
   * 通用输入事件：通过 data-field 绑定字段名
   */
  onInput(e) {
    const field = e.currentTarget.dataset.field;
    this.setData({ [field]: e.detail.value });
    this.calculateSummary();
  },

  /**
   * 实时计算卖出数量和预估营收，并生成软提示（不拦截提交）
   */
  calculateSummary() {
    var s = ledgerForm.computeSummary(this.data);
    this.setData(s);
  },

  /**
   * 提交班次记录 → POST /add_record.php
   */
  submitRecord() {
    if (this.data.submitting) return;

    const { shiftConfigs, selectedShiftIndex, recordDate,
            qtyOpening, qtyClosing, qtyGift,
            soldWechat, soldAlipay, soldCash,
            cashOpening, cashClosing } = this.data;

    if (!recordDate) {
      wx.showToast({ title: '请选择日期', icon: 'none' });
      return;
    }
    if (!shiftConfigs.length) {
      wx.showToast({ title: '班次配置加载中，请稍候', icon: 'none' });
      return;
    }

    var recorderName = String(this.data.recorderPickerDisplay || '').trim();
    if (!recorderName) {
      wx.showToast({ title: '请选择记账姓名', icon: 'none' });
      return;
    }

    var self = this;
    var postBody = {
      record_date: recordDate,
      shift_config_id: shiftConfigs[selectedShiftIndex].id,
      recorder_name: recorderName,
      qty_opening: parseInt(qtyOpening) || 0,
      qty_closing: parseInt(qtyClosing) || 0,
      qty_gift: parseInt(qtyGift) || 0,
      sold_wechat: parseInt(soldWechat) || 0,
      sold_alipay: parseInt(soldAlipay) || 0,
      sold_cash: parseInt(soldCash) || 0,
      cash_opening: parseFloat(cashOpening) || 0,
      cash_closing: parseFloat(cashClosing) || 0
    };
    if (self.data.isEditMode && self.data.editRecordId) {
      postBody.id = self.data.editRecordId;
    }

    var runPost = function () {
      self.setData({ submitting: true });
      var url = self.data.isEditMode ? '/update_record.php' : '/add_record.php';
      request
        .post(url, postBody)
        .then(function (data) {
          if (self.data.isEditMode) {
            wx.showToast({ title: '已保存修改', icon: 'success', duration: 2200 });
            self.setData({ submitting: false });
            self.clearEditMode();
            return;
          }
          var msg = '提交成功';
          if (data && data.stock_deduct > 0 && data.current_stock != null) {
            msg +=
              '（库存−' + data.stock_deduct + '，剩余 ' + data.current_stock + '）';
          }
          wx.showToast({ title: msg, icon: 'success', duration: 2800 });
          self.resetForm();
        })
        .catch(function (err) {
          self.setData({ submitting: false });
          wx.showToast({ title: (err && err.message) || '提交失败，请重试', icon: 'none' });
        });
    };

    var warns = this.data.softWarnings || [];
    if (warns.length) {
      wx.showModal({
        title: '数据核对提醒',
        content: warns.join('\n\n'),
        confirmText: '仍要提交',
        cancelText: '返回修改',
        success: function (res) {
          if (res.confirm) {
            runPost();
          }
        }
      });
      return;
    }

    runPost();
  },

  /**
   * 重置表单
   */
  resetForm() {
    var self = this;
    this.setData(
      {
        qtyOpening: '',
        qtyClosing: '',
        qtyGift: '',
        soldWechat: '',
        soldAlipay: '',
        soldCash: '',
        cashOpening: '',
        cashClosing: '',
        qtySold: 0,
        paymentSoldTotal: 0,
        totalRevenueJpy: '0',
        submitting: false,
        softWarnings: [],
        hasSoftWarnings: false
      },
      function () {
        self.calculateSummary();
      }
    );
  }
});
