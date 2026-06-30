import { describe, expect, it } from 'vitest'
import type { ShiftConfigListItem } from '@somoke/shared'
import {
  buildSoftWarnings,
  computePaymentMix,
  computeSummary,
  emptyFormFields,
  ITEM_UNIT_PRICE_JPY,
  parseCashInput,
  parseIntField,
  shiftIndexForConfigId,
  stockDeductFromLine,
  validateProductLinesAndCash,
  validateProductStockAvailability,
  validateRequiredQtyAndCash,
  type LedgerFormFields
} from './ledgerForm'

function mkFields(over: Partial<LedgerFormFields> = {}): LedgerFormFields {
  return { ...emptyFormFields(), ...over }
}

describe('parseCashInput', () => {
  it('空/非法返回 null', () => {
    expect(parseCashInput('')).toBeNull()
    expect(parseCashInput('abc')).toBeNull()
    expect(parseCashInput(null)).toBeNull()
  })
  it('支持千分位', () => {
    expect(parseCashInput('1,234.5')).toBe(1234.5)
  })
})

describe('parseIntField', () => {
  it('空/非法/负数落到 0', () => {
    expect(parseIntField('')).toBe(0)
    expect(parseIntField('abc')).toBe(0)
    expect(parseIntField('-5')).toBe(0)
  })
  it('合法整数原样', () => {
    expect(parseIntField('42')).toBe(42)
    expect(parseIntField(10)).toBe(10)
  })
})

describe('validateRequiredQtyAndCash', () => {
  it('缺上班数量', () => {
    expect(
      validateRequiredQtyAndCash(mkFields({ qtyClosing: '0', cashOpening: '0', cashClosing: '0' }))
        .ok
    ).toBe(false)
  })
  it('全部必填满足', () => {
    const r = validateRequiredQtyAndCash(
      mkFields({
        qtyOpening: '10',
        qtyClosing: '5',
        cashOpening: '0',
        cashClosing: '100'
      })
    )
    expect(r.ok).toBe(true)
  })
  it('非负整数校验', () => {
    const r = validateRequiredQtyAndCash(
      mkFields({
        qtyOpening: '10.5',
        qtyClosing: '5',
        cashOpening: '0',
        cashClosing: '0'
      })
    )
    expect(r.ok).toBe(false)
    expect(r.message).toContain('上班数量')
  })
})

describe('buildSoftWarnings', () => {
  it('盘点与支付合计不一致时触发', () => {
    const lines = buildSoftWarnings({
      qtySold: 5,
      paymentTotal: 4,
      soldCash: 0,
      cashOpening: '0',
      cashClosing: '0'
    })
    expect(lines.length).toBeGreaterThan(0)
    expect(lines[0]).toContain('不一致')
  })
  it('现金有售出但现金差额为 0 时提示', () => {
    const lines = buildSoftWarnings({
      qtySold: 1,
      paymentTotal: 1,
      soldCash: 1,
      cashOpening: '100',
      cashClosing: '100'
    })
    expect(lines.some(l => l.includes('钱箱是否有变化'))).toBe(true)
  })
})

describe('computePaymentMix', () => {
  it('零件数时 showPaymentMix=false', () => {
    const m = computePaymentMix(0, 0, 0)
    expect(m.showPaymentMix).toBe(false)
  })
  it('占比总和为 100', () => {
    const m = computePaymentMix(1, 2, 3)
    expect(Math.round(m.payPctW + m.payPctA + m.payPctC)).toBe(100)
  })
})

