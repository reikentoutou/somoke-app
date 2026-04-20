import type { ShiftRecord, UserInfo } from '@somoke/shared'
import { formatCash, formatQty } from './money'
import { getWeekday } from './date'

/**
 * shift-detail 页的纯函数：数据映射 & 权限判断。
 * - Vue 组件只承担 UI 渲染，数据决策全部收敛到这里。
 */

export interface ShiftDetailView {
  shiftName: string
  recordDateDisplay: string
  recorderName: string
  recorderInitial: string
  qtySoldFormatted: string
  qtyOpeningFormatted: string
  qtyClosingFormatted: string
  qtyGiftFormatted: string
  soldWechat: number
  soldAlipay: number
  soldCash: number
  wechatAmountStr: string
  alipayAmountStr: string
  cashAmountStr: string
  cashOpeningStr: string
  cashClosingStr: string
  unitPrice: number
}

export const emptyShiftDetailView = (): ShiftDetailView => ({
  shiftName: '—',
  recordDateDisplay: '—',
  recorderName: '—',
  recorderInitial: '',
  qtySoldFormatted: '0',
  qtyOpeningFormatted: '0',
  qtyClosingFormatted: '0',
  qtyGiftFormatted: '0',
  soldWechat: 0,
  soldAlipay: 0,
  soldCash: 0,
  wechatAmountStr: '0.00',
  alipayAmountStr: '0.00',
  cashAmountStr: '0.00',
  cashOpeningStr: '0.00',
  cashClosingStr: '0.00',
  unitPrice: 0
})

/** 首字母用于圆形头像；trim 后空串返回 ''。 */
export function recorderInitial(name: string | undefined | null): string {
  const s = (name ?? '').trim()
  return s ? s.charAt(0) : ''
}

/** API 行 → 展示视图。输入 null/undefined 返回 empty。 */
export function mapRecordToDetailView(row: ShiftRecord | null | undefined): ShiftDetailView {
  if (!row) return emptyShiftDetailView()
  const up = Number(row.unit_price) || 0
  const w = Number(row.sold_wechat) || 0
  const a = Number(row.sold_alipay) || 0
  const c = Number(row.sold_cash) || 0
  const date = row.record_date || ''
  const recordDateDisplay = /^\d{4}-\d{2}-\d{2}$/.test(date)
    ? `${date} ${getWeekday(date)}`.trim()
    : date || '—'

  return {
    shiftName: row.shift_name || '班次记录',
    recordDateDisplay,
    recorderName: row.recorder_name || '—',
    recorderInitial: recorderInitial(row.recorder_name),
    qtySoldFormatted: formatQty(Number(row.qty_sold) || 0),
    qtyOpeningFormatted: formatQty(Number(row.qty_opening) || 0),
    qtyClosingFormatted: formatQty(Number(row.qty_closing) || 0),
    qtyGiftFormatted: formatQty(Number(row.qty_gift) || 0),
    soldWechat: w,
    soldAlipay: a,
    soldCash: c,
    wechatAmountStr: formatCash(w * up),
    alipayAmountStr: formatCash(a * up),
    cashAmountStr: formatCash(c * up),
    cashOpeningStr: formatCash(Number(row.cash_opening) || 0),
    cashClosingStr: formatCash(Number(row.cash_closing) || 0),
    unitPrice: up
  }
}

/**
 * 是否允许编辑本条记录：
 * - 当前门店店长：始终可编辑；
 * - 否则必须是记录人本人（recorder_id 匹配当前 user_info.id）。
 */
export function canEditRecord(
  row: Pick<ShiftRecord, 'recorder_id'> | null | undefined,
  user: UserInfo | null | undefined,
  isBoss: boolean
): boolean {
  if (!row || !user) return false
  if (isBoss) return true
  const myId = Number(user.id) || 0
  const rid = Number(row.recorder_id) || 0
  return myId > 0 && rid > 0 && myId === rid
}
