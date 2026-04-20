import { describe, expect, it } from 'vitest'
import { MAX_CASH, MAX_QTY } from '@somoke/shared'
import { isValidDateYYYYMMDD, parseNonNegFloat, parseNonNegInt } from './validators'

describe('parseNonNegInt', () => {
  it('接受合法非负整数', () => {
    expect(parseNonNegInt('0')).toBe(0)
    expect(parseNonNegInt('123')).toBe(123)
  })

  it('拒绝小数/负数/非法字符', () => {
    expect(parseNonNegInt('1.2')).toBeNull()
    expect(parseNonNegInt('-1')).toBeNull()
    expect(parseNonNegInt('abc')).toBeNull()
    expect(parseNonNegInt('')).toBeNull()
    expect(parseNonNegInt(null)).toBeNull()
  })

  it('拒绝超上限的值', () => {
    expect(parseNonNegInt(String(MAX_QTY + 1))).toBeNull()
    expect(parseNonNegInt(String(MAX_QTY))).toBe(MAX_QTY)
  })
})

describe('parseNonNegFloat', () => {
  it('接受至多两位小数的非负值', () => {
    expect(parseNonNegFloat('0')).toBe(0)
    expect(parseNonNegFloat('1.2')).toBe(1.2)
    expect(parseNonNegFloat('1.23')).toBe(1.23)
  })

  it('拒绝多于两位小数或非法字符', () => {
    expect(parseNonNegFloat('1.234')).toBeNull()
    expect(parseNonNegFloat('-0.1')).toBeNull()
    expect(parseNonNegFloat('abc')).toBeNull()
  })

  it('拒绝超上限的值', () => {
    expect(parseNonNegFloat(String(MAX_CASH + 1))).toBeNull()
  })
})

describe('isValidDateYYYYMMDD', () => {
  it('接受合法日期格式', () => {
    expect(isValidDateYYYYMMDD('2026-04-20')).toBe(true)
  })

  it('拒绝非法或其它格式', () => {
    expect(isValidDateYYYYMMDD('2026/04/20')).toBe(false)
    expect(isValidDateYYYYMMDD('abc')).toBe(false)
    expect(isValidDateYYYYMMDD('')).toBe(false)
    expect(isValidDateYYYYMMDD(null)).toBe(false)
  })
})
