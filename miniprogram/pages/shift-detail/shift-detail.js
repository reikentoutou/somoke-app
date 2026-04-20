const request = require('../../utils/request');
const apiCached = require('../../utils/apiCached');
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
  return s ? s.charAt(0) : '';
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

  /**
   * 会话复核：非 onLoad 场景（如后台回前台）也需要复查登录/引导/门店，
   * 避免在已失效会话下继续用旧 id 拉取数据。
   */
  _ensureSession() {
    if (!auth.redirectToLoginIfNeeded()) return false;
    if (!auth.redirectToOnboardingIfNeeded()) return false;
    if (!auth.redirectToStoreSelectIfNeeded()) return false;
    return true;
  },

  onShow() {
    if (!this._ensureSession()) return;
  },

  onLoad(options) {
    if (!this._ensureSession()) return;

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
    const u = auth.getCurrentUserInfo();
    const myId =
      u.id != null ? parseInt(u.id, 10) : u.userId != null ? parseInt(u.userId, 10) : NaN;
    const rid = row.recorder_id != null ? parseInt(row.recorder_id, 10) : NaN;
    if (storeUtil.isBossInCurrentStore(u)) return true;
    if (!Number.isNaN(myId) && myId > 0 && !Number.isNaN(rid) && rid === myId) return true;
    return false;
  },

  loadRecord(id, date) {
    const self = this;
    wx.showLoading({ title: '加载中', mask: true });

    function applyRow(row) {
      if (!row) {
        wx.showToast({ title: '未找到该记录', icon: 'none' });
        self._editSourceRow = null;
        self.setData(emptyDetailState());
        return;
      }
      self._editSourceRow = row;
      self.setData(
        Object.assign(emptyDetailState(), mapRowToPageData(row), {
          canEdit: self.computeCanEdit(row)
        })
      );
    }

    request
      .get('/get_record.php', { id: id })
      .then(function (data) {
        const rec = data && data.record;
        if (rec) {
          applyRow(rec);
          return;
        }
        return request.get('/get_records.php', { date: date }).then(function (data2) {
          const list = Array.isArray(data2 && data2.records) ? data2.records : [];
          applyRow(list.find(function (r) { return parseInt(r.id, 10) === id; }));
        });
      })
      .catch(function () {
        return request.get('/get_records.php', { date: date }).then(function (data2) {
          const list = Array.isArray(data2 && data2.records) ? data2.records : [];
          applyRow(list.find(function (r) { return parseInt(r.id, 10) === id; }));
        });
      })
      .catch(function () {
        self._editSourceRow = null;
        self.setData(emptyDetailState());
      })
      .then(function () {
        try { wx.hideLoading(); } catch (e) { /* ignore */ }
      });
  },

  onTapEditRecord() {
    const row = this._editSourceRow;
    if (!this._recordId || !row) {
      wx.showToast({ title: '记录未加载完成', icon: 'none' });
      return;
    }
    const self = this;
    wx.showLoading({ title: '加载中', mask: true });
    apiCached
      .getShifts()
      .then(function (data) {
        const shiftConfigs = Array.isArray(data) ? data : [];
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
        util.setNavBarTitleSafe('修改记账');
        self.setData({ editing: true }, function () {
          const form = self.selectComponent('#form');
          if (!form) return;
          form.beginEdit(row, { preloadedShifts: shiftConfigs }).catch(function (err) {
            console.error('[shift-detail/beginEdit]', err);
            wx.showToast({ title: '加载表单失败，请重试', icon: 'none' });
          });
        });
      })
      .catch(function (err) {
        console.error('[shift-detail/onTapEditRecord]', err);
        wx.showToast({ title: '加载失败，请重试', icon: 'none' });
      })
      .then(function () {
        try { wx.hideLoading(); } catch (e) { /* ignore */ }
      });
  },

  cancelInlineEdit() {
    util.setNavBarTitleSafe('班次详情');
    this.setData({ editing: false });
  },

  onInlineSaved() {
    util.setNavBarTitleSafe('班次详情');
    this.setData({ editing: false });
    if (this._recordId) {
      this.loadRecord(this._recordId, this._recordDate);
    }
  }
});
