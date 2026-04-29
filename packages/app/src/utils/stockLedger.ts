import type { LedgerEntry, LedgerEventType } from '@somoke/shared'

/**
 * stock-ledger 页的纯函数域：
 * - 类目分类（tab 过滤）；
 * - LedgerEntry → 展示视图（徽章 / 颜色 / delta 符号 / 班次 chip）；
 * - 这些决策全部收敛在这里，UI 只 renderer。
 */

export type LedgerCategory = 'all' | 'record' | 'restock' | 'withdraw' | 'adjust'

export interface CategoryTab {
  key: LedgerCategory
  label: string
}

export const CATEGORY_TABS: readonly CategoryTab[] = [
  { key: 'all', label: '全部' },
  { key: 'record', label: '班次记账' },
  { key: 'restock', label: '进货' },
  { key: 'withdraw', label: '取现' },
  { key: 'adjust', label: '校准' }
] as const

export type BadgeTone = 'record' | 'restock' | 'withdraw' | 'adjust' | 'neutral'

interface EventMeta {
  category: Exclude<LedgerCategory, 'all'>
  label: string
  tone: BadgeTone
  initial: string
}

const EVENT_META: Record<LedgerEventType, EventMeta> = {
  restock: { category: 'restock', label: '进货', tone: 'restock', initial: '进' },
  withdraw: { category: 'withdraw', label: '取现', tone: 'withdraw', initial: '取' },
  adjust_stock: { category: 'adjust', label: '库存校准', tone: 'adjust', initial: '校' },
  adjust_cash: { category: 'adjust', label: '现金校准', tone: 'adjust', initial: '校' },
  record_add: { category: 'record', label: '班次记账', tone: 'record', initial: '记' },
  record_update: { category: 'record', label: '修改记账', tone: 'record', initial: '改' },
  record_delete: { category: 'record', label: '删除记账', tone: 'record', initial: '删' }
}

const DEFAULT_META: EventMeta = {
  category: 'record',
  label: '变动',
  tone: 'neutral',
  initial: '·'
}

export interface LedgerViewItem {
  id: number
  category: Exclude<LedgerCategory, 'all'>
  typeLabel: string
  tone: BadgeTone
  initial: string
  hasStock: boolean
  hasCash: boolean
  delta: number
  cashDelta: number
  balanceAfter: number
  cashBalanceAfter: number
  stockDeltaDisplay: string
  cashDeltaDisplay: string
  timeDisplay: string
  shiftChip: string
  recorderName: string
  operatorName: string
  note: string
}

const signed = (n: number): string => (n > 0 ? `+${n}` : String(n))

/** 班次 chip：`04-20 · 早班`，两段都没有则返回空串。 */
function buildShiftChip(shiftDate: string, shiftName: string): string {
  if (shiftDate && shiftName) return `${shiftDate.slice(5)} · ${shiftName}`
  if (shiftDate) return shiftDate.slice(5)
  if (shiftName) return shiftName
  return ''
}

/** LedgerEntry 装饰为展示视图。 */
export function decorateLedgerEntry(row: LedgerEntry): LedgerViewItem {
  const meta = EVENT_META[row.event_type] ?? DEFAULT_META
  const delta = Number(row.delta) || 0
  const cashDelta = Number(row.cash_delta) || 0
  return {
    id: row.id,
    category: meta.category,
    typeLabel: meta.label,
    tone: meta.tone,
    initial: meta.initial,
    hasStock: delta !== 0 || row.event_type === 'adjust_stock',
    hasCash: cashDelta !== 0 || row.event_type === 'adjust_cash',
    delta,
    cashDelta,
    balanceAfter: Number(row.balance_after) || 0,
    cashBalanceAfter: Number(row.cash_balance_after) || 0,
    stockDeltaDisplay: signed(delta),
    cashDeltaDisplay: signed(cashDelta),
    timeDisplay: row.time_display || '—',
    shiftChip: buildShiftChip(row.shift_date || '', row.shift_name || ''),
    recorderName: row.recorder_name || '',
    operatorName: row.operator_name || '',
    note: row.note || ''
  }
}

export function filterByCategory(
  items: LedgerViewItem[],
  category: LedgerCategory
): LedgerViewItem[] {
  if (category === 'all') return items
  return items.filter(it => it.category === category)
}

/* ------------------------- Action modal ------------------------- */

export type OpsActionKey = 'restock' | 'withdraw' | 'adjust_stock' | 'adjust_cash'

export interface ActionConfig {
  title: string
  sub: string
  /** 展示哪种输入：件数 or 金额 */
  inputType: 'stock' | 'cash'
  inputLabel: string
  placeholder: string
  /** 校验失败时的 toast 文案 */
  invalidMessage: string
  /** 是否要求 > 0；校准类允许 0 */
  requirePositive: boolean
}

export const ACTION_CONFIG: Record<OpsActionKey, ActionConfig> = {
  restock: {
    title: '进货入库',
    sub: '进货款走店外资金，不影响门店现金',
    inputType: 'stock',
    inputLabel: '进货数量（件）',
    placeholder: '请输入数量',
    invalidMessage: '请输入有效进货数量',
    requirePositive: true
  },
  withdraw: {
    title: '取现',
    sub: '从门店现金转出，库存不变',
    inputType: 'cash',
    inputLabel: '取现金额（円）',
    placeholder: '请输入取现金额',
    invalidMessage: '请输入有效取现金额',
    requirePositive: true
  },
  adjust_stock: {
    title: '库存校准',
    sub: '用实盘数覆盖当前库存',
    inputType: 'stock',
    inputLabel: '实盘库存（件）',
    placeholder: '请输入实盘件数',
    invalidMessage: '请输入有效实盘库存',
    requirePositive: false
  },
  adjust_cash: {
    title: '现金校准',
    sub: '用实盘数覆盖当前现金',
    inputType: 'cash',
    inputLabel: '实盘现金（円）',
    placeholder: '请输入实盘现金',
    invalidMessage: '请输入有效实盘现金',
    requirePositive: false
  }
}

export interface ValidatedActionPayload {
  ok: boolean
  message?: string
  val_stock?: number
  val_cash?: number
}

/**
 * Action modal 表单校验，返回将要发给 opsAction 的数值。
 * - stock 类：整数、> 0 或 >= 0（取决于 requirePositive）
 * - cash  类：允许小数；requirePositive 同理
 */
export function validateActionPayload(
  action: OpsActionKey,
  raw: { val_stock: string; val_cash: string }
): ValidatedActionPayload {
  const cfg = ACTION_CONFIG[action]
  if (cfg.inputType === 'stock') {
    const n = Number.parseInt((raw.val_stock ?? '').trim(), 10)
    if (!Number.isFinite(n)) return { ok: false, message: cfg.invalidMessage }
    if (cfg.requirePositive ? n <= 0 : n < 0) {
      return { ok: false, message: cfg.invalidMessage }
    }
    return { ok: true, val_stock: n }
  }
  const f = Number.parseFloat((raw.val_cash ?? '').trim())
  if (!Number.isFinite(f)) return { ok: false, message: cfg.invalidMessage }
  if (cfg.requirePositive ? f <= 0 : f < 0) {
    return { ok: false, message: cfg.invalidMessage }
  }
  return { ok: true, val_cash: f }
}
