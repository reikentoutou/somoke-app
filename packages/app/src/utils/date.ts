const pad2 = (n: number): string => (n < 10 ? '0' + n : String(n))

export function formatDate(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

export function formatMonth(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`
}

export function parseDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null
  const d = new Date(s + 'T00:00:00Z')
  return Number.isNaN(d.getTime()) ? null : d
}

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split('-').map(n => Number.parseInt(n, 10))
  if (!y || !m) return month
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`
}

const WEEKDAY_SHORT = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'] as const

/**
 * 返回 YYYY-MM-DD 所在星期的中文短名，非法日期返回空串。
 * 使用本地构造：用户视角里就是本地星期几。
 */
export function getWeekday(dateStr: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return ''
  const [y, m, d] = dateStr.split('-').map(n => Number.parseInt(n, 10))
  if (!y || !m || !d) return ''
  const date = new Date(y, m - 1, d)
  return WEEKDAY_SHORT[date.getDay()] ?? ''
}

/** 获取月份最后一天（day-of-month），非法输入返回 0。 */
export function lastDayOfMonth(ym: string): number {
  const [yStr, mStr] = ym.split('-')
  const y = Number.parseInt(yStr ?? '', 10)
  const m = Number.parseInt(mStr ?? '', 10)
  if (!y || !m || m < 1 || m > 12) return 0
  return new Date(y, m, 0).getDate()
}

/**
 * 返回某 YYYY-MM 月份的 `start`/`end` 边界 YYYY-MM-DD。
 * 非法输入返回空串边界。
 */
export function monthDayBounds(ym: string): { start: string; end: string } {
  const last = lastDayOfMonth(ym)
  if (!last) return { start: '', end: '' }
  const [yStr, mStr] = ym.split('-')
  const y = Number.parseInt(yStr ?? '', 10)
  const m = Number.parseInt(mStr ?? '', 10)
  return {
    start: `${y}-${pad2(m)}-01`,
    end: `${y}-${pad2(m)}-${pad2(last)}`
  }
}
