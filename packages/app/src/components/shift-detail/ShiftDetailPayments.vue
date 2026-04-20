<script setup lang="ts">
interface Props {
  soldWechat: number
  soldAlipay: number
  soldCash: number
  wechatAmountStr: string
  alipayAmountStr: string
  cashAmountStr: string
  currency?: string
}
withDefaults(defineProps<Props>(), { currency: '¥' })
</script>

<template>
  <view class="section">
    <text class="eyebrow">PAYMENT BREAKDOWN</text>
    <text class="title">支付明细</text>
    <view class="pay card">
      <view class="row">
        <view class="dot dot--wechat" />
        <view class="mid">
          <text class="mid-title">微信支付</text>
          <text class="mid-sub">{{ soldWechat }} 份卖出</text>
        </view>
        <text class="amt">{{ currency }}{{ wechatAmountStr }}</text>
      </view>
      <view class="divider" />
      <view class="row">
        <view class="dot dot--alipay" />
        <view class="mid">
          <text class="mid-title">支付宝</text>
          <text class="mid-sub">{{ soldAlipay }} 份卖出</text>
        </view>
        <text class="amt">{{ currency }}{{ alipayAmountStr }}</text>
      </view>
      <view class="divider" />
      <view class="row">
        <view class="dot dot--cash" />
        <view class="mid">
          <text class="mid-title">现金支付</text>
          <text class="mid-sub">{{ soldCash }} 份卖出</text>
        </view>
        <text class="amt">{{ currency }}{{ cashAmountStr }}</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.section {
  margin-bottom: 48rpx;
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
.pay {
  padding: 8rpx 48rpx 48rpx;
}
.row {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 36rpx 0;
  gap: 28rpx;
}
.dot {
  width: 24rpx;
  height: 24rpx;
  border-radius: 50%;
  flex-shrink: 0;
}
.dot--wechat {
  background: #07c160;
  box-shadow: 0 0 0 12rpx rgba(7, 193, 96, 0.12);
}
.dot--alipay {
  background: #1677ff;
  box-shadow: 0 0 0 12rpx rgba(22, 119, 255, 0.12);
}
.dot--cash {
  background: #1a1c1d;
  box-shadow: 0 0 0 12rpx rgba(0, 0, 0, 0.06);
}
.mid {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}
.mid-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #1a1c1d;
}
.mid-sub {
  font-size: 24rpx;
  color: #474747;
}
.amt {
  flex-shrink: 0;
  font-weight: 600;
  letter-spacing: -0.5rpx;
  font-size: 30rpx;
  color: #1a1c1d;
}
.divider {
  height: 2rpx;
  background: rgba(0, 0, 0, 0.06);
  margin-left: 52rpx;
}
</style>
