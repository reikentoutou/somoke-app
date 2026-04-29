<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import type { ShiftRecord } from '@somoke/shared'
import { deleteRecord, getRecord, getRecords } from '@/api/endpoints/record'
import { useSession } from '@/composables/useSession'
import { useAuthStore } from '@/stores/auth'
import { useShiftConfigsStore } from '@/stores/shiftConfigs'
import { formatDate } from '@/utils/date'
import { canEditRecord, emptyShiftDetailView, mapRecordToDetailView } from '@/utils/shiftDetail'

import LedgerRecordForm from '@/components/ledger/LedgerRecordForm.vue'
import ShiftDetailHeader from '@/components/shift-detail/ShiftDetailHeader.vue'
import ShiftDetailHero from '@/components/shift-detail/ShiftDetailHero.vue'
import ShiftDetailMetrics from '@/components/shift-detail/ShiftDetailMetrics.vue'
import ShiftDetailPayments from '@/components/shift-detail/ShiftDetailPayments.vue'
import ShiftDetailCash from '@/components/shift-detail/ShiftDetailCash.vue'

/**
 * 班次明细：
 * - 默认展示态：拉取单条记录（failing-over 到当日列表）并 map 成展示视图。
 * - 编辑态：复用 LedgerRecordForm（edit mode），成功后回到展示态并重新拉取。
 * - 权限：当前门店店长 / 记录人本人才可编辑（utils/shiftDetail.canEditRecord）。
 */

const session = useSession()
const auth = useAuthStore()
const shiftConfigs = useShiftConfigsStore()

const recordId = ref<number>(0)
const recordDate = ref<string>('')
const raw = shallowRef<ShiftRecord | null>(null)
const view = ref(emptyShiftDetailView())
const canEdit = ref(false)
const canDelete = ref(false)
const editing = ref(false)

const parseId = (v: unknown): number => {
  if (v === null || v === undefined || v === '') return NaN
  const n = Number.parseInt(String(v), 10)
  return Number.isFinite(n) && n > 0 ? n : NaN
}

function resetEmpty() {
  raw.value = null
  view.value = emptyShiftDetailView()
  canEdit.value = false
  canDelete.value = false
}

async function loadRecord(id: number, date: string): Promise<void> {
  uni.showLoading({ title: '加载中', mask: true })
  const applyRow = (row: ShiftRecord | null | undefined) => {
    if (!row) {
      uni.showToast({ title: '未找到该记录', icon: 'none' })
      resetEmpty()
      return
    }
    raw.value = row
    view.value = mapRecordToDetailView(row)
    canEdit.value = canEditRecord(row, auth.userInfo, auth.isBoss)
    canDelete.value = auth.isBoss
  }

  try {
    const res = await getRecord({ id })
    const row = res.record
    if (row) {
      applyRow(row)
    } else {
      // fallback：当日 records 里捞一遍
      const list = await getRecords({ date })
      const hit = (list.records ?? []).find(r => Number(r.id) === id) ?? null
      applyRow(hit)
    }
  } catch {
    try {
      const list = await getRecords({ date })
      const hit = (list.records ?? []).find(r => Number(r.id) === id) ?? null
      applyRow(hit)
    } catch {
      resetEmpty()
    }
  } finally {
    uni.hideLoading()
  }
}

const unitDisplay = computed(() => 'units')

onLoad(options => {
  if (!session.ensureReady()) return
  const opts = (options ?? {}) as Record<string, string | undefined>
  const id = parseId(opts.id)
  const dateRaw = String(opts.date ?? '').trim()
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : formatDate(new Date())

  if (!Number.isFinite(id) || id <= 0) {
    resetEmpty()
    uni.showToast({ title: '缺少记录参数', icon: 'none' })
    return
  }
  recordId.value = id
  recordDate.value = date
  void loadRecord(id, date)
})

/**
 * 后台回前台也需要复核会话：避免使用旧 id 访问失效会话。
 */
onShow(() => {
  if (!session.ensureReady()) return
})

async function onTapEdit(): Promise<void> {
  const row = raw.value
  if (!recordId.value || !row) {
    uni.showToast({ title: '记录未加载完成', icon: 'none' })
    return
  }
  uni.showLoading({ title: '加载中', mask: true })
  try {
    const list = await shiftConfigs.ensureLoaded()
    if (!list.length) {
      uni.showToast({ title: '请先在设置中配置班次', icon: 'none' })
      return
    }
    // getShifts 已按 is_active=1 过滤，列表中任一命中即视为可编辑
    const matched = list.some(s => s.id === row.shift_config_id)
    if (!matched) {
      uni.showModal({
        title: '无法编辑',
        content:
          '该记录关联的班次已停用或已删除。请先在「设置 → 班次设置」中恢复对应班次后，再尝试修改。',
        showCancel: false
      })
      return
    }
    uni.setNavigationBarTitle({ title: '修改记账' })
    editing.value = true
  } catch {
    uni.showToast({ title: '加载失败，请重试', icon: 'none' })
  } finally {
    uni.hideLoading()
  }
}

function cancelEdit() {
  uni.setNavigationBarTitle({ title: '班次明细' })
  editing.value = false
}

