const request = require('../../utils/request');
const util = require('../../utils/util');
const auth = require('../../utils/auth');

Page({
  data: {
    recordDate: '',
    shiftConfigs: [],
    selectedShiftIndex: 0,
    recorderName: '',

    qtyOpening: '',
    qtyClosing: '',
    qtyGift: '',
    soldWechat: '',
    soldAlipay: '',
    soldCash: '',
    cashOpening: '',
    cashClosing: '',

    qtySold: 0,
    totalRevenue: '0.00',
    submitting: false
  },

  onLoad() {
    this.setData({ recordDate: util.formatDate(new Date()) });
  },

  onShow() {
    if (typeof this.getTabBar === 'function') {
      this.getTabBar().setData({ selected: 1 });
    }
    if (!auth.redirectToLoginIfNeeded()) {
      return;
    }
    const app = getApp();
    const u = app.globalData.userInfo || wx.getStorageSync('userInfo');
    this.setData({ recorderName: (u && u.nickname) || '员工' });
    this.loadShiftConfigs();
  },

  /**
   * 加载班次配置
   */
  loadShiftConfigs() {
    request.get('/get_shifts.php').then(data => {
      var list = Array.isArray(data) ? data : [];
      this.setData({ shiftConfigs: list });
    }).catch(() => {
      wx.showToast({ title: '班次加载失败', icon: 'none' });
    });
  },

  // ===== 事件处理 =====

  onDateChange(e) {
    this.setData({ recordDate: e.detail.value });
  },

  onShiftChange(e) {
    this.setData({ selectedShiftIndex: parseInt(e.detail.value) });
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
   * 实时计算卖出数量和预估营收
   */
  calculateSummary() {
    const opening = parseInt(this.data.qtyOpening) || 0;
    const closing = parseInt(this.data.qtyClosing) || 0;
    const gift    = parseInt(this.data.qtyGift) || 0;
    const sold    = Math.max(0, opening - closing - gift);

    this.setData({ qtySold: sold });
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

    this.setData({ submitting: true });

    request.post('/add_record.php', {
      record_date:     recordDate,
      shift_config_id: shiftConfigs[selectedShiftIndex].id,
      qty_opening:     parseInt(qtyOpening) || 0,
      qty_closing:     parseInt(qtyClosing) || 0,
      qty_gift:        parseInt(qtyGift) || 0,
      sold_wechat:     parseInt(soldWechat) || 0,
      sold_alipay:     parseInt(soldAlipay) || 0,
      sold_cash:       parseInt(soldCash) || 0,
      cash_opening:    parseFloat(cashOpening) || 0,
      cash_closing:    parseFloat(cashClosing) || 0
    }).then(() => {
      wx.showToast({ title: '提交成功', icon: 'success' });
      this.resetForm();
    }).catch(err => {
      this.setData({ submitting: false });
      wx.showToast({ title: err.message || '提交失败，请重试', icon: 'none' });
    });
  },

  /**
   * 重置表单
   */
  resetForm() {
    this.setData({
      qtyOpening: '', qtyClosing: '', qtyGift: '',
      soldWechat: '', soldAlipay: '', soldCash: '',
      cashOpening: '', cashClosing: '',
      qtySold: 0, totalRevenue: '0.00', submitting: false
    });
  }
});
