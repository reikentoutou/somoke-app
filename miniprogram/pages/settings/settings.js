const app = getApp();
const auth = require('../../utils/auth');
const storeUtil = require('../../utils/store');
const request = require('../../utils/request');
const util = require('../../utils/util');

function avatarLetter(name) {
  const c = (name || '?').trim().charAt(0);
  return /[a-z]/i.test(c) ? c.toUpperCase() : c;
}

Page({
  data: {
    userInfo: null,
    storeInfo: {
      stock: 0,
      price: '0.00',
      withdrawnFormatted: '—'
    },
    shiftSummaryLine: '—',
    recorderNamesSummary: '—',
    teamSummaryLine: '—',
    displayName: '—',
    roleText: '—',
    avatarLetter: '?',
    restockQty: '',
    currentStoreLine: '—',
    showInviteBoss: false,
    withdrawBoss: false,
    withdrawQty: '',
    withdrawHistoryVisible: false,
    withdrawHistoryLines: [],
    /** 供 wxml 遍历，永不为 null，避免 render layer Symbol.iterator 报错 */
    withdrawHistoryLinesSafe: []
  },

  goProfileEdit() {
    wx.navigateTo({ url: '/pages/profile-edit/profile-edit' });
  },

  onShow() {
    if (typeof this.getTabBar === 'function') {
      this.getTabBar().setData({ selected: 3 });
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
    this.loadUserInfo();
  },

  loadUserInfo() {
    const u = app.globalData.userInfo || wx.getStorageSync('userInfo') || null;
    const name = (u && u.nickname) ? u.nickname : '未设置昵称';
    const stores = storeUtil.normalizeStores(u || {});
    const r = storeUtil.getRoleInCurrentStore(u);
    const roleText = r === 1 ? '老板' : r === 2 ? '员工' : '—';
    const storeName = storeUtil.currentStoreDisplayName(u);
    const sid = storeUtil.getStoreIdFromUserInfo(u || {});
    let currentStoreLine = '—';
    if (storeName) {
      currentStoreLine = storeName + ' · ' + (r === 1 ? '老板' : r === 2 ? '员工' : '');
    } else if (sid > 0) {
      currentStoreLine = '门店 #' + sid;
    }
    var isBoss = storeUtil.isBossInCurrentStore(u) && sid > 0;
    this.setData({
      userInfo: u,
      displayName: name,
      roleText: roleText,
      avatarLetter: avatarLetter(name),
      currentStoreLine: currentStoreLine,
      showInviteBoss: isBoss,
      withdrawBoss: isBoss
    });
    this.fetchSettingsMetrics(u);
  },

  fetchSettingsMetrics(u) {
    var self = this;
    var info = u || app.globalData.userInfo || wx.getStorageSync('userInfo');
    var sid = storeUtil.getStoreIdFromUserInfo(info || {});
    if (sid <= 0) {
      self.setData({
        shiftSummaryLine: '—',
        recorderNamesSummary: '—',
        teamSummaryLine: '—',
        'storeInfo.stock': 0,
        'storeInfo.withdrawnFormatted': '—'
      });
      return;
    }
    Promise.all([
      request.get('/get_shifts.php', {}),
      request.get('/store_members.php', {}),
      request.get('/store_detail.php', {}),
      request.get('/withdraw_list.php', {}).catch(function () {
        return { total_jpy: 0, records: [] };
      })
    ])
      .then(function (results) {
        var shifts = results[0];
        var mem = results[1];
        var detail = results[2];
        var wd = results[3] || {};
        var sc = Array.isArray(shifts) ? shifts.length : 0;
        var mc = mem && mem.members ? mem.members.length : 0;
        var stock = detail && detail.current_stock != null ? detail.current_stock : 0;
        var totalJpy = wd.total_jpy != null ? parseInt(wd.total_jpy, 10) : 0;
        if (Number.isNaN(totalJpy) || totalJpy < 0) totalJpy = 0;
        var rnames = detail && detail.recorder_names;
        var rcount = Array.isArray(rnames) ? rnames.length : 0;
        self.setData({
          shiftSummaryLine: sc + ' 个班次',
          recorderNamesSummary: rcount + ' 个',
          teamSummaryLine: mc + ' 人',
          'storeInfo.stock': stock,
          'storeInfo.withdrawnFormatted': util.formatJpy(totalJpy) + ' 円'
        });
      })
      .catch(function () {
        /* 保留占位，避免打搅用户 */
      });
  },

  goShiftSettings() {
    wx.navigateTo({ url: '/pages/settings-shifts/settings-shifts' });
  },

  goRecorderNames() {
    wx.navigateTo({ url: '/pages/settings-recorders/settings-recorders' });
  },

  goTeamManage() {
    wx.navigateTo({ url: '/pages/settings-team/settings-team' });
  },

  goStoreSwitch() {
    wx.navigateTo({ url: '/pages/store-select/store-select?from=settings' });
  },

  noopWithdraw() {},

  formatWithdrawLine(r) {
    var d = (r.record_date || '').trim();
    var parts = d.split('-');
    if (parts.length === 3) {
      var y = parseInt(parts[0], 10);
      var m = parseInt(parts[1], 10);
      var day = parseInt(parts[2], 10);
      if (!Number.isNaN(y) && !Number.isNaN(m) && !Number.isNaN(day)) {
        var amt = r.amount_jpy != null ? r.amount_jpy : 0;
        return y + '年' + m + '月' + day + '日取现' + amt + '円';
      }
    }
    return (d || '—') + ' 取现 ' + (r.amount_jpy != null ? r.amount_jpy : 0) + '円';
  },

  onWithdrawRowTap() {
    var self = this;
    if (self._withdrawListLoading) return;
    self._withdrawListLoading = true;
    wx.showLoading({ title: '加载中', mask: true });
    request
      .get('/withdraw_list.php', {})
      .then(function (data) {
        var raw = data && data.records;
        var recs = Array.isArray(raw) ? raw : [];
        var lines = recs.map(function (row) {
          return self.formatWithdrawLine(row);
        });
        if (!lines.length) {
          lines = ['暂无取现记录'];
        }
        self.setData({
          withdrawHistoryVisible: true,
          withdrawHistoryLines: lines,
          withdrawHistoryLinesSafe: lines
        });
      })
      .catch(function () {
        wx.showToast({ title: '加载失败', icon: 'none' });
      })
      .then(function () {
        self._withdrawListLoading = false;
        try {
          wx.hideLoading();
        } catch (e) {
          /* ignore */
        }
      });
  },

  closeWithdrawHistory() {
    this.setData({
      withdrawHistoryVisible: false,
      withdrawHistoryLines: [],
      withdrawHistoryLinesSafe: []
    });
  },

  onWithdrawInput(e) {
    this.setData({ withdrawQty: e.detail.value });
  },

  doWithdrawAdd() {
    var self = this;
    var u = app.globalData.userInfo || wx.getStorageSync('userInfo');
    if (!storeUtil.isBossInCurrentStore(u)) {
      wx.showToast({ title: '仅老板可登记', icon: 'none' });
      return;
    }
    var amt = parseInt(self.data.withdrawQty, 10);
    if (!amt || amt <= 0) {
      wx.showToast({ title: '请输入有效金额（円）', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '提交中', mask: true });
    request
      .post('/withdraw_add.php', {
        amount_jpy: amt,
        record_date: util.formatDate(new Date())
      })
      .then(function () {
        try {
          wx.hideLoading();
        } catch (e) {
          /* ignore */
        }
        wx.showToast({ title: '已记录', icon: 'success' });
        self.setData({ withdrawQty: '' });
        self.fetchSettingsMetrics(u);
      })
      .catch(function (err) {
        try {
          wx.hideLoading();
        } catch (e) {
          /* ignore */
        }
        wx.showToast({ title: (err && err.message) || '失败', icon: 'none' });
      });
  },

  onInventoryHint() {
    wx.showModal({
      title: '库存管理',
      content:
        '老板在「补货」里增加库存；每次录入提交后，会按盘点售出与微信、支付宝、现金售出中较多的数量，再加上赠送数量扣减库存。若只填了盘点、没填支付渠道，也会按规则扣减（库存不会小于 0）。',
      showCancel: false
    });
  },

  onGenerateInvite() {
    const u = app.globalData.userInfo || wx.getStorageSync('userInfo');
    const sid = storeUtil.getStoreIdFromUserInfo(u || {});
    if (sid <= 0) return;
    wx.showLoading({ title: '生成中', mask: true });
    request
      .post('/store_invite_create.php', {
        store_id: sid,
        max_uses: 1,
        expire_days: 7
      })
      .then(function (data) {
        const code = (data && data.code) ? String(data.code) : '';
        wx.showModal({
          title: '邀请码（仅显示一次）',
          content: code
            ? code + '\n\n请立即复制保存，关闭后将无法在此再次查看。'
            : '未返回邀请码',
          confirmText: code ? '复制' : '知道了',
          success: function (res) {
            if (res.confirm && code) {
              wx.setClipboardData({ data: code });
            }
          }
        });
      })
      .catch(function (err) {
        wx.showToast({ title: (err && err.message) || '生成失败', icon: 'none' });
      })
      .then(function () {
        wx.hideLoading();
      });
  },

  onRestockInput(e) {
    this.setData({ restockQty: e.detail.value });
  },

  doRestock() {
    var self = this;
    var u = app.globalData.userInfo || wx.getStorageSync('userInfo');
    if (!storeUtil.isBossInCurrentStore(u)) {
      wx.showToast({ title: '仅老板可补货', icon: 'none' });
      return;
    }
    var qty = parseInt(self.data.restockQty, 10);
    if (!qty || qty <= 0) {
      wx.showToast({ title: '请输入有效数量', icon: 'none' });
      return;
    }
    wx.showLoading({ title: '提交中', mask: true });
    request
      .post('/store_restock.php', { qty: qty })
      .then(function (data) {
        var next = data && data.current_stock != null ? data.current_stock : null;
        if (next != null) {
          self.setData({ 'storeInfo.stock': next, restockQty: '' });
        }
        wx.showToast({ title: '补货成功', icon: 'success' });
      })
      .catch(function (err) {
        wx.showToast({ title: (err && err.message) || '补货失败', icon: 'none' });
      })
      .then(function () {
        wx.hideLoading();
      });
  },

  logout() {
    wx.removeStorageSync('token');
    wx.removeStorageSync('userInfo');
    storeUtil.clearStoreSession();
    app.globalData.token = '';
    app.globalData.userInfo = null;
    wx.reLaunch({ url: '/pages/login/login' });
  }
});
