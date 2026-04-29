<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import type { AddRecordRes, ShiftRecord, UpdateRecordRes } from '@somoke/shared'
import { rpc } from '@/api/client'
import { useLedgerDependencies } from '@/composables/useLedgerDependencies'
import { useLedgerForm } from '@/composables/useLedgerForm'
import { useSubmitLock } from '@/composables/useSubmitLock'
import { validateRequiredQtyAndCash } from '@/utils/ledgerForm'

import LedgerCalibrationBanner from './LedgerCalibrationBanner.vue'
import LedgerMetaRow from './LedgerMetaRow.vue'
import LedgerRecorderPicker from './LedgerRecorderPicker.vue'
import LedgerOpeningClosingCard from './LedgerOpeningClosingCard.vue'
import LedgerPaymentBreakdown from './LedgerPaymentBreakdown.vue'
import LedgerSummaryCard from './LedgerSummaryCard.vue'

/**
 * 云函数调用固定经由此引用；勿与上方 `import { rpc }` 在压缩后共用一个短名（如 `r`），
 * 否则会与 `new Promise(r => …)` / 模态结果变量撞名，运行时报 `Cannot read property 'rpc' of undefined`。
 */
const invokeCloudRpc = rpc

/**
 * 录入/修改记账的容器组件。
 * - 组合 `useLedgerForm`（表单状态）+ `useLedgerDependencies`（依赖异步）。
 * - 自身不持有字段级状态；子组件只做纯 UI。
 * - props.mode 驱动初始化；edit 态须同时传 props.record。
 * - 成功提交后统一 emit `submit-success`，由父页面决定后续（跳转 / 刷新 / toast）。
 */

type Mode = 'create' | 'edit'

interface Props {
  mode?: Mode
  /** edit 态必传；create 态忽略 */
  record?: ShiftRecord | null
}
const props = withDefaults(defineProps<Props>(), {
  mode: 'create',
  record: null
})

interface SubmitPayload {
  mode: Mode
  data: AddRecordRes | UpdateRecordRes
}

const emit = defineEmits<{
  (e: 'submit-success', payload: SubmitPayload): void
  (e: 'submit-error', err: Error): void
}>()

// composable 返回的是"refs + 方法"的聚合对象；展开到顶层后，模板里直接写
// `:shifts="activeShifts"` 即可享受 Vue 的 ref 自动解包，不再出现 `.value`。
// 嵌套访问（deps.activeShifts）在模板里不会自动解包，历史上写 `.value`
// 是在绕过这一限制，但会让"哪里该 .value / 哪里不该"变成心智负担。
const {
  activeShifts,
  recorderList,
  selectedRecorder,
  currentStock,
  currentCash,
  initialZero,
  persistRecorderChoice,
  reloadAll,
  reloadBalances
} = useLedgerDependencies()

const {
  state,
  summary,
  isDateToday,
  ITEM_UNIT_PRICE_JPY,
  resetToCreate,
  fillFromRecord,
  applyOpeningPrefill,
  markManualEdit,
  buildAddPayload,
  buildUpdatePayload
} = useLedgerForm()

const { running: submitting, guard: submitGuard } = useSubmitLock()

// 把 composable 里的 selectedRecorder 同步到 state.recorderName（双向保持）
watch(selectedRecorder, v => {
  if (v && v !== state.recorderName) state.recorderName = v
})
watch(
  () => state.recorderName,
  v => {
    if (v && v !== selectedRecorder.value) selectedRecorder.value = v
    if (v) persistRecorderChoice(v)
  }
)

const isCreate = computed(() => state.mode === 'create')
const isEdit = computed(() => state.mode === 'edit')

/** 日期非今日：仅在新建态出现 info banner */
const dateOffsetHint = computed(() => isCreate.value && !isDateToday.value && !!state.recordDate)

/** 当前库存/现金均为 0：新建态出现 warn banner */
const showZeroBanner = computed(() => isCreate.value && initialZero.value)

