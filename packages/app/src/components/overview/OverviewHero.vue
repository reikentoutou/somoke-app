<script setup lang="ts">
/** 今日营收头图：仅展示，数值与币种由父页面算好传入 */
interface Props {
  currency: string
  amount: string
}
defineProps<Props>()
</script>

<template>
  <view class="hero">
    <text class="label">当日销售营收</text>
    <view class="amount-row">
      <text class="currency">{{ currency }}</text>
      <text class="amount">{{ amount }}</text>
    </view>
    <view class="sync">
      <view class="dot" />
      <text class="sync-text">实时同步中</text>
    </view>
  </view>
</template>

<style scoped>
.hero {
  padding: 56rpx 48rpx 32rpx;
  background: #1677ff;
  color: #fff;
}
.label {
  font-size: 24rpx;
  opacity: 0.85;
}
.amount-row {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
  margin-top: 12rpx;
}
.currency {
  font-size: 36rpx;
  opacity: 0.85;
}
.amount {
  font-size: 72rpx;
  font-weight: 700;
}
.sync {
  margin-top: 16rpx;
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.dot {
  width: 12rpx;
  height: 12rpx;
  background: #b7eb8f;
  border-radius: 50%;
}
.sync-text {
  font-size: 22rpx;
  opacity: 0.85;
}
</style>
