<script setup lang="ts">
/**
 * 明细按日筛选条：左"全部日期" + 右"指定日期" picker chip。
 * - v-model 为已选 ISO 日期（YYYY-MM-DD）；空串表示"全部"。
 * - v-model:pickerDate 为 picker 上"当前指针"日期，只在用户选定时写入。
 */
interface Props {
  label: string
  rangeStart: string
  rangeEnd: string
}
defineProps<Props>()

const modelDate = defineModel<string>({ required: true })
const pickerDate = defineModel<string>('pickerDate', { required: true })

function onClearAll() {
  modelDate.value = ''
}

function onPick(e: Event) {
  const v = (e as unknown as { detail?: { value?: string } }).detail?.value ?? ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    modelDate.value = v
    pickerDate.value = v
  }
}
</script>

<template>
  <view class="day-filter-bar">
    <view
      class="day-filter-chip"
      :class="{ 'day-filter-chip--on': !modelDate }"
      hover-class="day-filter-chip-hover"
      @tap="onClearAll"
    >
      全部日期
    </view>
    <picker
      class="day-filter-picker-wrap"
      mode="date"
      :value="pickerDate"
      :start="rangeStart"
      :end="rangeEnd"
      @change="onPick"
    >
      <view class="day-filter-chip" :class="{ 'day-filter-chip--on': !!modelDate }">
        <text>{{ modelDate ? label : '指定日期' }}</text>
        <text class="day-filter-chip__chev">›</text>
      </view>
    </picker>
  </view>
</template>

<style scoped>
.day-filter-bar {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 16rpx;
  margin-bottom: 32rpx;
}
.day-filter-picker-wrap {
  flex-shrink: 0;
}
.day-filter-chip {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 18rpx 32rpx;
  border-radius: 999rpx;
  font-size: 26rpx;
  font-weight: 600;
  color: #474747;
  background: #fff;
  border: 2rpx solid rgba(0, 0, 0, 0.06);
  line-height: 1.2;
  box-sizing: border-box;
}
.day-filter-chip--on {
  color: #f5f6f8;
  background: #1a1c1d;
  border-color: #1a1c1d;
}
.day-filter-chip-hover {
  opacity: 0.88;
}
.day-filter-chip__chev {
  font-size: 32rpx;
  font-weight: 400;
  margin-left: 8rpx;
  line-height: 1;
  color: inherit;
  opacity: 0.6;
}
</style>
