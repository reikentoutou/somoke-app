<script setup lang="ts">
interface Props {
  label: string
  amount: string
  currency?: string
}
withDefaults(defineProps<Props>(), { currency: '¥' })
</script>

<template>
  <view class="hero">
    <text class="hero-label">{{ label }}</text>
    <view class="hero-amount-row">
      <text class="hero-currency">{{ currency }}</text>
      <text class="hero-amount">{{ amount }}</text>
    </view>
    <view class="hero-sync">
      <view class="hero-sync-dot" />
      <text class="hero-sync-text">以下为当前选中月份的统计数据</text>
    </view>
  </view>
</template>

<style scoped>
.hero {
  margin-bottom: 56rpx;
}
.hero-label {
  display: block;
  margin-bottom: 20rpx;
  font-size: 24rpx;
  color: #474747;
  letter-spacing: 1rpx;
}
.hero-amount-row {
  display: flex;
  flex-direction: row;
  align-items: baseline;
  flex-wrap: wrap;
  margin-bottom: 24rpx;
}
.hero-currency {
  font-size: 72rpx;
  font-weight: 700;
  color: #1a1c1d;
  margin-right: 12rpx;
  letter-spacing: -2rpx;
}
.hero-amount {
  font-size: 120rpx;
  font-weight: 800;
  line-height: 0.95;
  color: #1a1c1d;
  letter-spacing: -4rpx;
}
.hero-sync {
  display: flex;
  flex-direction: row;
  align-items: center;
}
.hero-sync-dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: #1a1c1d;
  flex-shrink: 0;
  margin-right: 16rpx;
}
.hero-sync-text {
  color: #474747;
  font-size: 26rpx;
}
</style>