describe('computeSummary', () => {
  it('qtySold = opening - closing - gift，钳制到 0', () => {
    const s = computeSummary(mkFields({ qtyOpening: '10', qtyClosing: '3', qtyGift: '2' }))
    expect(s.qtySold).toBe(5)
  })
  it('营业额 = 支付合计 × 单价', () => {
    const s = computeSummary(mkFields({ soldWechat: '1', soldAlipay: '1', soldCash: '1' }))
    expect(s.totalRevenueJpy).toBe(3 * ITEM_UNIT_PRICE_JPY)
  })

  it('多商品营业额按各商品单价汇总', () => {
    const s = computeSummary(mkFields({ cashOpening: '0', cashClosing: '0' }), [
      {
        productId: 1,
        productName: 'A',
        categoryId: 1,
        categoryName: '默认分类',
        unitPrice: 3000,
        currentStock: 10,
        qtyOpening: '10',
        qtyClosing: '8',
        qtyGift: '',
        soldWechat: '1',
        soldAlipay: '',
        soldCash: '1'
      },
      {
        productId: 2,
        productName: 'B',
        categoryId: 1,
        categoryName: '默认分类',
        unitPrice: 5000,
        currentStock: 10,
        qtyOpening: '10',
        qtyClosing: '9',
        qtyGift: '',
        soldWechat: '',
        soldAlipay: '1',
        soldCash: ''
      }
    ])
    expect(s.qtySold).toBe(3)
    expect(s.paymentSoldTotal).toBe(3)
    expect(s.totalRevenueJpy).toBe(11000)
    expect(s.productRows.map(r => r.totalRevenueJpy)).toEqual([6000, 5000])
  })

  it('多商品现金提醒按整班现金售出合计判断', () => {
    const s = computeSummary(mkFields({ cashOpening: '0', cashClosing: '3000' }), [
      {
        productId: 1,
        productName: 'A',
        categoryId: 1,
        categoryName: '默认分类',
        unitPrice: 3000,
        currentStock: 10,
        qtyOpening: '10',
        qtyClosing: '9',
        qtyGift: '',
        soldWechat: '',
        soldAlipay: '',
        soldCash: '1'
      },
      {
        productId: 2,
        productName: 'B',
        categoryId: 1,
        categoryName: '默认分类',
        unitPrice: 5000,
        currentStock: 10,
        qtyOpening: '10',
        qtyClosing: '10',
        qtyGift: '',
        soldWechat: '',
        soldAlipay: '',
        soldCash: ''
      }
    ])

    expect(s.softWarnings.some(line => line.includes('未登记现金售出件数'))).toBe(false)
  })
})

describe('validateProductLinesAndCash', () => {
  it('要求至少一个商品行和现金字段', () => {
    expect(validateProductLinesAndCash([], { cashOpening: '0', cashClosing: '0' }).ok).toBe(false)
    const r = validateProductLinesAndCash(
      [
        {
          productId: 1,
          productName: 'A',
          categoryId: 1,
          categoryName: '默认分类',
          unitPrice: 3000,
          currentStock: 10,
          qtyOpening: '10',
          qtyClosing: '9',
          qtyGift: '',
          soldWechat: '1',
          soldAlipay: '',
          soldCash: ''
        }
      ],
      { cashOpening: '0', cashClosing: '3000' }
    )
    expect(r.ok).toBe(true)
  })

  it('创建态商品库存不足时阻止提交前校验', () => {
    const r = validateProductLinesAndCash(
      [
        {
          productId: 1,
          productName: 'A',
          categoryId: 1,
          categoryName: '默认分类',
          unitPrice: 3000,
          currentStock: 5,
          qtyOpening: '5',
          qtyClosing: '0',
          qtyGift: '',
          soldWechat: '6',
          soldAlipay: '',
          soldCash: ''
        }
      ],
      { cashOpening: '0', cashClosing: '3000' },
      { enforceCurrentStock: true }
    )

    expect(r.ok).toBe(false)
    expect(r.message).toContain('库存不足')
  })

  it('库存校验按盘点售出、支付件数和赠送的最大扣减计算', () => {
    const line = {
      productId: 1,
      productName: 'A',
      categoryId: 1,
      categoryName: '默认分类',
      unitPrice: 3000,
      currentStock: 5,
      qtyOpening: '5',
      qtyClosing: '3',
      qtyGift: '1',
      soldWechat: '4',
      soldAlipay: '',
      soldCash: ''
    }

    expect(stockDeductFromLine(line)).toBe(5)
    expect(validateProductStockAvailability([line]).ok).toBe(true)
  })
})

describe('shiftIndexForConfigId', () => {
  const shifts: ShiftConfigListItem[] = [
    { id: 1, name: 'A', start_time: '09:00', end_time: '15:00', sort_order: 0 },
    { id: 2, name: 'B', start_time: '15:00', end_time: '22:00', sort_order: 1 }
  ]
  it('命中返回对应下标', () => {
    expect(shiftIndexForConfigId(shifts, 2)).toBe(1)
  })
  it('未命中或空 id 返回 0', () => {
    expect(shiftIndexForConfigId(shifts, null)).toBe(0)
    expect(shiftIndexForConfigId(shifts, 999)).toBe(0)
    expect(shiftIndexForConfigId([], 1)).toBe(0)
  })
})
