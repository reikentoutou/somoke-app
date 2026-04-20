<script setup lang="ts">
/** 顶部 hero：两张卡片展示当前库存 / 当前现金。 */
interface Props {
  currentStock: number | string
  currentCash: number | string
}
defineProps<Props>()
</script>

<template>
  <view class="hero">
    <view class="card">
      <text class="label">当前库存</text>
      <view class="val-row">
        <text class="val">{{ currentStock }}</text>
        <text class="unit">件</text>
      </view>
    </view>
    <view class="card">
      <text class="label">当前现金</text>
      <view class="val-row">
        <text class="val">{{ currentCash }}</text>
        <text class="unit">円</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.hero {
  display: flex;
  flex-direction: row;
  gap: 24rpx;
  margin-bottom: 48rpx;
}
.card {
  flex: 1;
  padding: 40rpx 36rpx;
  background: #fff;
  border-radius: 32rpx;
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.label {
  font-size: 24rpx;
  color: #8a8a8f;
  margin-bottom: 24rpx;
}
.val-row {
  display: flex;
  flex-direction: row;
  align-items: baseline;
  gap: 8rpx;
}
.val {
  font-size: 64rpx;
  font-weight: 700;
  color: #1a1c1d;
  line-height: 1;
  letter-spacing: -1rpx;
}
.unit {
  font-size: 28rpx;
  font-weight: 600;
  color: #474747;
}
</style>
