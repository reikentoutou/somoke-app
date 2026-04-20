<script setup lang="ts">
/**
 * 月份选择：卡片样式，点击唤起原生 month picker。
 * v-model 绑定 YYYY-MM；组件自身不做默认值，父页面负责首屏填充。
 */
const month = defineModel<string>({ required: true })

function onPick(e: Event) {
  const v = (e as unknown as { detail?: { value?: string } }).detail?.value ?? ''
  if (v) month.value = v
}
</script>

<template>
  <view class="month-picker-row">
    <view class="month-picker-head">
      <text class="label-sm month-picker-label">查询月份</text>
      <text class="month-picker-sub">选择后加载该月报表与明细</text>
    </view>
    <picker mode="date" fields="month" :value="month" @change="onPick">
      <view class="card month-picker-card">
        <view class="month-picker-card-main">
          <text class="month-picker-value">{{ month || '—' }}</text>
          <text class="month-picker-hint">点击更改 ›</text>
        </view>
      </view>
    </picker>
  </view>
</template>

<style scoped>
.month-picker-row {
  margin-bottom: 48rpx;
}
.month-picker-head {
  margin-bottom: 20rpx;
}
.month-picker-label {
  display: block;
  margin-bottom: 8rpx;
  font-size: 24rpx;
  color: #474747;
  letter-spacing: 1rpx;
}
.month-picker-sub {
  display: block;
  color: #5e5e63;
  font-size: 24rpx;
  line-height: 1.4;
}
.card {
  background: #ffffff;
  border-radius: 32rpx;
}
.month-picker-card {
  border: 2rpx solid rgba(0, 0, 0, 0.06);
  padding: 36rpx 40rpx;
  box-sizing: border-box;
}
.month-picker-card-main {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 24rpx;
}
.month-picker-value {
  font-size: 38rpx;
  font-weight: 600;
  color: #1a1c1d;
  letter-spacing: -1rpx;
}
.month-picker-hint {
  font-size: 26rpx;
  color: #5e5e63;
  font-weight: 500;
  flex-shrink: 0;
}
</style>
