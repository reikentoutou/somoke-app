<script setup lang="ts">
interface Props {
  qtySoldFormatted: string
  unit?: string
}
withDefaults(defineProps<Props>(), { unit: 'units' })
</script>

<template>
  <view class="hero">
    <text class="label">TOTAL SOLD</text>
    <view class="amount-row">
      <text class="num">{{ qtySoldFormatted }}</text>
      <text class="units">{{ unit }}</text>
    </view>
  </view>
</template>

<style scoped>
.hero {
  background: #1a1c1d;
  color: #e8eaed;
  border-radius: 48rpx;
  padding: 48rpx 48rpx 52rpx;
  margin-bottom: 32rpx;
  box-shadow: 0 24rpx 56rpx rgba(22, 24, 28, 0.18);
}
.label {
  color: rgba(226, 226, 226, 0.65);
  display: block;
  margin-bottom: 24rpx;
  font-size: 24rpx;
  letter-spacing: 1rpx;
}
.amount-row {
  display: flex;
  flex-direction: row;
  align-items: baseline;
  flex-wrap: wrap;
  gap: 16rpx 24rpx;
}
.num {
  color: #f5f6f8;
  font-size: 120rpx;
  letter-spacing: -4rpx;
  font-weight: 800;
  line-height: 0.95;
}
.units {
  color: rgba(226, 226, 226, 0.7);
  font-size: 26rpx;
  letter-spacing: 1rpx;
}
</style>
