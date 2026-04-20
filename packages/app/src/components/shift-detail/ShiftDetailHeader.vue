<script setup lang="ts">
interface Props {
  shiftName: string
  recordDateDisplay: string
  recorderName: string
  recorderInitial: string
}
defineProps<Props>()
</script>

<template>
  <view class="header">
    <view class="header-main">
      <text class="eyebrow">SHIFT OVERVIEW</text>
      <text class="title">{{ shiftName }}</text>
    </view>
    <view class="info card">
      <view class="row">
        <text class="label">记录日期</text>
        <text class="value">{{ recordDateDisplay }}</text>
      </view>
      <view class="recorder">
        <view v-if="recorderInitial" class="avatar">
          <text class="avatar-text">{{ recorderInitial }}</text>
        </view>
        <view class="recorder-text">
          <text class="label">记录人</text>
          <text class="name">{{ recorderName }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.header {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  justify-content: space-between;
  gap: 32rpx;
  margin-bottom: 48rpx;
}
.header-main {
  flex: 1;
  min-width: 0;
  padding-top: 8rpx;
}
.eyebrow {
  display: block;
  margin-bottom: 16rpx;
  font-size: 24rpx;
  color: #474747;
  letter-spacing: 1rpx;
}
.title {
  display: block;
  word-break: break-all;
  font-size: 52rpx;
  font-weight: 800;
  letter-spacing: -1.5rpx;
  color: #1a1c1d;
}
.card {
  background: #fff;
  border-radius: 32rpx;
}
.info {
  flex-shrink: 0;
  width: 280rpx;
  padding: 32rpx 36rpx;
}
.row {
  margin-bottom: 28rpx;
}
.label {
  display: block;
  margin-bottom: 8rpx;
  font-size: 22rpx;
  color: #474747;
  letter-spacing: 1rpx;
}
.value {
  display: block;
  font-size: 30rpx;
  line-height: 1.25;
  font-weight: 600;
  color: #1a1c1d;
}
.recorder {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 20rpx;
}
.avatar {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background: #1a1c1d;
  display: flex;
  align-items: center;
  justify-content: center;
}
.avatar-text {
  font-size: 26rpx;
  font-weight: 600;
  color: #e2e2e2;
}
.recorder-text {
  flex: 1;
  min-width: 0;
}
.name {
  display: block;
  margin-top: 4rpx;
  color: #474747;
  font-weight: 500;
  font-size: 26rpx;
}
</style>
