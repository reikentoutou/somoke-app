import { describe, expect, it } from 'vitest'
import type { LedgerEntry } from '@somoke/shared'
import {
  ACTION_CONFIG,
  CATEGORY_TABS,
  decorateLedgerEntry,
  filterByCategory,
  validateActionPayload
} from './stockLedger'

const baseEntry: LedgerEntry = {
  id: 1,
  event_type: 'record_add',
  delta: -10,
  balance_after: 90,
  cash_delta: 1000,
  cash_balance_after: 11000,
  time_display: '04-20 12:00',
  shift_date: '2026-04-20',
  shift_name: '早班',
  recorder_name: '小王',
  operator_name: '老板',
  note: '记账'
}

describe('stockLedger utils', () => {
  it('CATEGORY_TABS 顺序锁定', () => {
    expect(CATEGORY_TABS.map(t => t.key)).toEqual([
      'all',
      'record',
      'restock',
      'withdraw',
      'adjust'
    ])
  })

  it('decorateLedgerEntry: record_add 带符号与班次 chip', () => {
    const v = decorateLedgerEntry(baseEntry)
    expect(v.category).toBe('record')
    expect(v.typeLabel).toBe('班次记账')
    expect(v.stockDeltaDisplay).toBe('-10')
    expect(v.cashDeltaDisplay).toBe('+1000')
    expect(v.shiftChip).toBe('04-20 · 早班')
    expect(v.hasStock).toBe(true)
    expect(v.hasCash).toBe(true)
  })

  it('decorateLedgerEntry: adjust_stock 即便 delta=0 也展示库存', () => {
    const v = decorateLedgerEntry({
      ...baseEntry,
      event_type: 'adjust_stock',
      delta: 0,
      cash_delta: 0
    })
    expect(v.hasStock).toBe(true)
    expect(v.hasCash).toBe(false)
    expect(v.category).toBe('adjust')
  })

  it('decorateLedgerEntry: shiftChip 回退逻辑', () => {
    expect(
      decorateLedgerEntry({ ...baseEntry, shift_date: '', shift_name: '早班' }).shiftChip
    ).toBe('早班')
    expect(
      decorateLedgerEntry({ ...baseEntry, shift_date: '2026-04-20', shift_name: '' }).shiftChip
    ).toBe('04-20')
    expect(decorateLedgerEntry({ ...baseEntry, shift_date: '', shift_name: '' }).shiftChip).toBe('')
  })

  it('filterByCategory: all 透传，其他按类过滤', () => {
    const items = [
      decorateLedgerEntry(baseEntry),
      decorateLedgerEntry({ ...baseEntry, id: 2, event_type: 'restock', delta: 10 }),
      decorateLedgerEntry({ ...baseEntry, id: 3, event_type: 'withdraw', delta: 0 })
    ]
    expect(filterByCategory(items, 'all')).toHaveLength(3)
    expect(filterByCategory(items, 'record').map(i => i.id)).toEqual([1])
    expect(filterByCategory(items, 'restock').map(i => i.id)).toEqual([2])
    expect(filterByCategory(items, 'withdraw').map(i => i.id)).toEqual([3])
  })

  it('ACTION_CONFIG: 四种 action 均已定义', () => {
    expect(Object.keys(ACTION_CONFIG).sort()).toEqual([
      'adjust_cash',
      'adjust_stock',
      'restock',
      'withdraw'
    ])
  })

  it('validateActionPayload: restock 必须正整数', () => {
    expect(validateActionPayload('restock', { val_stock: '0', val_cash: '' }).ok).toBe(false)
    expect(validateActionPayload('restock', { val_stock: '', val_cash: '' }).ok).toBe(false)
    const good = validateActionPayload('restock', { val_stock: '12', val_cash: '' })
    expect(good.ok).toBe(true)
    expect(good.val_stock).toBe(12)
  })

  it('validateActionPayload: adjust_stock 允许 0', () => {
    const res = validateActionPayload('adjust_stock', { val_stock: '0', val_cash: '' })
    expect(res.ok).toBe(true)
    expect(res.val_stock).toBe(0)
    expect(validateActionPayload('adjust_stock', { val_stock: '-1', val_cash: '' }).ok).toBe(false)
  })

  it('validateActionPayload: withdraw 要求金额 > 0', () => {
    expect(validateActionPayload('withdraw', { val_stock: '', val_cash: '0' }).ok).toBe(false)
    const res = validateActionPayload('withdraw', { val_stock: '', val_cash: '120.5' })
    expect(res.ok).toBe(true)
    expect(res.val_cash).toBe(120.5)
  })

  it('validateActionPayload: adjust_cash 允许 0', () => {
    const res = validateActionPayload('adjust_cash', { val_stock: '', val_cash: '0' })
    expect(res.ok).toBe(true)
    expect(res.val_cash).toBe(0)
  })
})
