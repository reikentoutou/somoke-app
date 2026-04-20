/**
 * 金额与数量展示工具。不做业务单位换算，直接按传入值格式化。
 */
export function formatCash(n: number | null | undefined, currency = ''): string {
  if (n == null || Number.isNaN(n)) return '—'
  const fixed = (Math.round(n * 100) / 100).toFixed(2)
  const [intPart = '0', decPart = '00'] = fixed.split('.')
  const withComma = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const body = `${withComma}.${decPart}`
  return currency ? `${currency} ${body}` : body
}

export function formatQty(n: number | null | undefined): string {
  if (n == null || Number.isNaN(n)) return '—'
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

export function signed(n: number): string {
  if (n > 0) return `+${n}`
  return String(n)
}
