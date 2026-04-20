const app = getApp();
const auth = require('../../utils/auth');
const storeUtil = require('../../utils/store');
const request = require('../../utils/request');

function avatarLetter(name) {
  const c = (name || '?').trim().charAt(0);
  return /[a-z]/i.test(c) ? c.toUpperCase() : c;
}

Page({
  data: {
    userInfo: null,
    shiftSummaryLine: '—',
    recorderNamesSummary: '—',
    teamSummaryLine: '—',
    displayName: '—',
    roleText: '—',
    avatarLetter: '?',
    currentStoreLine: '—',
    showInviteBoss: false
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
    const roleText = r === 1 ? '管理员' : r === 2 ? '员工' : '—';
    const storeName = storeUtil.currentStoreDisplayName(u);
    const sid = storeUtil.getStoreIdFromUserInfo(u || {});
    let currentStoreLine = '—';
    if (storeName) {
      currentStoreLine = storeName + ' · ' + (r === 1 ? '管理员' : r === 2 ? '员工' : '');
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
      showInviteBoss: isBoss
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
        teamSummaryLine: '—'
      });
      return;
    }
    Promise.all([
      request.get('/get_shifts.php', {}),
      request.get('/store_members.php', {}),
      request.get('/store_detail.php', {})
    ])
      .then(function (results) {
        var shifts = results[0];
        var mem = results[1];
        var detail = results[2];
        var sc = Array.isArray(shifts) ? shifts.length : 0;
        var mc = mem && mem.members ? mem.members.length : 0;
        var rnames = detail && detail.recorder_names;
        var rcount = Array.isArray(rnames) ? rnames.length : 0;
        self.setData({
          shiftSummaryLine: sc + ' 个班次',
          recorderNamesSummary: rcount + ' 个',
          teamSummaryLine: mc + ' 人'
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

  goStockLedger() {
    wx.navigateTo({ url: '/pages/stock-ledger/stock-ledger' });
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

  logout() {
    wx.removeStorageSync('token');
    wx.removeStorageSync('userInfo');
    storeUtil.clearStoreSession();
    app.globalData.token = '';
    app.globalData.userInfo = null;
    wx.reLaunch({ url: '/pages/login/login' });
  }
});
