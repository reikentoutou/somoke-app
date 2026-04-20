import { MAX_CASH, MAX_QTY } from '@somoke/shared'

/**
 * 非负整数解析：格式不合法/超过上限返回 null。与云函数 parseNonNegInt 对齐。
 */
export function parseNonNegInt(raw: unknown, max: number = MAX_QTY): number | null {
  if (raw == null) return null
  const s = String(raw).trim()
  if (!s) return null
  if (!/^\d+$/.test(s)) return null
  const n = Number.parseInt(s, 10)
  if (Number.isNaN(n) || n < 0 || n > max) return null
  return n
}

/**
 * 非负金额解析：最多两位小数，超过上限返回 null。与云函数 parseNonNegFloat 对齐。
 */
export function parseNonNegFloat(raw: unknown, max: number = MAX_CASH): number | null {
  if (raw == null) return null
  const s = String(raw).trim()
  if (!s) return null
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null
  const n = Number.parseFloat(s)
  if (Number.isNaN(n) || n < 0 || n > max) return null
  return Math.round(n * 100) / 100
}

export function isValidDateYYYYMMDD(s: unknown): s is string {
  if (typeof s !== 'string') return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(s + 'T00:00:00Z')
  return !Number.isNaN(d.getTime())
}
