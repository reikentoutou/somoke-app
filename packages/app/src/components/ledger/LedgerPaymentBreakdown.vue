<script setup lang="ts">
/**
 * 支付方式件数 + 赠送件数。四路 v-model：soldWechat / soldAlipay / soldCash / qtyGift。
 * 子组件只负责 UI + 过滤非负整数；父组件不用关心 IME/粘贴等脏输入。
 */
const soldWechat = defineModel<string>('soldWechat', { required: true })
const soldAlipay = defineModel<string>('soldAlipay', { required: true })
const soldCash = defineModel<string>('soldCash', { required: true })
const qtyGift = defineModel<string>('qtyGift', { required: true })

function pickDigits(e: Event): string {
  const raw = (e as unknown as { detail?: { value?: string } }).detail?.value ?? ''
  return String(raw).replace(/[^0-9]/g, '')
}
</script>

<template>
  <view class="section">
    <text class="section-title">支付方式统计</text>

    <view class="item">
      <view class="left">
        <view class="icon icon--wechat"><text>微</text></view>
        <text class="name">微信卖出数量</text>
      </view>
      <input
        class="ctrl"
        type="number"
        placeholder="0"
        :value="soldWechat"
        @input="soldWechat = pickDigits($event)"
      />
    </view>

    <view class="item">
      <view class="left">
        <view class="icon icon--alipay"><text>支</text></view>
        <text class="name">支付宝卖出数量</text>
      </view>
      <input
        class="ctrl"
        type="number"
        placeholder="0"
        :value="soldAlipay"
        @input="soldAlipay = pickDigits($event)"
      />
    </view>

    <view class="item">
      <view class="left">
        <view class="icon icon--cash"><text>现</text></view>
        <text class="name">现金卖出数量</text>
      </view>
      <input
        class="ctrl"
        type="number"
        placeholder="0"
        :value="soldCash"
        @input="soldCash = pickDigits($event)"
      />
    </view>

    <view class="item item--gift">
      <view class="left">
        <view class="icon icon--gift"><text>赠</text></view>
        <text class="name name--alt">赠送量</text>
      </view>
      <input
        class="ctrl ctrl--alt"
        type="number"
        placeholder="0"
        :value="qtyGift"
        @input="qtyGift = pickDigits($event)"
      />
    </view>
  </view>
</template>

<style scoped>
.section {
  margin-top: 32rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}
.section-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #1a1c1d;
  margin-bottom: 8rpx;
}
.item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}
.left {
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.icon {
  width: 56rpx;
  height: 56rpx;
  border-radius: 14rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 24rpx;
  font-weight: 600;
}
.icon--wechat {
  background: #07c160;
}
.icon--alipay {
  background: #1677ff;
}
.icon--cash {
  background: #faad14;
}
.icon--gift {
  background: #ff4d4f;
}
.name {
  font-size: 28rpx;
  color: #1a1c1d;
}
.name--alt {
  color: #ff4d4f;
}
.ctrl {
  font-size: 32rpx;
  font-weight: 600;
  color: #1a1c1d;
  text-align: right;
  width: 200rpx;
}
.ctrl--alt {
  color: #ff4d4f;
}
</style>