async function onSubmitSuccess() {
  uni.setNavigationBarTitle({ title: '班次明细' })
  editing.value = false
  if (recordId.value) {
    await loadRecord(recordId.value, recordDate.value)
  }
}

async function onTapDelete(): Promise<void> {
  if (!recordId.value || !raw.value) {
    uni.showToast({ title: '记录未加载完成', icon: 'none' })
    return
  }
  if (!auth.isBoss) {
    uni.showToast({ title: '仅管理员可删除', icon: 'none' })
    return
  }
  const ok = await new Promise<boolean>(resolve => {
    uni.showModal({
      title: '删除记录',
      content: '删除后将回滚库存与现金并写入流水，确定删除这条记录吗？',
      confirmText: '确认删除',
      confirmColor: '#c0392b',
      cancelText: '取消',
      success: res => resolve(!!res.confirm),
      fail: () => resolve(false)
    })
  })
  if (!ok) return

  uni.showLoading({ title: '删除中', mask: true })
  try {
    await deleteRecord({ id: recordId.value })
    uni.showToast({ title: '已删除记录', icon: 'success' })
    setTimeout(() => {
      uni.navigateBack({ delta: 1 })
    }, 300)
  } catch (err) {
    const msg = err instanceof Error ? err.message : '删除失败，请重试'
    uni.showToast({ title: msg, icon: 'none' })
  } finally {
    uni.hideLoading()
  }
}
</script>

<template>
  <view class="page">
    <block v-if="!editing">
      <ShiftDetailHeader
        :shift-name="view.shiftName"
        :record-date-display="view.recordDateDisplay"
        :recorder-name="view.recorderName"
        :recorder-initial="view.recorderInitial"
      />

      <ShiftDetailHero :qty-sold-formatted="view.qtySoldFormatted" :unit="unitDisplay" />

      <ShiftDetailMetrics
        :qty-opening-formatted="view.qtyOpeningFormatted"
        :qty-closing-formatted="view.qtyClosingFormatted"
        :qty-gift-formatted="view.qtyGiftFormatted"
      />

      <ShiftDetailPayments
        :sold-wechat="view.soldWechat"
        :sold-alipay="view.soldAlipay"
        :sold-cash="view.soldCash"
        :wechat-amount-str="view.wechatAmountStr"
        :alipay-amount-str="view.alipayAmountStr"
        :cash-amount-str="view.cashAmountStr"
      />

      <ShiftDetailCash
        :cash-opening-str="view.cashOpeningStr"
        :cash-closing-str="view.cashClosingStr"
      />

      <view v-if="canEdit" class="actions">
        <view class="edit-btn" hover-class="edit-btn-hover" @tap="onTapEdit">
          <text class="edit-btn-text">修改本条记录</text>
        </view>
        <view v-if="canDelete" class="delete-btn" hover-class="delete-btn-hover" @tap="onTapDelete">
          <text class="delete-btn-text">删除本条记录</text>
        </view>
      </view>

      <view class="bottom-spacer" />
    </block>

    <block v-else>
      <view class="edit-container">
        <view class="headline-section">
          <text class="eyebrow">修改记录</text>
          <text class="title">修改记账数据</text>
          <text class="cancel" @tap="cancelEdit">返回详情</text>
        </view>

        <LedgerRecordForm mode="edit" :record="raw" @submit-success="onSubmitSuccess" />

        <view class="bottom-spacer" />
      </view>
    </block>
  </view>
</template>

<style scoped>
.page {
  padding: 40rpx 40rpx 240rpx;
  background: #f9f9fb;
  min-height: 100vh;
}
.actions {
  padding: 0 32rpx 48rpx;
}
.edit-btn {
  margin-top: 24rpx;
  padding: 28rpx 32rpx;
  border-radius: 16rpx;
  background: #1a1c1d;
  align-items: center;
  justify-content: center;
  display: flex;
}
.edit-btn-hover {
  opacity: 0.88;
}
.edit-btn-text {
  color: #fff;
  font-weight: 500;
  font-size: 28rpx;
}
.delete-btn {
  margin-top: 20rpx;
  padding: 24rpx 32rpx;
  border-radius: 16rpx;
  border: 1rpx solid #e3d3d3;
  background: #fff;
  align-items: center;
  justify-content: center;
  display: flex;
}
.delete-btn-hover {
  opacity: 0.88;
}
.delete-btn-text {
  color: #c0392b;
  font-weight: 500;
  font-size: 26rpx;
}
.edit-container {
  padding: 0;
}
.headline-section {
  margin-bottom: 80rpx;
}
.headline-section .eyebrow {
  display: block;
  margin-bottom: 8rpx;
  font-size: 24rpx;
  color: #474747;
  letter-spacing: 1rpx;
}
.headline-section .title {
  display: block;
  font-size: 44rpx;
  font-weight: 800;
  color: #1a1c1d;
  letter-spacing: -1rpx;
}
.cancel {
  display: block;
  margin-top: 16rpx;
  color: #474747;
  text-decoration: underline;
  font-size: 26rpx;
}
.bottom-spacer {
  height: 80rpx;
}
</style>
