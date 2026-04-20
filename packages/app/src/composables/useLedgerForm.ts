import { computed, reactive, ref } from 'vue'
import type { AddRecordReq, ShiftRecord, UpdateRecordReq } from '@somoke/shared'
import {
  computeSummary,
  emptyFormFields,
  ITEM_UNIT_PRICE_JPY,
  parseCashInput,
  shiftIndexForConfigId,
  type LedgerFormFields,
  type LedgerSummary
} from '@/utils/ledgerForm'

export type LedgerFormMode = 'create' | 'edit'

export interface LedgerFormState {
  mode: LedgerFormMode
  editRecordId: number
  recordDate: string
  shiftConfigId: number | null
  recorderName: string
  fields: LedgerFormFields
  /** 已根据当前库存/现金预填过一次上班数据 */
  openingPrefilled: boolean
}

function today(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * 录入表单状态：fields 是字符串态（利于保留空白与过程态），
 * 派生 summary 走 `computed`，提交 payload 通过 `buildPayload()` 一次性换算。
 *
 * 用 `reactive` 而非多个 `ref`：字段全都是整体属于同一个表单实体，
 * 调用方大量按属性赋值，不会出现"整体替换"场景。
 */
export function useLedgerForm() {
  const state = reactive<LedgerFormState>({
    mode: 'create',
    editRecordId: 0,
    recordDate: today(),
    shiftConfigId: null,
    recorderName: '',
    fields: emptyFormFields(),
    openingPrefilled: false
  })

  // prefill 记忆：用户未改过的情况下，下次刷新可覆盖；一旦手动改过就锁住
  const lastPrefilledQty = ref<string | null>(null)
  const lastPrefilledCash = ref<string | null>(null)

  const summary = computed<LedgerSummary>(() => computeSummary(state.fields))

  const isDateToday = computed(() => state.recordDate === today())

  function resetToCreate(keepDate = false): void {
    state.mode = 'create'
    state.editRecordId = 0
    state.shiftConfigId = null
    state.openingPrefilled = false
    state.fields = emptyFormFields()
    if (!keepDate) state.recordDate = today()
    lastPrefilledQty.value = null
    lastPrefilledCash.value = null
  }

  function fillFromRecord(record: ShiftRecord, activeShiftIds: number[] = []): void {
    state.mode = 'edit'
    state.editRecordId = Number(record.id) || 0
    state.recordDate = record.record_date || today()

    // 后端可能返回已禁用/已删除的班次 id，此时退回当前可选的第一个
    const stillActive = activeShiftIds.includes(record.shift_config_id)
    state.shiftConfigId = stillActive ? record.shift_config_id : (activeShiftIds[0] ?? null)

    state.recorderName = record.recorder_name || ''

    const n = (v: number | null | undefined): string =>
      v === null || v === undefined ? '' : String(v)

    state.fields = {
      qtyOpening: n(record.qty_opening),
      qtyClosing: n(record.qty_closing),
      qtyGift: n(record.qty_gift),
      soldWechat: n(record.sold_wechat),
      soldAlipay: n(record.sold_alipay),
      soldCash: n(record.sold_cash),
      cashOpening: n(record.cash_opening),
      cashClosing: n(record.cash_closing)
    }
    state.openingPrefilled = false
    // 编辑态不再接受 prefill，置空即可
    lastPrefilledQty.value = null
    lastPrefilledCash.value = null
  }

  /**
   * 将上班数量/现金预填为当前库存/现金。
   * 仅当字段为空或仍等于上一次预填值（即用户未动）时才覆盖。
   * 编辑态不走此路径。
   */
  function applyOpeningPrefill(stock: number, cash: number): void {
    if (state.mode !== 'create') return
    const nextQty = String(stock)
    const nextCash = String(cash)
    let changed = false

    if (state.fields.qtyOpening === '' || state.fields.qtyOpening === lastPrefilledQty.value) {
      state.fields.qtyOpening = nextQty
      lastPrefilledQty.value = nextQty
      changed = true
    }
    if (state.fields.cashOpening === '' || state.fields.cashOpening === lastPrefilledCash.value) {
      state.fields.cashOpening = nextCash
      lastPrefilledCash.value = nextCash
      changed = true
    }
    if (changed) state.openingPrefilled = true
  }

  /** 用户手动修改某字段 → 如果改动等于上次 prefill 值则维持锁，不等则解除 */
  function markManualEdit(field: keyof LedgerFormFields, value: string): void {
    if (field === 'qtyOpening' && value !== lastPrefilledQty.value) {
      lastPrefilledQty.value = null
    }
    if (field === 'cashOpening' && value !== lastPrefilledCash.value) {
      lastPrefilledCash.value = null
    }
    state.fields[field] = value
  }

  /** 根据 shiftConfigId 同步下标（picker 需要） */
  function indexOfShift(activeShifts: { id: number }[]): number {
    return shiftIndexForConfigId(
      activeShifts.map(s => ({ id: s.id }) as never),
      state.shiftConfigId
    )
  }

  function selectShiftByIndex(activeShifts: { id: number }[], index: number): void {
    const safeIdx = Math.max(0, Math.min(index, activeShifts.length - 1))
    const hit = activeShifts[safeIdx]
    state.shiftConfigId = hit ? hit.id : null
  }

  function buildAddPayload(): Omit<AddRecordReq, keyof { token?: string }> {
    return {
      record_date: state.recordDate,
      shift_config_id: state.shiftConfigId ?? 0,
      recorder_name: state.recorderName,
      qty_opening: toInt(state.fields.qtyOpening),
      qty_closing: toInt(state.fields.qtyClosing),
      qty_gift: toInt(state.fields.qtyGift),
      sold_wechat: toInt(state.fields.soldWechat),
      sold_alipay: toInt(state.fields.soldAlipay),
      sold_cash: toInt(state.fields.soldCash),
      cash_opening: toFloat(state.fields.cashOpening),
      cash_closing: toFloat(state.fields.cashClosing)
    }
  }

  function buildUpdatePayload(): Omit<UpdateRecordReq, keyof { token?: string }> {
    // 后端 handleUpdateRecord 把 record_date / shift_config_id / 8 项数值
    // 都视为必填，缺任一都会 400。这里一次性全量传出，不做"差量更新"。
    return {
      id: state.editRecordId,
      record_date: state.recordDate,
      shift_config_id: state.shiftConfigId ?? 0,
      recorder_name: state.recorderName,
      qty_opening: toInt(state.fields.qtyOpening),
      qty_closing: toInt(state.fields.qtyClosing),
      qty_gift: toInt(state.fields.qtyGift),
      sold_wechat: toInt(state.fields.soldWechat),
      sold_alipay: toInt(state.fields.soldAlipay),
      sold_cash: toInt(state.fields.soldCash),
      cash_opening: toFloat(state.fields.cashOpening),
      cash_closing: toFloat(state.fields.cashClosing)
    }
  }

  return {
    state,
    summary,
    isDateToday,
    ITEM_UNIT_PRICE_JPY,

    resetToCreate,
    fillFromRecord,
    applyOpeningPrefill,
    markManualEdit,
    indexOfShift,
    selectShiftByIndex,

    buildAddPayload,
    buildUpdatePayload
  }
}

function toInt(s: string): number {
  const n = Number.parseInt(String(s), 10)
  return Number.isFinite(n) && n >= 0 ? n : 0
}
function toFloat(s: string): number {
  const n = parseCashInput(s)
  return n === null ? 0 : n
}
