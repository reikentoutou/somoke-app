import type { ShiftRecord } from '@somoke/shared'
import { formatCash } from './money'
import { formatMonth, getWeekday, lastDayOfMonth, monthDayBounds } from './date'

/**
 * reports 页的纯函数域：
 * - 不依赖 Vue / uni，方便 Vitest 覆盖。
 * - 页面只做「状态 + 组合」，计算都放这里。
 *
 * 与旧实现对齐点：
 * - 柱状图仅展示最近 7 个桶（按日/按周）；
 * - height % 最小 6%，避免 0 值被视觉吞掉；
 * - 日期按 record_date 降序分组，每组再保留 API 返回顺序。
 */

export const WEEKDAY_SHORT = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const

export type ChartMode = 'daily' | 'weekly'

export interface ChartRow {
  label: string
  sublabel: string
  amount: number
  amountFmt: string
  heightPct: number
  chartKey: string
}

export interface DailyShiftItem extends ShiftRecord {
  revenueFormatted: string
  wechatAmtFmt: string
  alipayAmtFmt: string
  cashAmtFmt: string
}

export interface DailyGroup {
  date: string
  dateDisplay: string
  weekday: string
  items: DailyShiftItem[]
}

/** 估算某天的渠道金额（qty × unit_price）——旧实现在明细卡里展示 */
function decorateShiftItem(r: ShiftRecord): DailyShiftItem {
  const up = Number(r.unit_price) || 0
  const sw = Number(r.sold_wechat) || 0
  const sa = Number(r.sold_alipay) || 0
  const sc = Number(r.sold_cash) || 0
  return {
    ...r,
    revenueFormatted: formatCash(Number(r.total_revenue) || 0),
    wechatAmtFmt: formatCash(sw * up),
    alipayAmtFmt: formatCash(sa * up),
    cashAmtFmt: formatCash(sc * up)
  }
}

/** 按 record_date 分组，外层按日期降序，内层保留输入顺序（一般是 API shift 顺序）。 */
export function groupRecordsByDate(records: ShiftRecord[]): DailyGroup[] {
  const map = new Map<string, DailyShiftItem[]>()
  for (const r of records) {
    const key = r.record_date
    if (!key) continue
    const bucket = map.get(key) ?? []
    bucket.push(decorateShiftItem(r))
    map.set(key, bucket)
  }
  const dates = Array.from(map.keys()).sort((a, b) => b.localeCompare(a))
  return dates.map(date => {
    const [, mm = '', dd = ''] = date.split('-')
    return {
      date,
      dateDisplay: `${mm}.${dd}`,
      weekday: getWeekday(date),
      items: map.get(date) ?? []
    }
  })
}