const qtyPrefillHint = computed(() =>
  isCreate.value && state.openingPrefilled
    ? `已按当前库存预填上班数量（${currentStock.value}），如有变化可直接修改`
    : ''
)
const cashPrefillHint = computed(() =>
  isCreate.value && state.openingPrefilled
    ? `已按当前现金预填上班现金（¥${currentCash.value}），如有变化可直接修改`
    : ''
)

const submitBtnText = computed(() => {
  if (submitting.value) return isEdit.value ? '保存中…' : '提交中…'
  return isEdit.value ? '保存修改' : '确认提交数据'
})

onMounted(async () => {
  try {
    await reloadAll({ ensureRecorderName: props.record?.recorder_name ?? null })
  } catch {
    uni.showToast({ title: '页面数据加载失败', icon: 'none' })
    return
  }

  if (props.mode === 'edit' && props.record) {
    const activeIds = activeShifts.value.map(s => s.id)
    fillFromRecord(props.record, activeIds)
    if (selectedRecorder.value !== props.record.recorder_name) {
      selectedRecorder.value = props.record.recorder_name
    }
  } else {
    if (state.shiftConfigId == null && activeShifts.value.length) {
      state.shiftConfigId = activeShifts.value[0]!.id
    }
    applyOpeningPrefill(currentStock.value, currentCash.value)
    state.recorderName = selectedRecorder.value
  }
})

function goCalibration() {
  uni.navigateTo({ url: '/pages/stock-ledger/index' })
}

function onFieldsManualEdit(
  field:
    | 'qtyOpening'
    | 'qtyClosing'
    | 'qtyGift'
    | 'soldWechat'
    | 'soldAlipay'
    | 'soldCash'
    | 'cashOpening'
    | 'cashClosing',
  value: string
) {
  markManualEdit(field, value)
}

async function confirmAndSubmit(): Promise<void> {
  if (!state.recordDate) {
    uni.showToast({ title: '请选择日期', icon: 'none' })
    return
  }
  if (!activeShifts.value.length || !state.shiftConfigId) {
    uni.showToast({ title: '班次配置加载中，请稍候', icon: 'none' })
    return
  }
  if (!state.recorderName.trim()) {
    uni.showToast({ title: '请选择记账姓名', icon: 'none' })
    return
  }
  const required = validateRequiredQtyAndCash(state.fields)
  if (!required.ok) {
    uni.showToast({ title: required.message, icon: 'none' })
    return
  }

  const softWarns = summary.value.softWarnings
  if (softWarns.length > 0) {
    const ok = await new Promise<boolean>(resolveSoftWarn => {
      uni.showModal({
        title: '数据核对提醒',
        content: softWarns.join('\n\n'),
        confirmText: isEdit.value ? '仍要保存' : '仍要提交',
        cancelText: '返回修改',
        success: res => resolveSoftWarn(!!res.confirm),
        fail: () => resolveSoftWarn(false)
      })
    })
    if (!ok) return
  }

  if (showZeroBanner.value) {
    const choice = await new Promise<'submit' | 'calibrate' | 'cancel'>(resolveZeroBanner => {
      uni.showModal({
        title: '门店尚未校准',
        content:
          '当前库存与现金均为 0，是否属实？\n如为首次使用或未校准，建议先到「库存与现金」校准后再录入，提交后将按 0 扣减。',
        confirmText: '仍要提交',
        cancelText: '先去校准',
        success: res => {
          if (res.confirm) resolveZeroBanner('submit')
          else if (res.cancel) resolveZeroBanner('calibrate')
          else resolveZeroBanner('cancel')
        },
        fail: () => resolveZeroBanner('cancel')
      })
    })
    if (choice === 'calibrate') {
      goCalibration()
      return
    }
    if (choice !== 'submit') return
  }

  await doSubmit()
}

