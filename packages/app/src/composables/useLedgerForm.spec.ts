import { setActivePinia, createPinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { useLedgerForm } from './useLedgerForm'
import type { ShiftRecord } from '@somoke/shared'

function mkRecord(over: Partial<ShiftRecord> = {}): ShiftRecord {
  return {
    id: 1,
    store_id: 1,
    shift_config_id: 2,
    shift_name: '早班',
    record_date: '2026-04-20',
    recorder_name: '老王',
    qty_opening: 10,
    qty_closing: 5,
    qty_gift: 0,
    qty_sold: 5,
    sold_wechat: 3,
    sold_alipay: 1,
    sold_cash: 1,
    cash_opening: 1000,
    cash_closing: 4000,
    unit_price: 3000,
    total_revenue: 15000,
    ...over
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('useLedgerForm', () => {
  it('create 态默认日期为今日', () => {
    const f = useLedgerForm()
    expect(f.state.mode).toBe('create')
    expect(f.isDateToday.value).toBe(true)
  })

  it('fillFromRecord 切换到 edit 并回填字段', () => {
    const f = useLedgerForm()
    f.fillFromRecord(mkRecord(), [2, 3])
    expect(f.state.mode).toBe('edit')
    expect(f.state.editRecordId).toBe(1)
    expect(f.state.shiftConfigId).toBe(2)
    expect(f.state.fields.qtyOpening).toBe('10')
    expect(f.state.fields.cashClosing).toBe('4000')
  })

  it('fillFromRecord 时记录班次已失效，回退到 activeShifts 首项', () => {
    const f = useLedgerForm()
    f.fillFromRecord(mkRecord({ shift_config_id: 999 }), [5, 6])
    expect(f.state.shiftConfigId).toBe(5)
  })

  it('applyOpeningPrefill：字段为空时预填，标记 openingPrefilled', () => {
    const f = useLedgerForm()
    f.applyOpeningPrefill(42, 1234)
    expect(f.state.fields.qtyOpening).toBe('42')
    expect(f.state.fields.cashOpening).toBe('1234')
    expect(f.state.openingPrefilled).toBe(true)
  })

  it('applyOpeningPrefill：用户手改过之后，prefill 不再覆盖', () => {
    const f = useLedgerForm()
    f.applyOpeningPrefill(42, 1234) // 第一次预填
    f.markManualEdit('qtyOpening', '100') // 用户手改
    f.applyOpeningPrefill(200, 5000) // 再次 prefill
    expect(f.state.fields.qtyOpening).toBe('100') // 保留
    expect(f.state.fields.cashOpening).toBe('5000') // 现金没改，仍被覆盖
  })

  it('edit 态不应用 prefill', () => {
    const f = useLedgerForm()
    f.fillFromRecord(mkRecord(), [2])
    f.applyOpeningPrefill(999, 999)
    expect(f.state.fields.qtyOpening).toBe('10')
  })

  it('summary 是派生态，随字段变化自动更新', () => {
    const f = useLedgerForm()
    f.state.fields.qtyOpening = '10'
    f.state.fields.qtyClosing = '3'
    f.state.fields.qtyGift = '2'
    f.state.fields.soldWechat = '2'
    f.state.fields.soldAlipay = '1'
    f.state.fields.soldCash = '2'
    expect(f.summary.value.qtySold).toBe(5)
    expect(f.summary.value.paymentSoldTotal).toBe(5)
    expect(f.summary.value.totalRevenueJpy).toBe(15000)
  })

  it('buildAddPayload 合成合法 payload', () => {
    const f = useLedgerForm()
    f.state.recordDate = '2026-04-20'
    f.state.shiftConfigId = 7
    f.state.recorderName = '老王'
    f.state.fields.qtyOpening = '10'
    f.state.fields.qtyClosing = '5'
    f.state.fields.cashOpening = '100'
    f.state.fields.cashClosing = '200'
    const body = f.buildAddPayload()
    expect(body.shift_config_id).toBe(7)
    expect(body.qty_opening).toBe(10)
    expect(body.cash_closing).toBe(200)
  })

  it('resetToCreate 清空表单并解除 prefill 锁', () => {
    const f = useLedgerForm()
    f.applyOpeningPrefill(1, 2)
    f.resetToCreate()
    expect(f.state.mode).toBe('create')
    expect(f.state.fields.qtyOpening).toBe('')
    expect(f.state.openingPrefilled).toBe(false)
  })
})
