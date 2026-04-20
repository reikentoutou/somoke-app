const request = require('../../utils/request');
const auth = require('../../utils/auth');

/**
 * 运营与流水页：
 * - 顶部汇总（当前库存 / 现金）
 * - 四个快捷操作（进货 / 取现 / 库存校准 / 现金校准）
 * - 分类筛选 + 时间轴列表（便于按班次回溯问题）
 *
 * 进货不再扣门店现金（进货款走店外资金），对应后端 handleOpsAction 已改。
 */

const CATEGORY_ALL = 'all';
const CATEGORY_RECORD = 'record';
const CATEGORY_RESTOCK = 'restock';
const CATEGORY_WITHDRAW = 'withdraw';
const CATEGORY_ADJUST = 'adjust';

const CATEGORY_TABS = [
  { key: CATEGORY_ALL, label: '全部' },
  { key: CATEGORY_RECORD, label: '班次记账' },
  { key: CATEGORY_RESTOCK, label: '进货' },
  { key: CATEGORY_WITHDRAW, label: '取现' },
  { key: CATEGORY_ADJUST, label: '校准' }
];

const EVENT_META = {
  restock: { category: CATEGORY_RESTOCK, label: '进货', tone: 'restock', initial: '进' },
  withdraw: { category: CATEGORY_WITHDRAW, label: '取现', tone: 'withdraw', initial: '取' },
  adjust_stock: { category: CATEGORY_ADJUST, label: '库存校准', tone: 'adjust', initial: '校' },
  adjust_cash: { category: CATEGORY_ADJUST, label: '现金校准', tone: 'adjust', initial: '校' },
  adjust: { category: CATEGORY_ADJUST, label: '校准', tone: 'adjust', initial: '校' },
  record_add: { category: CATEGORY_RECORD, label: '班次记账', tone: 'record', initial: '记' },
  record_update: { category: CATEGORY_RECORD, label: '修改记账', tone: 'record', initial: '改' }
};

const DEFAULT_META = { category: CATEGORY_ALL, label: '变动', tone: 'record', initial: '·' };

function decorateRow(row) {
  const meta = EVENT_META[row.event_type] || DEFAULT_META;
  const delta = row.delta || 0;
  const cashDelta = row.cash_delta || 0;
  const hasStock = delta !== 0 || row.event_type === 'adjust_stock';
  const hasCash = cashDelta !== 0 || row.event_type === 'adjust_cash';
  const shiftDate = row.shift_date || '';
  const shiftName = row.shift_name || '';
  let shiftChip = '';
  if (shiftDate && shiftName) {
    shiftChip = shiftDate.slice(5) + ' · ' + shiftName;
  } else if (shiftDate) {
    shiftChip = shiftDate.slice(5);
  } else if (shiftName) {
    shiftChip = shiftName;
  }
  return Object.assign({}, row, {
    category: meta.category,
    type_label: meta.label,
    tone: meta.tone,
    initial: meta.initial,
    has_stock: hasStock,
    has_cash: hasCash,
    stock_delta_display: (delta > 0 ? '+' : '') + delta,
    cash_delta_display: (cashDelta > 0 ? '+' : '') + cashDelta,
    shift_chip: shiftChip,
    operator_display: row.operator_name || ''
  });
}

function filterByCategory(items, filterType) {
  if (filterType === CATEGORY_ALL) return items;
  return items.filter(function (it) { return it.category === filterType; });
}