/** 按 ISO 日期过滤分组，空串/非法返回原列表。 */
export function filterGroupsByDate(groups: DailyGroup[], date: string): DailyGroup[] {
  const d = (date || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return groups
  return groups.filter(g => g.date === d)
}

/** 供 picker 默认值：若今天属于该月，落在今天，否则月首日。 */
export function defaultPickerDateInMonth(ym: string, today: Date = new Date()): string {
  const b = monthDayBounds(ym)
  if (!b.start) return ''
  const todayYm = formatMonth(today)
  if (todayYm === ym) {
    const dd = String(today.getDate()).padStart(2, '0')
    return `${ym}-${dd}`
  }
  return b.start
}

/** 展示筛选 chip：'4月15日 周一' */
export function detailFilterDayLabel(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ''
  const [, mm = '', dd = ''] = iso.split('-')
  const m = Number.parseInt(mm, 10)
  const d = Number.parseInt(dd, 10)
  if (!Number.isFinite(m) || !Number.isFinite(d)) return iso
  const wd = getWeekday(iso)
  return `${m}月${d}日${wd ? ` ${wd}` : ''}`
}

/** Hero 标题：'2026年4月 · 营收汇总' */
export function buildReportsHeroLabel(ym: string): string {
  const [y, m] = ym.split('-').map(n => Number.parseInt(n, 10))
  if (!y || !m || m < 1 || m > 12) return '营收汇总'
  return `${y}年${m}月 · 营收汇总`
}

function fmtMonthDay(m: number, d: number): string {
  return `${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')}`
}

/**
 * 每日桶：仅展示最近 7 天；若当月>今日，则截断到今日，避免未来日期出现 0 柱。
 */
function dailyBuckets(
  records: ShiftRecord[],
  y: number,
  m: number,
  lastDay: number,
  isCurrentMonth: boolean,
  now: Date
): Omit<ChartRow, 'heightPct' | 'chartKey'>[] {
  const byDate = new Map<string, number>()
  for (const r of records) {
    const key = r.record_date
    if (!key) continue
    byDate.set(key, (byDate.get(key) ?? 0) + (Number(r.total_revenue) || 0))
  }

  const endDay = isCurrentMonth ? Math.min(now.getDate(), lastDay) : lastDay
  const startDay = Math.max(1, endDay - 6)
  const rows: Omit<ChartRow, 'heightPct' | 'chartKey'>[] = []

  for (let d = startDay; d <= endDay; d++) {
    const ds = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const amount = byDate.get(ds) ?? 0
    const wd = new Date(y, m - 1, d).getDay()
    rows.push({
      label: WEEKDAY_SHORT[wd] ?? '',
      sublabel: fmtMonthDay(m, d),
      amount,
      amountFmt: formatCash(amount)
    })
  }
  return rows
}

/** 周桶：最多 7 个最近周；若当月无任何数据，退化为按月全量周展示。 */
function weeklyBuckets(
  records: ShiftRecord[],
  y: number,
  m: number,
  lastDay: number,
  isCurrentMonth: boolean,
  now: Date
): Omit<ChartRow, 'heightPct' | 'chartKey'>[] {
  const endDay = isCurrentMonth ? Math.min(now.getDate(), lastDay) : lastDay
  const byWeek = new Map<number, number>()
  for (const r of records) {
    const [ry, rm, rd] = (r.record_date || '').split('-').map(n => Number.parseInt(n, 10))
    if (ry !== y || rm !== m) continue
    if (!Number.isFinite(rd)) continue
    const w = Math.ceil((rd as number) / 7)
    const amt = Number(r.total_revenue) || 0
    byWeek.set(w, (byWeek.get(w) ?? 0) + amt)
  }

  const maxWeek = Math.ceil(endDay / 7)
  const minWeek = Math.max(1, maxWeek - 6)
  const rows: Omit<ChartRow, 'heightPct' | 'chartKey'>[] = []
  for (let w = minWeek; w <= maxWeek; w++) {
    const amount = byWeek.get(w) ?? 0
    rows.push({
      label: `第${w}周`,
      sublabel: `${String(m).padStart(2, '0')}月`,
      amount,
      amountFmt: formatCash(amount)
    })
  }
  if (!rows.length) {
    const cap = Math.ceil(lastDay / 7) || 1
    for (let w = 1; w <= cap; w++) {
      const amount = byWeek.get(w) ?? 0
      rows.push({
        label: `第${w}周`,
        sublabel: `${String(m).padStart(2, '0')}月`,
        amount,
        amountFmt: formatCash(amount)
      })
    }
  }
  return rows
}

/**
 * 生成含 heightPct / chartKey 的柱状图行。
 * - now 可注入，方便测试固定"当月"。
 */
export function buildChartRows(
  records: ShiftRecord[],
  ym: string,
  mode: ChartMode,
  now: Date = new Date()
): ChartRow[] {
  const [y, m] = ym.split('-').map(n => Number.parseInt(n, 10))
  if (!y || !m) return []
  const lastDay = lastDayOfMonth(ym)
  if (!lastDay) return []
  const isCurrentMonth = formatMonth(now) === ym

  const base =
    mode === 'weekly'
      ? weeklyBuckets(records, y, m, lastDay, isCurrentMonth, now)
      : dailyBuckets(records, y, m, lastDay, isCurrentMonth, now)

  let maxAmt = 0
  for (const r of base) if (r.amount > maxAmt) maxAmt = r.amount
  if (maxAmt <= 0) maxAmt = 1

  return base.map((r, i) => ({
    ...r,
    heightPct: r.amount > 0 ? Math.max(6, Math.round((r.amount / maxAmt) * 100)) : 0,
    chartKey: `${mode}-${i}-${r.sublabel}-${r.label}`
  }))
}

export { monthDayBounds }
