const request = require('../../utils/request');
const apiCached = require('../../utils/apiCached');
const util = require('../../utils/util');
const auth = require('../../utils/auth');
const ledgerForm = require('../../utils/ledgerRecordForm');
const ledgerRecorderNames = require('../../utils/ledgerRecorderNames');

const TOAST_MS_SAVE_OK = 2200;
const TOAST_MS_SUBMIT_OK = 2800;
const MODE_CREATE = 'create';
const MODE_EDIT = 'edit';

function emptyFormFields() {
  return {
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
    softWarnings: [],
    hasSoftWarnings: false
  };
}

function todayStr() {
  return util.formatDate(new Date());
}

function pickShiftLabel(list, idx, fallback) {
  if (list[idx] && list[idx].name) return list[idx].name;
  if (list[0] && list[0].name) return list[0].name;
  return fallback || '请选择';
}

Component({
  options: { multipleSlots: false },

  properties: {
    /** 'create' | 'edit' */
    initialMode: { type: String, value: MODE_CREATE }
  },

  data: Object.assign(
    {
      mode: MODE_CREATE,
      editRecordId: 0,

      recordDate: '',
      shiftConfigs: [],
      selectedShiftIndex: 0,
      shiftPickerLabel: '请选择',

      /** 避免 selector 首帧 range=[] 触发渲染层异常，占位一项，加载后覆盖 */
      recorderNameList: [''],
      recorderNameIndex: 0,
      recorderPickerDisplay: '',

      /** 当前门店实时库存/现金（用于上班数据预填） */
      currentStock: 0,
      currentCash: 0,
      /** 是否已成功预填过一次（用于 UI 提示；不阻塞逻辑） */
      openingPrefilled: false,
      /** 门店尚未初始化（库存与现金皆为 0），用于 banner 与提交前确认 */
      initialZero: false,
      /** 所选日期非今日（历史补录/提前录入）：温和提醒 */
      dateOffsetHint: false,

      unitPriceLabel: String(ledgerForm.ITEM_UNIT_PRICE_JPY),
      submitting: false,
      submitBtnText: '确认提交数据'
    },
    emptyFormFields()
  ),

  lifetimes: {
    attached() {
      this._depsLoaded = false;
      this._alive = true;
      this._lastPrefilledQty = null;
      this._lastPrefilledCash = null;
      this.setData({
        mode: this.data.initialMode || MODE_CREATE,
        recordDate: todayStr(),
        dateOffsetHint: false
      });
      this.reloadDeps().catch(function () {});
    },
    detached() {
      /** 标记实例已卸载，异步回调中止后续 setData，避免热重载/跨页面场景下的渲染层异常 */
      this._alive = false;
    }
  },

  methods: {
    // ===== 公共方法（页面通过 selectComponent 调用） =====

    /**
     * 重新加载依赖：班次配置、记账人列表
     * @returns {Promise<void>}
     */
    reloadDeps() {
      const self = this;
      return this._loadShiftConfigs()
        .then(function () {
          return self._loadRecorderNames();
        })
        .then(function () {
          return self._loadCurrentBalances();
        })
        .then(function () {
          self._depsLoaded = true;
          self._recalcSummary();
        });
    },

    /**
     * 切换为新增模式并清空表单
     */
    resetToCreate() {
      util.setNavBarTitleSafe('Ledger');
      this._lastPrefilledQty = null;
      this._lastPrefilledCash = null;
      const fresh = Object.assign(emptyFormFields(), {
        mode: MODE_CREATE,
        editRecordId: 0,
        recordDate: todayStr(),
        dateOffsetHint: false,
        openingPrefilled: false,
        submitting: false,
        submitBtnText: '确认提交数据'
      });
      const self = this;
      this.setData(fresh, function () {
        self._loadCurrentBalances().then(function () {
          self._recalcSummary();
        });
      });
    },

    /**
     * 切换为修改模式并填入记录
     * @param {object} record
     * @param {{ preloadedShifts?: object[] }} [options]
     * @returns {Promise<void>}
     */
    beginEdit(record, options) {
      const self = this;
      const opts = options || {};
      const ensureShifts = opts.preloadedShifts
        ? Promise.resolve(self._applyShiftConfigs(opts.preloadedShifts))
        : this._loadShiftConfigs();
      /** 编辑态不触发上班数据预填，显示记录原始值 */
      this._lastPrefilledQty = null;
      this._lastPrefilledCash = null;
      return ensureShifts
        .then(function () {
          return self._loadRecorderNames({ ensureName: record && record.recorder_name });
        })
        .then(function () {
          self._depsLoaded = true;
          self._fillFromRecord(record);
        });
    },

    // ===== 依赖加载 =====

    _loadShiftConfigs() {
      const self = this;
      return apiCached
        .getShifts()
        .then(function (data) {
          if (!self._alive) return;
          self._applyShiftConfigs(Array.isArray(data) ? data : []);
        })
        .catch(function (err) {
          if (!self._alive) return;
          console.error('[ledger-record-form/loadShiftConfigs]', err);
          wx.showToast({ title: '班次加载失败', icon: 'none' });
        });
    },

    _applyShiftConfigs(list) {
      let idx = this.data.selectedShiftIndex || 0;
      if (idx >= list.length) idx = 0;
      this.setData({
        shiftConfigs: list,
        selectedShiftIndex: idx,
        shiftPickerLabel: pickShiftLabel(list, idx, '请选择')
      });
    },

    _loadRecorderNames(options) {
      const self = this;
      const ensureName = options && options.ensureName;
      const user = auth.getCurrentUserInfo();

      return apiCached
        .getStoreDetail()
        .then(function (detail) {
          if (!self._alive) return;
          const built = ledgerRecorderNames.buildRecorderNameList({
            detail: detail,
            userInfo: user,
            ensureName: ensureName
          });
          const saved = wx.getStorageSync(built.savedKey) || '';
          const picked = ledgerRecorderNames.pickRecorderIndex(built.list, saved, ensureName);
          self.setData({
            recorderNameList: built.list,
            recorderNameIndex: picked.index,
            recorderPickerDisplay: picked.display
          });
        })
        .catch(function (err) {
          if (!self._alive) return;
          console.error('[ledger-record-form/loadRecorderNames]', err);
          const built = ledgerRecorderNames.buildRecorderNameList({
            detail: {},
            userInfo: user,
            ensureName: ensureName
          });
          self.setData({
            recorderNameList: built.list,
            recorderNameIndex: 0,
            recorderPickerDisplay: built.list[0] || ''
          });
        });
    },

    /**
     * 取当前门店实时库存/现金；命中 storeDetail 缓存，不产生新请求。
     * 仅在新建态触发上班数据预填（编辑态保持原始值）。
     */
    _loadCurrentBalances() {
      const self = this;
      return apiCached
        .getStoreDetail()
        .then(function (detail) {
          if (!self._alive) return;
          const stockNum = parseInt(detail && detail.current_stock, 10);
          const cashNum = parseFloat(detail && detail.current_cash);
          const safeStock = Number.isFinite(stockNum) ? stockNum : 0;
          const safeCash = Number.isFinite(cashNum) ? cashNum : 0;
          self.setData({
            currentStock: safeStock,
            currentCash: safeCash,
            initialZero: safeStock === 0 && safeCash === 0
          });
          if (self.data.mode === MODE_CREATE) {
            self._applyOpeningPrefill(safeStock, safeCash);
          }
        })
        .catch(function (err) {
          if (!self._alive) return;
          console.error('[ledger-record-form/loadCurrentBalances]', err);
        });
    },

    /**
     * 将上班数量/现金预填为当前库存/现金。
     * 原则：仅当字段为空、或仍保持上一次我们填入的值（即用户未动）时才覆盖，
     * 避免把用户已经改过的值给冲掉。
     */
    _applyOpeningPrefill(safeStock, safeCash) {
      const nextQty = String(safeStock);
      const nextCash = String(safeCash);
      const patch = {};
      const cur = this.data;

      if (cur.qtyOpening === '' || cur.qtyOpening === this._lastPrefilledQty) {
        patch.qtyOpening = nextQty;
      }
      if (cur.cashOpening === '' || cur.cashOpening === this._lastPrefilledCash) {
        patch.cashOpening = nextCash;
      }

      if (!Object.keys(patch).length) return;

      patch.openingPrefilled = true;
      const self = this;
      this.setData(patch, function () {
        self._recalcSummary();
      });
      if ('qtyOpening' in patch) this._lastPrefilledQty = patch.qtyOpening;
      if ('cashOpening' in patch) this._lastPrefilledCash = patch.cashOpening;
    },

    // ===== 填充记录 =====

    _fillFromRecord(record) {
      if (!record) {
        wx.showToast({ title: '记录不存在', icon: 'none' });
        return;
      }
      const list = this.data.shiftConfigs || [];
      const ix = ledgerForm.shiftIndexForConfigId(list, record.shift_config_id);
      util.setNavBarTitleSafe('修改记账');
      const self = this;
      this.setData(
        {
          mode: MODE_EDIT,
          editRecordId: parseInt(record.id, 10) || 0,
          submitBtnText: '保存修改',
          submitting: false,
          recordDate: record.record_date || '',
          selectedShiftIndex: ix,
          shiftPickerLabel:
            list[ix] && list[ix].name ? list[ix].name : record.shift_name || '请选择',
          qtyOpening: record.qty_opening != null ? String(record.qty_opening) : '',
          qtyClosing: record.qty_closing != null ? String(record.qty_closing) : '',
          qtyGift: record.qty_gift != null ? String(record.qty_gift) : '',
          soldWechat: record.sold_wechat != null ? String(record.sold_wechat) : '',
          soldAlipay: record.sold_alipay != null ? String(record.sold_alipay) : '',
          soldCash: record.sold_cash != null ? String(record.sold_cash) : '',
          cashOpening: record.cash_opening != null ? String(record.cash_opening) : '',
          cashClosing: record.cash_closing != null ? String(record.cash_closing) : ''
        },
        function () {
          self._recalcSummary();
        }
      );
    },

    // ===== 事件处理 =====

    onDateChange(e) {
      const next = e.detail.value || '';
      this.setData({
        recordDate: next,
        dateOffsetHint: !!next && next !== todayStr()
      });
    },

    onShiftChange(e) {
      let ix = parseInt(e.detail.value, 10);
      if (Number.isNaN(ix)) ix = 0;
      const list = this.data.shiftConfigs || [];
      if (ix < 0 || ix >= list.length) ix = 0;
      this.setData({
        selectedShiftIndex: ix,
        shiftPickerLabel: pickShiftLabel(list, ix, '请选择')
      });
    },

    onTapGotoCalibration() {
      wx.navigateTo({
        url: '/pages/stock-ledger/stock-ledger',
        fail: function () {
          wx.showToast({ title: '无法打开校准页', icon: 'none' });
        }
      });
    },

    onRecorderPick(e) {
      let ix = parseInt(e.detail.value, 10);
      if (Number.isNaN(ix)) ix = 0;
      const list = this.data.recorderNameList || [];
      if (ix < 0 || ix >= list.length) ix = 0;
      const user = auth.getCurrentUserInfo();
      const picked = list[ix] || '';
      wx.setStorageSync(ledgerRecorderNames.storageKey(user), picked);
      this.setData({ recorderNameIndex: ix, recorderPickerDisplay: picked });
    },

    onInput(e) {
      const field = e.currentTarget.dataset.field;
      if (!field) return;
      const value = e.detail.value;
      /** 用户手动修改上班数据后，后续刷新不再自动覆盖 */
      if (field === 'qtyOpening' && value !== this._lastPrefilledQty) {
        this._lastPrefilledQty = null;
      }
      if (field === 'cashOpening' && value !== this._lastPrefilledCash) {
        this._lastPrefilledCash = null;
      }
      this.setData({ [field]: value });
      this._recalcSummary();
    },

    _recalcSummary() {
      this.setData(ledgerForm.computeSummary(this.data));
    },

    // ===== 提交 =====

    onSubmit() {
      if (this.data.submitting) return;
      const self = this;
      const d = this.data;

      if (!d.recordDate) {
        wx.showToast({ title: '请选择日期', icon: 'none' });
        return;
      }
      if (!d.shiftConfigs.length) {
        wx.showToast({ title: '班次配置加载中，请稍候', icon: 'none' });
        return;
      }
      const recorderName = String(d.recorderPickerDisplay || '').trim();
      if (!recorderName) {
        wx.showToast({ title: '请选择记账姓名', icon: 'none' });
        return;
      }
      const check = ledgerForm.validateRequiredQtyAndCash(d);
      if (!check.ok) {
        wx.showToast({ title: check.message, icon: 'none' });
        return;
      }

      const postBody = {
        record_date: d.recordDate,
        shift_config_id: d.shiftConfigs[d.selectedShiftIndex].id,
        recorder_name: recorderName,
        qty_opening: parseInt(d.qtyOpening, 10) || 0,
        qty_closing: parseInt(d.qtyClosing, 10) || 0,
        qty_gift: parseInt(d.qtyGift, 10) || 0,
        sold_wechat: parseInt(d.soldWechat, 10) || 0,
        sold_alipay: parseInt(d.soldAlipay, 10) || 0,
        sold_cash: parseInt(d.soldCash, 10) || 0,
        cash_opening: parseFloat(d.cashOpening) || 0,
        cash_closing: parseFloat(d.cashClosing) || 0
      };
      if (d.mode === MODE_EDIT && d.editRecordId) {
        postBody.id = d.editRecordId;
      }

      const run = function () {
        self._doPost(postBody);
      };

      /** 门店尚未校准（当前库存与现金均为 0），新增时提示用户去校准 */
      const needZeroConfirm = d.mode === MODE_CREATE && d.initialZero;
      const runAfterSoftWarn = function () {
        if (!needZeroConfirm) return run();
        wx.showModal({
          title: '门店尚未校准',
          content:
            '当前库存与现金均为 0，是否属实？\n如为首次使用或未校准，建议先到「库存与现金」校准后再录入，提交后将按 0 扣减。',
          confirmText: '仍要提交',
          cancelText: '先去校准',
          success: function (res) {
            if (res.confirm) {
              run();
            } else if (res.cancel) {
              wx.navigateTo({
                url: '/pages/stock-ledger/stock-ledger',
                fail: function () {
                  wx.showToast({ title: '无法打开校准页', icon: 'none' });
                }
              });
            }
          }
        });
      };

      if (d.hasSoftWarnings && d.softWarnings.length) {
        wx.showModal({
          title: '数据核对提醒',
          content: d.softWarnings.join('\n\n'),
          confirmText: d.mode === MODE_EDIT ? '仍要保存' : '仍要提交',
          cancelText: '返回修改',
          success: function (res) {
            if (res.confirm) runAfterSoftWarn();
          }
        });
        return;
      }
      runAfterSoftWarn();
    },

    _doPost(postBody) {
      const self = this;
      const isEdit = this.data.mode === MODE_EDIT;
      const url = isEdit ? '/update_record.php' : '/add_record.php';
      this.setData({ submitting: true });

      request
        .post(url, postBody)
        .then(function (data) {
          if (isEdit) {
            wx.showToast({ title: '已保存修改', icon: 'success', duration: TOAST_MS_SAVE_OK });
            self.setData({ submitting: false });
            self.triggerEvent('submitsuccess', { mode: MODE_EDIT, data: data });
            return;
          }
          let msg = '提交成功';
          if (data && data.stock_deduct > 0 && data.current_stock != null) {
            msg += '（库存−' + data.stock_deduct + '，剩余 ' + data.current_stock + '）';
          }
          wx.showToast({ title: msg, icon: 'success', duration: TOAST_MS_SUBMIT_OK });
          self._clearFormFields();
          self.triggerEvent('submitsuccess', { mode: MODE_CREATE, data: data });
        })
        .catch(function (err) {
          self.setData({ submitting: false });
          wx.showToast({
            title: (err && err.message) || (isEdit ? '保存失败' : '提交失败，请重试'),
            icon: 'none'
          });
        });
    },

    _clearFormFields() {
      this._lastPrefilledQty = null;
      this._lastPrefilledCash = null;
      const self = this;
      this.setData(
        Object.assign(emptyFormFields(), {
          submitting: false,
          openingPrefilled: false,
          /** 日期重置回今日，保持「下一条默认今日」的预期 */
          recordDate: todayStr(),
          dateOffsetHint: false
        }),
        function () {
          /** 刚刚 addRecord 成功会使 request.js 失效 storeDetail 缓存，此处会拉到新值 */
          self._loadCurrentBalances().then(function () {
            self._recalcSummary();
          });
        }
      );
    }
  }
});