async function doSubmit(): Promise<void> {
  await submitGuard(async () => {
    try {
      if (isEdit.value) {
        const payload = buildUpdatePayload()
        const res = await invokeCloudRpc('updateRecord', payload)
        uni.showToast({ title: '已保存修改', icon: 'success', duration: 2200 })
        emit('submit-success', { mode: 'edit', data: res })
      } else {
        const payload = buildAddPayload()
        const res = await invokeCloudRpc('addRecord', payload)
        const deduct = res.stock_deduct ?? 0
        const msg =
          deduct > 0 && res.current_stock != null
            ? `提交成功（库存−${deduct}，剩余 ${res.current_stock}）`
            : '提交成功'
        uni.showToast({ title: msg, icon: 'success', duration: 2600 })
        // 新增后重置为新的空表单 + 重新 prefill（云端副作用会刷新缓存）
        resetToCreate()
        await reloadBalances()
        applyOpeningPrefill(currentStock.value, currentCash.value)
        if (activeShifts.value.length && state.shiftConfigId == null) {
          state.shiftConfigId = activeShifts.value[0]!.id
        }
        state.recorderName = selectedRecorder.value
        emit('submit-success', { mode: 'create', data: res })
      }
    } catch (submitErr) {
      const e =
        submitErr instanceof Error ? submitErr : new Error('提交失败，请重试')
      uni.showToast({ title: e.message, icon: 'none' })
      emit('submit-error', e)
    }
  })
}

/** 父页面可通过 ref 重置到新建态（如 entry 页 cancelEdit 场景） */
defineExpose({
  resetToCreate: () => {
    resetToCreate()
    applyOpeningPrefill(currentStock.value, currentCash.value)
  },
  reloadDeps: () => reloadAll()
})
</script>

<template>
  <view class="lrf">
    <LedgerCalibrationBanner v-if="showZeroBanner" kind="zero" @action="goCalibration" />
    <LedgerCalibrationBanner v-else-if="dateOffsetHint" kind="date-offset" />

    <LedgerMetaRow
      v-model:recordDate="state.recordDate"
      v-model:shiftConfigId="state.shiftConfigId"
      :shifts="activeShifts"
    />

    <LedgerRecorderPicker v-model="state.recorderName" :names="recorderList" />

    <LedgerOpeningClosingCard
      variant="qty"
      :opening-prefill-hint="qtyPrefillHint"
      :opening-value="state.fields.qtyOpening"
      :closing-value="state.fields.qtyClosing"
      @update:openingValue="onFieldsManualEdit('qtyOpening', $event)"
      @update:closingValue="onFieldsManualEdit('qtyClosing', $event)"
    />

    <LedgerOpeningClosingCard
      variant="cash"
      :opening-prefill-hint="cashPrefillHint"
      :opening-value="state.fields.cashOpening"
      :closing-value="state.fields.cashClosing"
      @update:openingValue="onFieldsManualEdit('cashOpening', $event)"
      @update:closingValue="onFieldsManualEdit('cashClosing', $event)"
    />

    <LedgerPaymentBreakdown
      v-model:soldWechat="state.fields.soldWechat"
      v-model:soldAlipay="state.fields.soldAlipay"
      v-model:soldCash="state.fields.soldCash"
      v-model:qtyGift="state.fields.qtyGift"
    />

    <LedgerSummaryCard :summary="summary" :unit-price="ITEM_UNIT_PRICE_JPY" />

    <view class="submit-btn" :class="{ disabled: submitting }" @tap="confirmAndSubmit">
      <text>{{ submitBtnText }}</text>
      <text class="arrow">→</text>
    </view>
  </view>
</template>

<style scoped>
.lrf {
  padding: 24rpx;
  display: flex;
  flex-direction: column;
}
.submit-btn {
  margin-top: 48rpx;
  background: #1a1c1d;
  color: #fff;
  padding: 28rpx;
  border-radius: 20rpx;
  font-size: 32rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
}
.submit-btn.disabled {
  opacity: 0.6;
}
.arrow {
  font-size: 28rpx;
}
</style>
