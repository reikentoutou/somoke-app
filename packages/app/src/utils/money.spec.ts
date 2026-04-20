import { describe, expect, it } from 'vitest'
import { formatCash, formatQty, signed } from './money'

describe('formatCash', () => {
  it('保留两位小数并加千分位', () => {
    expect(formatCash(1234567.8)).toBe('1,234,567.80')
    expect(formatCash(0)).toBe('0.00')
  })
  it('null/NaN 返回 —', () => {
    expect(formatCash(null)).toBe('—')
    expect(formatCash(Number.NaN)).toBe('—')
  })
  it('支持前置货币标识', () => {
    expect(formatCash(10, 'JPY')).toBe('JPY 10.00')
  })
})

describe('formatQty', () => {
  it('整数加千分位', () => {
    expect(formatQty(1000000)).toBe('1,000,000')
  })
})

describe('signed', () => {
  it('正数带 +，负数原样', () => {
    expect(signed(3)).toBe('+3')
    expect(signed(-1)).toBe('-1')
    expect(signed(0)).toBe('0')
  })
})
