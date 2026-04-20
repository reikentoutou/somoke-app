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
      total_revenue: 54000
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
