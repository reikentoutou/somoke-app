<script setup lang="ts">
import { computed } from 'vue'
import type { ShiftConfigListItem } from '@somoke/shared'

/**
 * 日期 + 班次两格选择器，横向并排。
 * v-model:recordDate 与 v-model:shiftConfigId 均为两路单向绑定（defineModel），
 * 父组件只消费 state 不必关心 picker 的下标展示。
 */
interface Props {
  shifts: ShiftConfigListItem[]
}
const props = defineProps<Props>()

const recordDate = defineModel<string>('recordDate', { required: true })
const shiftConfigId = defineModel<number | null>('shiftConfigId', { required: true })

const shiftIndex = computed(() => {
  if (shiftConfigId.value == null) return 0
  const list = props.shifts ?? []
  const ix = list.findIndex(s => s.id === shiftConfigId.value)
  return ix < 0 ? 0 : ix
})

const shiftLabel = computed(() => {
  const hit = (props.shifts ?? [])[shiftIndex.value]
  return hit?.name ?? '请选择'
})

function onDatePick(e: Event) {
  const v = (e as unknown as { detail?: { value?: string } }).detail?.value ?? ''
  recordDate.value = v
}

function onShiftPick(e: Event) {
  const raw = (e as unknown as { detail?: { value?: string | number } }).detail?.value ?? 0
  const ix = Number.parseInt(String(raw), 10)
  const list = props.shifts ?? []
  const hit = list[Number.isFinite(ix) ? ix : 0]
  shiftConfigId.value = hit ? hit.id : null
}
</script>

<template>
  <view class="meta-row">
    <view class="cell">
      <text class="label">日期</text>
      <picker mode="date" :value="recordDate" @change="onDatePick">
        <text class="value">{{ recordDate || '请选择' }}</text>
      </picker>
    </view>
    <view class="cell">
      <text class="label">所属班次</text>
      <picker
        v-if="(shifts || []).length"
        mode="selector"
        :range="shifts || []"
        range-key="name"
        :value="shiftIndex"
        @change="onShiftPick"
      >
        <text class="value">{{ shiftLabel }}</text>
      </picker>
      <text v-else class="value value--empty">暂无班次（请在设置中配置）</text>
    </view>
  </view>
</template>

<style scoped>
.meta-row {
  display: flex;
  gap: 16rpx;
}
.cell {
  flex: 1;
  background: #fff;
  border-radius: 20rpx;
  padding: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}
.label {
  font-size: 24rpx;
  color: #8a8a8f;
}
.value {
  font-size: 32rpx;
  color: #1a1c1d;
  font-weight: 500;
}
.value--empty {
  color: #bfbfbf;
  font-size: 26rpx;
  font-weight: 400;
}
</style>
