<script setup lang="ts">
/**
 * 三渠道金额卡片 + 占比条。所有数值已在父页面预处理；
 * 子组件只做展示和样式。
 */
interface ChannelRow {
  key: 'wechat' | 'alipay' | 'cash'
  label: string
  amount: string
  qty: number
  pct: number
  hasVolume: boolean
}

interface Props {
  currency: string
  rows: ChannelRow[]
  showMix: boolean
}
defineProps<Props>()
</script>

<template>
  <view class="wrap">
    <view class="cards">
      <view v-for="row in rows" :key="row.key" class="card">
        <view class="badge" :class="`badge--${row.key}`" />
        <text class="tag">{{ row.label }}</text>
        <view class="amount-row">
          <text class="currency">{{ currency }}</text>
          <text class="amount">{{ row.amount }}</text>
        </view>
        <text class="meta">{{ row.qty }} 件</text>
      </view>
    </view>

    <view v-if="showMix" class="mix">
      <text class="mix-label">今日渠道占比（按件数）</text>
      <view class="mix-track">
        <view
          v-for="row in rows"
          :key="row.key"
          class="mix-seg"
          :class="`mix-seg--${row.key}`"
          :style="{ width: `${row.pct}%` }"
          v-show="row.hasVolume"
        />
      </view>
      <view class="mix-legend">
        <text v-for="row in rows" :key="row.key" class="mix-i" :class="row.key">
          {{ row.label }} {{ row.pct }}%
        </text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.wrap {
  margin-top: -40rpx;
  padding: 0 24rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.cards {
  display: flex;
  gap: 16rpx;
}
.card {
  flex: 1;
  background: #fff;
  border-radius: 20rpx;
  padding: 28rpx 20rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.06);
}
.badge {
  width: 48rpx;
  height: 8rpx;
  border-radius: 4rpx;
}
.badge--wechat {
  background: #07c160;
}
.badge--alipay {
  background: #1677ff;
}
.badge--cash {
  background: #faad14;
}
.tag {
  font-size: 22rpx;
  color: #8a8a8f;
}
.amount-row {
  display: flex;
  align-items: baseline;
  gap: 6rpx;
}
.currency {
  font-size: 24rpx;
  color: #474747;
}
.amount {
  font-size: 36rpx;
  font-weight: 700;
  color: #1a1c1d;
}
.meta {
  font-size: 22rpx;
  color: #8a8a8f;
}
.mix {
  background: #fff;
  border-radius: 20rpx;
  padding: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
}
.mix-label {
  font-size: 24rpx;
  color: #8a8a8f;
}
.mix-track {
  height: 12rpx;
  border-radius: 6rpx;
  background: #f3f3f5;
  overflow: hidden;
  display: flex;
}
.mix-seg {
  height: 100%;
}
.mix-seg--wechat {
  background: #07c160;
}
.mix-seg--alipay {
  background: #1677ff;
}
.mix-seg--cash {
  background: #faad14;
}
.mix-legend {
  display: flex;
  gap: 24rpx;
  font-size: 22rpx;
  color: #474747;
}
.wechat {
  color: #07c160;
}
.alipay {
  color: #1677ff;
}
.cash {
  color: #faad14;
}
</style>
