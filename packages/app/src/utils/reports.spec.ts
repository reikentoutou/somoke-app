import { describe, expect, it } from 'vitest'
import type { ShiftRecord } from '@somoke/shared'
import {
  buildChartRows,
  buildReportsHeroLabel,
  defaultPickerDateInMonth,
  detailFilterDayLabel,
  filterGroupsByDate,
  groupRecordsByDate,
  monthDayBounds
} from './reports'

function mkRec(partial: Partial<ShiftRecord> & { id: number; record_date: string }): ShiftRecord {
  return {
    id: partial.id,
    store_id: 1,
    shift_config_id: partial.shift_config_id ?? 1,
    shift_name: partial.shift_name ?? '早班',
    record_date: partial.record_date,
    recorder_name: partial.recorder_name ?? '小王',
    qty_opening: partial.qty_opening ?? 0,
    qty_closing: partial.qty_closing ?? 0,
    qty_gift: partial.qty_gift ?? 0,
    qty_sold: partial.qty_sold ?? 0,
    sold_wechat: partial.sold_wechat ?? 0,
    sold_alipay: partial.sold_alipay ?? 0,
    sold_cash: partial.sold_cash ?? 0,
    cash_opening: partial.cash_opening ?? 0,
    cash_closing: partial.cash_closing ?? 0,
    unit_price: partial.unit_price ?? 3000,
    total_revenue: partial.total_revenue ?? 0
  }
}

describe('reports utils', () => {
  it('buildReportsHeroLabel handles valid and invalid input', () => {
    expect(buildReportsHeroLabel('2026-04')).toBe('2026年4月 · 营收汇总')
    expect(buildReportsHeroLabel('bad')).toBe('营收汇总')
    expect(buildReportsHeroLabel('2026-13')).toBe('营收汇总')
  })

  it('monthDayBounds returns start/end', () => {
    expect(monthDayBounds('2026-02')).toEqual({ start: '2026-02-01', end: '2026-02-28' })
    expect(monthDayBounds('bad')).toEqual({ start: '', end: '' })
  })

  it('defaultPickerDateInMonth picks today if in month else month start', () => {
    const today = new Date(2026, 3, 20)
    expect(defaultPickerDateInMonth('2026-04', today)).toBe('2026-04-20')
    expect(defaultPickerDateInMonth('2026-03', today)).toBe('2026-03-01')
    expect(defaultPickerDateInMonth('bad', today)).toBe('')
  })

  it('detailFilterDayLabel formats ISO → `M月D日 周X`', () => {
    const label = detailFilterDayLabel('2026-04-20')
    expect(label).toMatch(/^4月20日 周/)
    expect(detailFilterDayLabel('nope')).toBe('')
  })

  it('groupRecordsByDate groups and decorates records', () => {
    const rs = [
      mkRec({ id: 1, record_date: '2026-04-18', total_revenue: 3000, sold_wechat: 1 }),
      mkRec({ id: 2, record_date: '2026-04-20', total_revenue: 6000, sold_alipay: 2 }),
      mkRec({ id: 3, record_date: '2026-04-20', total_revenue: 3000, sold_cash: 1 })
    ]
    const groups = groupRecordsByDate(rs)
    expect(groups).toHaveLength(2)
    expect(groups[0]?.date).toBe('2026-04-20')
    expect(groups[0]?.dateDisplay).toBe('04.20')
    expect(groups[0]?.items).toHaveLength(2)
    expect(groups[0]?.items[0]?.revenueFormatted).toBe('6,000.00')
    expect(groups[0]?.items[0]?.alipayAmtFmt).toBe('6,000.00')
    expect(groups[1]?.date).toBe('2026-04-18')
  })

  it('filterGroupsByDate filters by ISO, ignores non-ISO', () => {
    const groups = groupRecordsByDate([
      mkRec({ id: 1, record_date: '2026-04-18' }),
      mkRec({ id: 2, record_date: '2026-04-20' })
    ])
    expect(filterGroupsByDate(groups, '2026-04-20')).toHaveLength(1)
    expect(filterGroupsByDate(groups, '')).toHaveLength(2)
    expect(filterGroupsByDate(groups, 'bad-date')).toHaveLength(2)
  })

  it('buildChartRows daily builds 7 bars ending today for current month', () => {
    const now = new Date(2026, 3, 20)
    const rows = buildChartRows(
      [
        mkRec({ id: 1, record_date: '2026-04-14', total_revenue: 1000 }),
        mkRec({ id: 2, record_date: '2026-04-20', total_revenue: 5000 })
      ],
      '2026-04',
      'daily',
      now
    )
    expect(rows).toHaveLength(7)
    expect(rows[rows.length - 1]?.sublabel).toBe('04.20')
    expect(rows[rows.length - 1]?.amount).toBe(5000)
    expect(rows[rows.length - 1]?.heightPct).toBe(100)
    expect(rows[0]?.amount).toBe(1000)
    expect(rows[0]?.heightPct).toBeGreaterThanOrEqual(6)
    expect(rows[0]?.chartKey).toMatch(/^daily-/)
  })

  it('buildChartRows weekly buckets align to 7-day weeks', () => {
    const now = new Date(2026, 3, 20)
    const rows = buildChartRows(
      [
        mkRec({ id: 1, record_date: '2026-04-03', total_revenue: 1000 }),
        mkRec({ id: 2, record_date: '2026-04-15', total_revenue: 2000 }),
        mkRec({ id: 3, record_date: '2026-04-20', total_revenue: 3000 })
      ],
      '2026-04',
      'weekly',
      now
    )
    expect(rows.length).toBeGreaterThanOrEqual(1)
    const lastWeek = rows[rows.length - 1]
    expect(lastWeek?.label).toBe('第3周')
    // 4月15 (第3周) + 4月20 (第3周) 合并
    expect(lastWeek?.amount).toBe(5000)
    const wk1 = rows.find(r => r.label === '第1周')
    expect(wk1?.amount).toBe(1000)
  })

  it('buildChartRows returns empty for invalid month', () => {
    expect(buildChartRows([], 'bad', 'daily')).toEqual([])
  })
})
