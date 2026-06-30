import { describe, expect, it } from 'vitest'
import type { ShiftRecord, UserInfo } from '@somoke/shared'
import { canEditRecord, mapRecordToDetailView, recorderInitial } from './shiftDetail'

function mkUser(partial: Partial<UserInfo> = {}): UserInfo {
  return {
    id: partial.id ?? 1,
    nickname: partial.nickname ?? 'u',
    avatar_url: '',
    current_store_id: null,
    store_id: null,
    role: 2,
    stores: [],
    store_count: 0,
    ...partial
  }
}

describe('recorderInitial', () => {
  it('returns first char after trim or empty', () => {
    expect(recorderInitial('  小王 ')).toBe('小')
    expect(recorderInitial('')).toBe('')
    expect(recorderInitial(null)).toBe('')
    expect(recorderInitial(undefined)).toBe('')
  })
})

describe('mapRecordToDetailView', () => {
  it('maps a full record to view values', () => {
    const row: ShiftRecord = {
      id: 10,
      store_id: 1,
      shift_config_id: 2,
      shift_name: '早班',
      record_date: '2026-04-20',
      recorder_name: '小王',
      recorder_id: 11,
      qty_opening: 100,
      qty_closing: 80,
      qty_gift: 2,
      qty_sold: 18,
      sold_wechat: 10,
      sold_alipay: 5,
      sold_cash: 3,
      cash_opening: 1000,
      cash_closing: 55000,
      unit_price: 3000,
      total_revenue: 54000,
      items: [
        {
          product_id: 1,
          product_name: 'A',
          category_id: 1,
          category_name: '默认分类',
          unit_price: 3000,
          qty_opening: 80,
          qty_closing: 65,
          qty_gift: 0,
          qty_sold: 15,
          sold_wechat: 10,
          sold_alipay: 5,
          sold_cash: 0,
          total_revenue: 45000,
          stock_deduct: 15
        },
        {
          product_id: 2,
          product_name: 'B',
          category_id: 1,
          category_name: '默认分类',
          unit_price: 3000,
          qty_opening: 20,
          qty_closing: 15,
          qty_gift: 2,
          qty_sold: 3,
          sold_wechat: 0,
          sold_alipay: 0,
          sold_cash: 3,
          total_revenue: 9000,
          stock_deduct: 5
        }
      ]
    }
    const v = mapRecordToDetailView(row)
    expect(v.shiftName).toBe('早班')
    expect(v.recordDateDisplay).toMatch(/^2026-04-20 周/)
    expect(v.recorderInitial).toBe('小')
    expect(v.qtySoldFormatted).toBe('18')
    expect(v.wechatAmountStr).toBe('30,000.00')
    expect(v.alipayAmountStr).toBe('15,000.00')
    expect(v.cashAmountStr).toBe('9,000.00')
    expect(v.cashOpeningStr).toBe('1,000.00')
    expect(v.cashClosingStr).toBe('55,000.00')
    expect(v.unitPrice).toBe(3000)
    expect(v.productRows).toHaveLength(2)
    expect(v.productRows[1]?.qtyGiftFormatted).toBe('2')
  })

  it('uses item unit prices for channel amounts', () => {
    const row: ShiftRecord = {
      id: 11,
      store_id: 1,
      shift_config_id: 2,
      shift_name: '早班',
      record_date: '2026-04-20',
      recorder_name: '小王',
      qty_opening: 0,
      qty_closing: 0,
      qty_gift: 0,
      qty_sold: 2,
      sold_wechat: 1,
      sold_alipay: 1,
      sold_cash: 0,
      cash_opening: 0,
      cash_closing: 0,
      unit_price: 0,
      total_revenue: 8000,
      items: [
        {
          product_id: 1,
          product_name: 'A',
          category_id: 1,
          category_name: '默认分类',
          unit_price: 3000,
          qty_opening: 0,
          qty_closing: 0,
          qty_gift: 0,
          qty_sold: 1,
          sold_wechat: 1,
          sold_alipay: 0,
          sold_cash: 0,
          total_revenue: 3000,
          stock_deduct: 1
        },
        {
          product_id: 2,
          product_name: 'B',
          category_id: 1,
          category_name: '默认分类',
          unit_price: 5000,
          qty_opening: 0,
          qty_closing: 0,
          qty_gift: 0,
          qty_sold: 1,
          sold_wechat: 0,
          sold_alipay: 1,
          sold_cash: 0,
          total_revenue: 5000,
          stock_deduct: 1
        }
      ]
    }
    const v = mapRecordToDetailView(row)
    expect(v.wechatAmountStr).toBe('3,000.00')
    expect(v.alipayAmountStr).toBe('5,000.00')
    expect(v.productRows.map(r => r.totalRevenueStr)).toEqual(['3,000.00', '5,000.00'])
  })

  it('returns empty view when row is null/undefined', () => {
    const v = mapRecordToDetailView(null)
    expect(v.shiftName).toBe('—')
    expect(v.recorderName).toBe('—')
    expect(v.qtySoldFormatted).toBe('0')
  })
})

describe('canEditRecord', () => {
  it('boss can always edit', () => {
    const user = mkUser({ id: 5 })
    expect(canEditRecord({ recorder_id: 99 }, user, true)).toBe(true)
  })

  it('non-boss can edit only if recorder_id matches user.id', () => {
    const user = mkUser({ id: 7 })
    expect(canEditRecord({ recorder_id: 7 }, user, false)).toBe(true)
    expect(canEditRecord({ recorder_id: 8 }, user, false)).toBe(false)
  })

  it('returns false on missing inputs', () => {
    expect(canEditRecord(null, mkUser(), true)).toBe(false)
    expect(canEditRecord({ recorder_id: 7 }, null, true)).toBe(false)
    expect(canEditRecord({ recorder_id: 0 }, mkUser({ id: 0 }), false)).toBe(false)
  })
})
