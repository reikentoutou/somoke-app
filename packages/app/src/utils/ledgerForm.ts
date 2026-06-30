import type { Product, RecordItemInput, ShiftConfigListItem } from '@somoke/shared'

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

export type ProductLedgerFormFields = {
  productId: number
  productName: string
  categoryId: number
  categoryName: string
  unitPrice: number
  currentStock: number
  qtyOpening: string
  qtyClosing: string
  qtyGift: string
  soldWechat: string
  soldAlipay: string
  soldCash: string
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

export function productLineFromProduct(product: Product): ProductLedgerFormFields {
  return {
    productId: product.id,
    productName: product.name,
    categoryId: product.category_id,
    categoryName: product.category_name,
    unitPrice: Number(product.unit_price) || 0,
    currentStock: Number(product.current_stock) || 0,
    qtyOpening: '',
    qtyClosing: '',
    qtyGift: '',
    soldWechat: '',
    soldAlipay: '',
    soldCash: ''
  }
}

export function productLineFromRecordItem(
  item: {
    product_id: number
    product_name: string
    category_id: number
    category_name: string
    unit_price: number
    qty_opening: number
    qty_closing: number
    qty_gift: number
    sold_wechat: number
    sold_alipay: number
    sold_cash: number
  },
  currentStock = 0
): ProductLedgerFormFields {
  const n = (v: number | null | undefined): string =>
    v === null || v === undefined ? '' : String(v)
  return {
    productId: Number(item.product_id) || 0,
    productName: item.product_name || '商品',
    categoryId: Number(item.category_id) || 0,
    categoryName: item.category_name || '',
    unitPrice: Number(item.unit_price) || 0,
    currentStock,
    qtyOpening: n(item.qty_opening),
    qtyClosing: n(item.qty_closing),
    qtyGift: n(item.qty_gift),
    soldWechat: n(item.sold_wechat),
    soldAlipay: n(item.sold_alipay),
    soldCash: n(item.sold_cash)
  }
}

export function buildRecordItemPayload(line: ProductLedgerFormFields): RecordItemInput {
  return {
    product_id: line.productId,
    qty_opening: parseIntField(line.qtyOpening),
    qty_closing: parseIntField(line.qtyClosing),
    qty_gift: parseIntField(line.qtyGift),
    sold_wechat: parseIntField(line.soldWechat),
    sold_alipay: parseIntField(line.soldAlipay),
    sold_cash: parseIntField(line.soldCash)
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

export interface ProductLineValidationOptions {
  enforceCurrentStock?: boolean
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

export function validateProductLinesAndCash(
  lines: ProductLedgerFormFields[],
  d: Pick<LedgerFormFields, 'cashOpening' | 'cashClosing'>,
  options: ProductLineValidationOptions = {}
): RequiredValidationResult {
  if (!Array.isArray(lines) || lines.length === 0) {
    return { ok: false, message: '请先配置商品' }
  }
  for (const line of lines) {
    const qo = String(line.qtyOpening ?? '').trim()
    const qc = String(line.qtyClosing ?? '').trim()
    if (qo === '' && qc === '') continue
    if (qo === '') return { ok: false, message: `请填写「${line.productName}」上班数量` }
    if (qc === '') return { ok: false, message: `请填写「${line.productName}」下班数量` }
    if (!/^\d+$/.test(qo))
      return { ok: false, message: `「${line.productName}」上班数量须为非负整数` }
    if (!/^\d+$/.test(qc))
      return { ok: false, message: `「${line.productName}」下班数量须为非负整数` }
  }

  const used = lines.some(line =>
    [
      line.qtyOpening,
      line.qtyClosing,
      line.qtyGift,
      line.soldWechat,
      line.soldAlipay,
      line.soldCash
    ].some(v => String(v ?? '').trim() !== '')
  )
  if (!used) return { ok: false, message: '请至少录入一个商品' }
  if (options.enforceCurrentStock) {
    const stockCheck = validateProductStockAvailability(lines)
    if (!stockCheck.ok) return stockCheck
  }

  const co = parseCashInput(d.cashOpening)
  const cc = parseCashInput(d.cashClosing)
  if (co === null) return { ok: false, message: '请填写上班现金' }
  if (cc === null) return { ok: false, message: '请填写下班现金' }
  return { ok: true, message: '' }
}

export function stockDeductFromLine(line: ProductLedgerFormFields): number {
  const opening = parseIntField(line.qtyOpening)
  const closing = parseIntField(line.qtyClosing)
  const gift = parseIntField(line.qtyGift)
  const qtySold = Math.max(0, opening - closing - gift)
  const paymentQty =
    parseIntField(line.soldWechat) + parseIntField(line.soldAlipay) + parseIntField(line.soldCash)
  return Math.max(qtySold, paymentQty) + gift
}

export function validateProductStockAvailability(
  lines: ProductLedgerFormFields[]
): RequiredValidationResult {
  for (const line of lines) {
    const deduct = stockDeductFromLine(line)
    const available = Math.max(0, Number(line.currentStock) || 0)
    if (deduct > available) {
      return {
        ok: false,
        message: `「${line.productName}」库存不足，请先补货或校准库存`
      }
    }
  }
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
  productRows: ProductSummaryRow[]
}

export interface ProductSummaryRow {
  productId: number
  productName: string
  categoryName: string
  qtySold: number
  paymentSoldTotal: number
  totalRevenueJpy: number
  softWarnings: string[]
}

/** 根据表单字段计算预估报告（展示用）。*/
export function computeSummary(
  d: LedgerFormFields,
  productLines: ProductLedgerFormFields[] = []
): LedgerSummary {
  if (productLines.length) {
    const rows = productLines.map(line => {
      const opening = parseIntField(line.qtyOpening)
      const closing = parseIntField(line.qtyClosing)
      const gift = parseIntField(line.qtyGift)
      const qtySold = Math.max(0, opening - closing - gift)
      const sw = parseIntField(line.soldWechat)
      const sa = parseIntField(line.soldAlipay)
      const sc = parseIntField(line.soldCash)
      const paymentSoldTotal = Math.max(0, sw + sa + sc)
      const totalRevenueJpy = paymentSoldTotal * (Number(line.unitPrice) || 0)
      return {
        productId: line.productId,
        productName: line.productName,
        categoryName: line.categoryName,
        qtySold,
        paymentSoldTotal,
        totalRevenueJpy,
        softWarnings: []
      }
    })
    const totals = rows.reduce(
      (acc, row) => {
        acc.qtySold += row.qtySold
        acc.paymentSoldTotal += row.paymentSoldTotal
        acc.totalRevenueJpy += row.totalRevenueJpy
        return acc
      },
      { qtySold: 0, paymentSoldTotal: 0, totalRevenueJpy: 0 }
    )
    const totalWechat = productLines.reduce((sum, line) => sum + parseIntField(line.soldWechat), 0)
    const totalAlipay = productLines.reduce((sum, line) => sum + parseIntField(line.soldAlipay), 0)
    const totalCash = productLines.reduce((sum, line) => sum + parseIntField(line.soldCash), 0)
    const mix = computePaymentMix(totalWechat, totalAlipay, totalCash)
    const softWarnings = buildSoftWarnings({
      qtySold: totals.qtySold,
      paymentTotal: totals.paymentSoldTotal,
      soldCash: totalCash,
      cashOpening: d.cashOpening,
      cashClosing: d.cashClosing
    })
    return {
      qtySold: totals.qtySold,
      paymentSoldTotal: totals.paymentSoldTotal,
      totalRevenueJpy: totals.totalRevenueJpy,
      softWarnings,
      hasSoftWarnings: softWarnings.length > 0,
      mix,
      productRows: rows
    }
  }

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
    mix,
    productRows: []
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
