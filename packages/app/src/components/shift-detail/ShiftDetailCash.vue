<script setup lang="ts">
interface Props {
  cashOpeningStr: string
  cashClosingStr: string
  currency?: string
}
withDefaults(defineProps<Props>(), { currency: '¥' })
</script>

<template>
  <view class="section">
    <text class="eyebrow">CASH SETTLEMENT</text>
    <text class="title">现金清算</text>
    <view class="cash">
      <view class="cell card-low">
        <text class="label">上班现金</text>
        <text class="value">{{ currency }}{{ cashOpeningStr }}</text>
      </view>
      <view class="cell cell--elevated card">
        <text class="label">下班现金</text>
        <text class="value">{{ currency }}{{ cashClosingStr }}</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.section {
  margin-bottom: 0;
}
.eyebrow {
  display: block;
  margin-bottom: 12rpx;
  font-size: 22rpx;
  letter-spacing: 1rpx;
  color: #474747;
}
.title {
  display: block;
  margin-bottom: 28rpx;
  font-size: 32rpx;
  font-weight: 700;
  color: #1a1c1d;
  letter-spacing: -0.5rpx;
}
.card {
  background: #fff;
  border-radius: 32rpx;
}
.card-low {
  background: #f9f9fb;
  border-radius: 32rpx;
}
.cash {
  display: flex;
  flex-direction: row;
  gap: 20rpx;
}
.cell {
  flex: 1;
  min-width: 0;
  padding: 40rpx 36rpx;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}
.cell--elevated {
  box-shadow: 0 16rpx 48rpx rgba(0, 0, 0, 0.06);
  border: none;
}
.label {
  display: block;
  font-size: 22rpx;
  color: #474747;
  letter-spacing: 1rpx;
}
.value {
  font-size: 40rpx;
  font-weight: 600;
  letter-spacing: -1rpx;
  color: #1a1c1d;
}
</style>
