import type { ShiftConfigListItem } from '@somoke/shared'

/**
 * 班次记账的业务常量与纯函数：与云函数端 ITEM_UNIT_PRICE_JPY 一致。
 * 不依赖 Vue / uni：全部可作为 unit test 直接跑。
 */
export const ITEM_UNIT_PRICE_JPY = 3000

export type LedgerFormFields = {
  qtyOpening: string
  qtyClosing: string
  qtyGift: string
  soldWechat: string
  soldAlipay: string
  soldCash: string
  cashOpening: string
  cashClosing: string
}

export function emptyFormFields(): LedgerFormFields {
  return {
    qtyOpening: '',
    qtyClosing: '',
    qtyGift: '',
    soldWechat: '',
    soldAlipay: '',
    soldCash: '',
    cashOpening: '',
    cashClosing: ''
  }
}

/** 现金字段解析：允许千分位，空或非法返回 null */
export function parseCashInput(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null
  const s = String(raw).trim()
  if (s === '') return null
  const n = Number.parseFloat(s.replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

/** 整数字段解析：空或非法返回 0（用于计算预览，不做表单校验） */
export function parseIntField(raw: unknown): number {
  if (raw === null || raw === undefined || raw === '') return 0
  const n = Number.parseInt(String(raw), 10)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

export interface RequiredValidationResult {
  ok: boolean
  message: string
}

/**
 * 提交前必填校验：上下班数量 / 上下班现金均必填。
 */
export function validateRequiredQtyAndCash(d: LedgerFormFields): RequiredValidationResult {
  const qo = String(d.qtyOpening ?? '').trim()
  const qc = String(d.qtyClosing ?? '').trim()
  if (qo === '') return { ok: false, message: '请填写上班数量' }
  if (qc === '') return { ok: false, message: '请填写下班数量' }
  if (!/^\d+$/.test(qo)) return { ok: false, message: '上班数量须为非负整数' }
  if (!/^\d+$/.test(qc)) return { ok: false, message: '下班数量须为非负整数' }

  const co = parseCashInput(d.cashOpening)
  const cc = parseCashInput(d.cashClosing)
  if (co === null) return { ok: false, message: '请填写上班现金' }
  if (cc === null) return { ok: false, message: '请填写下班现金' }
  return { ok: true, message: '' }
}

export interface SoftWarningContext {
  qtySold: number
  paymentTotal: number
  soldCash: number
  cashOpening: LedgerFormFields['cashOpening']
  cashClosing: LedgerFormFields['cashClosing']
}

export function buildSoftWarnings(ctx: SoftWarningContext): string[] {
  const lines: string[] = []
  const { qtySold, paymentTotal, soldCash, cashOpening, cashClosing } = ctx

  if (qtySold > 0 || paymentTotal > 0) {
    if (qtySold !== paymentTotal) {
      lines.push(`盘点售出 ${qtySold} 件，支付渠道合计 ${paymentTotal} 件，二者不一致请核对。`)
    }
    if (qtySold > 0 && paymentTotal === 0) {
      lines.push('盘点显示有售出，但微信/支付宝/现金售出件数均为 0，请核对。')
    }
    if (paymentTotal > 0 && qtySold === 0) {
      lines.push('支付渠道有售出件数，但盘点售出为 0（上班−下班−赠送），请核对。')
    }
  }

  const co = parseCashInput(cashOpening)
  const cc = parseCashInput(cashClosing)
  if (co !== null && cc !== null) {
    const delta = cc - co
    if (soldCash > 0 && Math.abs(delta) < 1e-6) {
      lines.push('已填现金售出件数，但上下班现金相同，钱箱是否有变化请核对。')
    }
    if (soldCash === 0 && Math.abs(delta) > 0.005) {
      lines.push('上下班现金有差额，但未登记现金售出件数；若有现金收款请补填。')
    }
  }

  return lines
}

export interface PaymentMix {
  showPaymentMix: boolean
  payMixSw: number
  payMixSa: number
  payMixSc: number
  payPctW: number
  payPctA: number
  payPctC: number
}

export function computePaymentMix(wechat: unknown, alipay: unknown, cash: unknown): PaymentMix {
  const w = parseIntField(wechat)
  const a = parseIntField(alipay)
  const c = parseIntField(cash)
  const t = w + a + c
  if (t <= 0) {
    return {
      showPaymentMix: false,
      payMixSw: w,
      payMixSa: a,
      payMixSc: c,
      payPctW: 0,
      payPctA: 0,
      payPctC: 0
    }
  }
  const pw = Math.round((w * 1000) / t) / 10
  const pa = Math.round((a * 1000) / t) / 10
  const pc = Math.round((100 - pw - pa) * 10) / 10
  return {
    showPaymentMix: true,
    payMixSw: w,
    payMixSa: a,
    payMixSc: c,
    payPctW: pw,
    payPctA: pa,
    payPctC: pc
  }
}

export interface LedgerSummary {
  qtySold: number
  paymentSoldTotal: number
  totalRevenueJpy: number
  softWarnings: string[]
  hasSoftWarnings: boolean
  mix: PaymentMix
}

/** 根据表单字段计算预估报告（展示用）。*/
export function computeSummary(d: LedgerFormFields): LedgerSummary {
  const opening = parseIntField(d.qtyOpening)
  const closing = parseIntField(d.qtyClosing)
  const gift = parseIntField(d.qtyGift)
  const qtySold = Math.max(0, opening - closing - gift)

  const sw = parseIntField(d.soldWechat)
  const sa = parseIntField(d.soldAlipay)
  const sc = parseIntField(d.soldCash)
  const paymentTotal = Math.max(0, sw + sa + sc)
  const totalRevenueJpy = paymentTotal * ITEM_UNIT_PRICE_JPY

  const softWarnings = buildSoftWarnings({
    qtySold,
    paymentTotal,
    soldCash: sc,
    cashOpening: d.cashOpening,
    cashClosing: d.cashClosing
  })

  const mix = computePaymentMix(sw, sa, sc)

  return {
    qtySold,
    paymentSoldTotal: paymentTotal,
    totalRevenueJpy,
    softWarnings,
    hasSoftWarnings: softWarnings.length > 0,
    mix
  }
}

/** 从班次配置列表里根据 shift_config_id 找下标；未命中返回 0 */
export function shiftIndexForConfigId(
  shifts: ShiftConfigListItem[] | null | undefined,
  shiftConfigId: number | string | null | undefined
): number {
  if (!Array.isArray(shifts) || shifts.length === 0) return 0
  const target =
    shiftConfigId === null || shiftConfigId === undefined || shiftConfigId === ''
      ? Number.NaN
      : Number.parseInt(String(shiftConfigId), 10)
  if (Number.isNaN(target)) return 0
  for (let i = 0; i < shifts.length; i += 1) {
    if (shifts[i]?.id === target) return i
  }
  return 0
}
