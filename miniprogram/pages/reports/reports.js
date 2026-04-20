const request = require('../../utils/request');
const util = require('../../utils/util');
const auth = require('../../utils/auth');

const WEEKDAY_SHORT = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function monthDayBounds(ym) {
  const parts = ym.split('-');
  const y = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
    return { start: '', end: '' };
  }
  const last = new Date(y, m, 0).getDate();
  const pad = n => String(n).padStart(2, '0');
  return {
    start: `${y}-${pad(m)}-01`,
    end: `${y}-${pad(m)}-${pad(last)}`
  };
}

function defaultPickerDateInMonth(ym) {
  const b = monthDayBounds(ym);
  if (!b.start) return '';
  const today = util.formatDate(new Date());
  if (today >= b.start && today <= b.end) {
    return today;
  }
  return b.start;
}

function applyDetailDayFilter(groups, filterDate) {
  const list = Array.isArray(groups) ? groups : [];
  const d = filterDate && String(filterDate).trim();
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    return list;
  }
  return list.filter(function (g) {
    return g && g.date === d;
  });
}

/** 明细筛选器展示用：如 4月15日 周一 */
function detailFilterDayLabel(iso) {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return '';
  }
  const segs = iso.split('-');
  const mm = parseInt(segs[1], 10);
  const dd = parseInt(segs[2], 10);
  if (!Number.isFinite(mm) || !Number.isFinite(dd)) {
    return iso;
  }
  const wd = util.getWeekday(iso);
  return mm + '月' + dd + '日' + (wd ? ' ' + wd : '');
}

