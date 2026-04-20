<script setup lang="ts">
/**
 * 上班/下班/赠送 三栏指标卡。
 */
interface Props {
  qtyOpeningFormatted: string
  qtyClosingFormatted: string
  qtyGiftFormatted: string
}
defineProps<Props>()
</script>

<template>
  <view class="metrics">
    <view class="metric card-low">
      <text class="label">上班数量</text>
      <text class="value">{{ qtyOpeningFormatted }}</text>
    </view>
    <view class="metric card-low">
      <text class="label">下班数量</text>
      <text class="value">{{ qtyClosingFormatted }}</text>
    </view>
    <view class="metric card-low">
      <text class="label">赠送量</text>
      <text class="value">{{ qtyGiftFormatted }}</text>
    </view>
  </view>
</template>

<style scoped>
.metrics {
  display: flex;
  flex-direction: row;
  gap: 20rpx;
  margin-bottom: 56rpx;
}
.card-low {
  background: #f9f9fb;
  border-radius: 32rpx;
}
.metric {
  flex: 1;
  min-width: 0;
  padding: 36rpx 28rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.label {
  display: block;
  font-size: 20rpx;
  letter-spacing: 2rpx;
  color: #474747;
}
.value {
  font-size: 44rpx;
  font-weight: 600;
  line-height: 1.1;
  letter-spacing: -1rpx;
  color: #1a1c1d;
}
</style>
