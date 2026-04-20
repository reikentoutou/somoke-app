<script setup lang="ts">
/**
 * 三渠道金额卡片（微信 / 支付宝 / 现金）。
 * 父页面传格式化字符串，组件只做渲染。
 */
interface Props {
  wechatAmount: string
  alipayAmount: string
  cashAmount: string
  wechatQty: number
  alipayQty: number
  cashQty: number
  currency?: string
}
withDefaults(defineProps<Props>(), { currency: '¥' })
</script>

<template>
  <view class="metrics-grid">
    <view class="card metric-card">
      <view class="metric-icon metric-icon-wechat">
        <view class="metric-icon-bar" />
        <view class="metric-icon-bar short" />
      </view>
      <text class="metric-title">微信总计</text>
      <text class="metric-amount">{{ currency }} {{ wechatAmount }}</text>
      <text class="metric-sub">{{ wechatQty }} 件成交</text>
    </view>
    <view class="card metric-card">
      <view class="metric-icon metric-icon-alipay">
        <view class="metric-icon-ring" />
      </view>
      <text class="metric-title">支付宝总计</text>
      <text class="metric-amount">{{ currency }} {{ alipayAmount }}</text>
      <text class="metric-sub">{{ alipayQty }} 件成交</text>
    </view>
    <view class="card metric-card">
      <view class="metric-icon metric-icon-cash">
        <view class="metric-icon-note" />
      </view>
      <text class="metric-title">现金总计</text>
      <text class="metric-amount">{{ currency }} {{ cashAmount }}</text>
      <text class="metric-sub">{{ cashQty }} 件成交</text>
    </view>
  </view>
</template>

<style scoped>
.metrics-grid {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  margin: -10rpx -10rpx 54rpx -10rpx;
}
.card {
  background: #ffffff;
  border-radius: 48rpx;
}
.metric-card {
  flex: 1 1 200rpx;
  min-width: 200rpx;
  max-width: 100%;
  box-sizing: border-box;
  margin: 10rpx;
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  padding: 32rpx 24rpx;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.metric-icon {
  width: 56rpx;
  height: 56rpx;
  border-radius: 16rpx;
  background: #f3f3f5;
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  margin-bottom: 20rpx;
  position: relative;
  box-sizing: border-box;
}
.metric-icon-wechat {
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 12rpx;
}
.metric-icon-wechat .metric-icon-bar + .metric-icon-bar {
  margin-left: 8rpx;
}
.metric-icon-bar {
  width: 10rpx;
  height: 28rpx;
  background: #1a1c1d;
  border-radius: 4rpx;
}
.metric-icon-bar.short {
  height: 18rpx;
}
.metric-icon-alipay {
  display: flex;
  align-items: center;
  justify-content: center;
}
.metric-icon-ring {
  width: 28rpx;
  height: 28rpx;
  border-radius: 50%;
  border: 4rpx solid #1a1c1d;
  box-sizing: border-box;
}
.metric-icon-cash {
  display: flex;
  align-items: center;
  justify-content: center;
}
.metric-icon-note {
  width: 32rpx;
  height: 22rpx;
  background: #1a1c1d;
  border-radius: 4rpx;
}
.metric-title {
  margin-bottom: 8rpx;
  font-size: 24rpx;
  color: #474747;
  letter-spacing: 1rpx;
}
.metric-amount {
  font-size: 30rpx;
  font-weight: 700;
  color: #1a1c1d;
  letter-spacing: -0.5rpx;
  margin-bottom: 8rpx;
  word-break: break-all;
}
.metric-sub {
  font-size: 22rpx;
  color: #474747;
  line-height: 1.35;
}
</style>