Page({
  data: {
    currentMonth: '',
    monthPickerValue: '',
    heroMonthLabel: '',
    /** 每日班次明细：空字符串表示查看当月全部日期 */
    detailFilterDate: '',
    detailDayPickerValue: '',
    monthDayPickStart: '',
    monthDayPickEnd: '',
    detailFilterLabel: '',
    dailyGroupsAll: [],
    summary: {
      total_revenue: 0,
      total_wechat_amount: 0,
      total_alipay_amount: 0,
      total_cash_amount: 0,
      total_wechat_qty: 0,
      total_alipay_qty: 0,
      total_cash_qty: 0
    },
    revenueFormatted: '0.00',
    wechatAmountFmt: '0.00',
    alipayAmountFmt: '0.00',
    cashAmountFmt: '0.00',
    records: [],
    dailyGroups: [],
    chartData: [],
    chartMode: 'daily',
    loading: false
  },

  onLoad() {
    const currentMonth = util.formatMonth(new Date());
    this.setData({
      currentMonth,
      monthPickerValue: currentMonth,
      heroMonthLabel: this.buildHeroLabel(currentMonth)
    });
  },

  onShow() {
    if (typeof this.getTabBar === 'function') {
      this.getTabBar().setData({ selected: 2 });
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
    this.loadMonthData();
  },

  buildHeroLabel(ym) {
    const parts = ym.split('-');
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
      return '营收汇总';
    }
    return `${y}年${m}月 · 营收汇总`;
  },

  onMonthChange(e) {
    const month = e.detail.value;
    this.setData({
      currentMonth: month,
      monthPickerValue: month,
      heroMonthLabel: this.buildHeroLabel(month),
      detailFilterDate: '',
      detailFilterLabel: ''
    });
    this.loadMonthData();
  },

  onChartModeDaily() {
    if (this.data.chartMode === 'daily') return;
    this.setData({ chartMode: 'daily' }, () => this.applyChartFromRecords());
  },

  onChartModeWeekly() {
    if (this.data.chartMode === 'weekly') return;
    this.setData({ chartMode: 'weekly' }, () => this.applyChartFromRecords());
  },

  onDetailDayPick(e) {
    const picked = e.detail && e.detail.value ? String(e.detail.value).trim() : '';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(picked)) {
      return;
    }
    const all = this.data.dailyGroupsAll || [];
    const filtered = applyDetailDayFilter(all, picked);
    this.setData({
      detailFilterDate: picked,
      detailDayPickerValue: picked,
      detailFilterLabel: detailFilterDayLabel(picked),
      dailyGroups: filtered
    });
  },

  onClearDetailDayFilter() {
    const all = this.data.dailyGroupsAll || [];
    const ym = this.data.currentMonth;
    this.setData({
      detailFilterDate: '',
      detailFilterLabel: '',
      detailDayPickerValue: defaultPickerDateInMonth(ym),
      dailyGroups: all
    });
  },

  goShiftDetail(e) {
    var id = e.currentTarget.dataset.id;
    var date = e.currentTarget.dataset.date;
    if (id == null || id === '') return;
    var q =
      '/pages/shift-detail/shift-detail?id=' +
      encodeURIComponent(String(id)) +
      (date ? '&date=' + encodeURIComponent(String(date)) : '');
    wx.navigateTo({ url: q });
  },

  loadMonthData() {
    const month = this.data.currentMonth;
    if (!month) return;

    /** 序号防竞态：快速换月或 onShow 重叠时，仅采纳最后一次请求的结果 */
    this._loadSeq = (this._loadSeq || 0) + 1;
    const seq = this._loadSeq;
    this.setData({ loading: true });
    request.get('/get_records.php', { month })
      .then(data => {
        if (seq !== this._loadSeq) return;
        const summary = (data && data.summary) || {};
        const raw = data && data.records;
        const records = Array.isArray(raw) ? raw : [];
        const dailyGroupsAll = this.groupByDate(records);
        const bounds = monthDayBounds(month);
        const filterDate = this.data.detailFilterDate;
        const filtered =
          filterDate && /^\d{4}-\d{2}-\d{2}$/.test(filterDate)
            ? applyDetailDayFilter(dailyGroupsAll, filterDate)
            : dailyGroupsAll;
        const pickerVal =
          filterDate && /^\d{4}-\d{2}-\d{2}$/.test(filterDate)
            ? filterDate
            : defaultPickerDateInMonth(month);
        const detailLabel =
          filterDate && /^\d{4}-\d{2}-\d{2}$/.test(filterDate)
            ? detailFilterDayLabel(filterDate)
            : '';
        const chartData = this.buildChartWithHeights(
          records,
          month,
          this.data.chartMode
        );

        this.setData({
          loading: false,
          summary,
          records,
          dailyGroupsAll,
          dailyGroups: filtered,
          chartData,
          monthDayPickStart: bounds.start,
          monthDayPickEnd: bounds.end,
          detailDayPickerValue: pickerVal,
          detailFilterLabel: detailLabel,
          revenueFormatted: util.formatMoney(summary.total_revenue || 0),
          wechatAmountFmt: util.formatMoney(summary.total_wechat_amount || 0),
          alipayAmountFmt: util.formatMoney(summary.total_alipay_amount || 0),
          cashAmountFmt: util.formatMoney(summary.total_cash_amount || 0)
        });
      })
      .catch(() => {
        if (seq !== this._loadSeq) return;
        this.setData({ loading: false });
        wx.showToast({ title: '数据加载失败，请稍后重试', icon: 'none' });
      });
  },

  applyChartFromRecords() {
    const chartData = this.buildChartWithHeights(
      this.data.records,
      this.data.currentMonth,
      this.data.chartMode
    );
    this.setData({ chartData });
  },

  /**
   * 按所选月份与模式生成柱状图数据，heightPct 为相对当月（或周桶）最大值的百分比
   */
  processChartData(records, currentMonth, chartMode) {
    const parts = currentMonth.split('-');
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const lastDay = new Date(y, m, 0).getDate();
    const now = new Date();
    const isCurrentMonth = util.formatMonth(now) === currentMonth;

    if (chartMode === 'weekly') {
      return this.processWeeklyBuckets(records, y, m, lastDay, isCurrentMonth, now);
    }

    return this.processDailyBuckets(records, y, m, lastDay, isCurrentMonth, now);
  },

  processDailyBuckets(records, y, m, lastDay, isCurrentMonth, now) {
    const byDate = {};
    records.forEach(r => {
      const key = r.record_date;
      byDate[key] = (byDate[key] || 0) + (parseFloat(r.total_revenue) || 0);
    });

    const endDay = isCurrentMonth ? Math.min(now.getDate(), lastDay) : lastDay;
    const startDay = Math.max(1, endDay - 6);
    const rows = [];

    for (let d = startDay; d <= endDay; d++) {
      const ds =
        `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const amount = byDate[ds] || 0;
      const wd = new Date(y, m - 1, d).getDay();
      rows.push({
        label: WEEKDAY_SHORT[wd],
        sublabel: `${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')}`,
        amount,
        amountFmt: util.formatMoney(amount)
      });
    }

    return rows;
  },

  processWeeklyBuckets(records, y, m, lastDay, isCurrentMonth, now) {
    const endDay = isCurrentMonth ? Math.min(now.getDate(), lastDay) : lastDay;
    const byWeek = {};

    records.forEach(r => {
      const segs = r.record_date.split('-');
      const ry = parseInt(segs[0], 10);
      const rm = parseInt(segs[1], 10);
      const rd = parseInt(segs[2], 10);
      if (ry !== y || rm !== m) return;
      const w = Math.ceil(rd / 7);
      const amt = parseFloat(r.total_revenue) || 0;
      byWeek[w] = (byWeek[w] || 0) + amt;
    });

    const maxWeekIdx = Math.ceil(endDay / 7);
    const minWeekIdx = Math.max(1, maxWeekIdx - 6);
    const rows = [];

    for (let w = minWeekIdx; w <= maxWeekIdx; w++) {
      const amount = byWeek[w] || 0;
      rows.push({
        label: `第${w}周`,
        sublabel: `${String(m).padStart(2, '0')}月`,
        amount,
        amountFmt: util.formatMoney(amount)
      });
    }

    if (!rows.length) {
      const cap = Math.ceil(lastDay / 7) || 1;
      for (let w = 1; w <= cap; w++) {
        const amount = byWeek[w] || 0;
        rows.push({
          label: `第${w}周`,
          sublabel: `${String(m).padStart(2, '0')}月`,
          amount,
          amountFmt: util.formatMoney(amount)
        });
      }
    }

    return rows;
  },

  buildChartWithHeights(records, currentMonth, chartMode) {
    const rows = this.processChartData(records, currentMonth, chartMode);
    let maxAmt = 0;
    rows.forEach(r => {
      if (r.amount > maxAmt) maxAmt = r.amount;
    });
    if (maxAmt <= 0) maxAmt = 1;

    return rows.map((r, i) => {
      const rawPct = (r.amount / maxAmt) * 100;
      const heightPct =
        r.amount > 0 ? Math.max(6, Math.round(rawPct)) : 0;
      return {
        ...r,
        heightPct,
        chartKey: chartMode + '-' + i + '-' + (r.sublabel || '') + '-' + r.label
      };
    });
  },

  groupByDate(records) {
    const map = {};
    for (let i = 0; i < records.length; i++) {
      const r = records[i];
      const key = r.record_date;
      if (!map[key]) map[key] = [];
      const up = parseFloat(r.unit_price) || 0;
      const sw = parseInt(r.sold_wechat, 10) || 0;
      const sa = parseInt(r.sold_alipay, 10) || 0;
      const sc = parseInt(r.sold_cash, 10) || 0;
      map[key].push(
        Object.assign({}, r, {
          revenueFormatted: util.formatMoney(r.total_revenue),
          wechatAmtFmt: util.formatMoney(sw * up),
          alipayAmtFmt: util.formatMoney(sa * up),
          cashAmtFmt: util.formatMoney(sc * up)
        })
      );
    }

    const dates = Object.keys(map).sort((a, b) => b.localeCompare(a));
    return dates.map(date => {
      const segs = date.split('-');
      const mm = segs[1];
      const dd = segs[2];
      const items = map[date];
      return {
        date,
        dateDisplay: `${mm}.${dd}`,
        weekday: util.getWeekday(date),
        items: Array.isArray(items) ? items : []
      };
    });
  }
});