Page({
  data: {
    loading: false,
    errMsg: '',
    items: [],
    filteredItems: [],
    filterType: CATEGORY_ALL,
    categoryTabs: CATEGORY_TABS,
    storeInfo: {
      current_stock: 0,
      current_cash: 0
    },
    actionModalVisible: false,
    actionType: '',
    actionModalTitle: '',
    actionValStock: '',
    actionValCash: '',
    actionNote: '',
    submitting: false,
    hasMore: false,
    loadingMore: false,
    pageSize: 50
  },

  onLoad() {
    if (!this._ensureSession()) return;
    this.fetchData();
  },

  onShow() {
    /** 热启动/后台回来也要复核登录与门店，避免会话失效时继续拉接口 */
    if (!this._ensureSession()) return;
    this.fetchData();
  },

  onPullDownRefresh() {
    this.fetchData().then(function () {
      wx.stopPullDownRefresh();
    });
  },

  onReachBottom() {
    if (this.data.hasMore && !this.data.loadingMore && !this.data.loading) {
      this.loadMore();
    }
  },

  _ensureSession() {
    if (!auth.redirectToLoginIfNeeded()) return false;
    if (!auth.redirectToOnboardingIfNeeded()) return false;
    if (!auth.redirectToStoreSelectIfNeeded()) return false;
    return true;
  },

  fetchData() {
    const self = this;
    /** 序号防竞态：下拉刷新 + onShow 并发时只采纳最后一次请求的结果 */
    this._loadSeq = (this._loadSeq || 0) + 1;
    const seq = this._loadSeq;
    this.setData({ loading: true, errMsg: '' });
    return Promise.all([
      request.get('/store_detail.php', {}),
      request.get('/stock_ledger_list.php', { limit: self.data.pageSize })
    ])
      .then(function (results) {
        if (seq !== self._loadSeq) return;
        const detail = results[0] || {};
        const ledger = results[1] || {};
        const raw = Array.isArray(ledger.items) ? ledger.items : [];
        const items = raw.map(decorateRow);
        self._nextCursor = ledger.next_cursor || null;
        self.setData({
          loading: false,
          'storeInfo.current_stock': detail.current_stock || 0,
          'storeInfo.current_cash': detail.current_cash || 0,
          items: items,
          filteredItems: filterByCategory(items, self.data.filterType),
          hasMore: !!ledger.has_more
        });
      })
      .catch(function (err) {
        if (seq !== self._loadSeq) return;
        self.setData({ loading: false, errMsg: (err && err.message) || '加载失败' });
      });
  },

  loadMore() {
    const self = this;
    const cursor = self._nextCursor;
    if (!cursor) {
      self.setData({ hasMore: false });
      return Promise.resolve();
    }
    self.setData({ loadingMore: true });
    return request
      .get('/stock_ledger_list.php', { limit: self.data.pageSize, cursor: cursor })
      .then(function (ledger) {
        const raw = Array.isArray(ledger && ledger.items) ? ledger.items : [];
        const added = raw.map(decorateRow);
        const merged = self.data.items.concat(added);
        self._nextCursor = (ledger && ledger.next_cursor) || null;
        self.setData({
          items: merged,
          filteredItems: filterByCategory(merged, self.data.filterType),
          hasMore: !!(ledger && ledger.has_more),
          loadingMore: false
        });
      })
      .catch(function (err) {
        self.setData({ loadingMore: false });
        wx.showToast({ title: (err && err.message) || '加载更多失败', icon: 'none' });
      });
  },

  onTapFilter(e) {
    const key = e.currentTarget.dataset.key || CATEGORY_ALL;
    if (key === this.data.filterType) return;
    this.setData({
      filterType: key,
      filteredItems: filterByCategory(this.data.items, key)
    });
  },

  onTapRestock() {
    this.openActionModal('restock', '进货入库');
  },

  onTapWithdraw() {
    this.openActionModal('withdraw', '取现');
  },

  onTapAdjustStock() {
    this.openActionModal('adjust_stock', '库存校准');
  },

  onTapAdjustCash() {
    this.openActionModal('adjust_cash', '现金校准');
  },

  openActionModal(type, title) {
    this.setData({
      actionModalVisible: true,
      actionType: type,
      actionModalTitle: title,
      actionValStock: '',
      actionValCash: '',
      actionNote: ''
    });
  },

  closeActionModal() {
    this.setData({
      actionModalVisible: false,
      actionType: '',
      actionValStock: '',
      actionValCash: '',
      actionNote: ''
    });
  },

  noop() {},

  onInputValStock(e) {
    this.setData({ actionValStock: e.detail.value });
  },

  onInputValCash(e) {
    this.setData({ actionValCash: e.detail.value });
  },

  onInputNote(e) {
    this.setData({ actionNote: e.detail.value });
  },

  submitAction() {
    const data = this.data;
    const actionType = data.actionType;

    if (actionType === 'restock') {
      if (!data.actionValStock || parseInt(data.actionValStock, 10) <= 0) {
        wx.showToast({ title: '请输入有效进货数量', icon: 'none' });
        return;
      }
    } else if (actionType === 'withdraw') {
      if (!data.actionValCash || parseFloat(data.actionValCash) <= 0) {
        wx.showToast({ title: '请输入有效取现金额', icon: 'none' });
        return;
      }
    } else if (actionType === 'adjust_stock') {
      if (!data.actionValStock || parseInt(data.actionValStock, 10) < 0) {
        wx.showToast({ title: '请输入有效实盘库存', icon: 'none' });
        return;
      }
    } else if (actionType === 'adjust_cash') {
      if (!data.actionValCash || parseFloat(data.actionValCash) < 0) {
        wx.showToast({ title: '请输入有效实盘现金', icon: 'none' });
        return;
      }
    }

    if (this.data.submitting) return;
    const self = this;
    this.setData({ submitting: true });
    wx.showLoading({ title: '提交中', mask: true });

    request
      .post('/ops_action.php', {
        action_type: actionType,
        val_stock: data.actionValStock,
        val_cash: data.actionValCash,
        note: data.actionNote
      })
      .then(function () {
        wx.hideLoading();
        wx.showToast({ title: '操作成功', icon: 'success' });
        self.closeActionModal();
        self.fetchData();
      })
      .catch(function (err) {
        wx.hideLoading();
        wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' });
      })
      .then(function () {
        /** finally 语义：无论成功失败，释放提交锁，避免重复点击 */
        self.setData({ submitting: false });
      });
  }
});
