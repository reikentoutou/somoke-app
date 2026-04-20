<script setup lang="ts">
import type { DailyGroup } from '@/utils/reports'

/**
 * 某一天的分组卡片：大日期 + 卡片内多行班次条目。
 * - emit `tap-shift` 将 shift id 与 date 抛给父页面处理导航。
 */
interface Props {
  group: DailyGroup
  currency?: string
}
withDefaults(defineProps<Props>(), { currency: '¥' })

const emit = defineEmits<{
  (e: 'tap-shift', payload: { id: number; date: string }): void
}>()

function onTap(id: number, date: string) {
  if (!id) return
  emit('tap-shift', { id, date })
}
</script>

<template>
  <view class="date-group">
    <view class="date-group-header">
      <text class="date-big">{{ group.dateDisplay }}</text>
      <text class="date-weekday">{{ group.weekday }}</text>
    </view>
    <view class="card shift-list-card">
      <block v-for="(shift, idx) in group.items" :key="shift.id">
        <view
          class="shift-item shift-item--tap"
          hover-class="shift-item-hover"
          @tap="onTap(shift.id, group.date)"
        >
          <view class="shift-item-top">
            <text class="shift-name">{{ shift.shift_name }}</text>
            <text class="shift-revenue">{{ currency }} {{ shift.revenueFormatted }}</text>
          </view>
          <text class="shift-qty">售出 {{ shift.qty_sold }} 件</text>
          <view class="shift-pay-row">
            <text class="pay-pill">微信 {{ currency }} {{ shift.wechatAmtFmt }}</text>
            <text class="pay-pill">支付宝 {{ currency }} {{ shift.alipayAmtFmt }}</text>
            <text class="pay-pill">现金 {{ currency }} {{ shift.cashAmtFmt }}</text>
          </view>
        </view>
        <view v-if="idx < group.items.length - 1" class="shift-divider" />
      </block>
    </view>
  </view>
</template>

<style scoped>
.date-group {
  margin-bottom: 48rpx;
}
.date-group-header {
  display: flex;
  flex-direction: row;
  align-items: baseline;
  margin-bottom: 20rpx;
}
.date-big {
  font-size: 72rpx;
  font-weight: 800;
  line-height: 1;
  color: #1a1c1d;
  letter-spacing: -3rpx;
  margin-right: 20rpx;
}
.date-weekday {
  color: #474747;
  font-size: 28rpx;
}
.card {
  background: #fff;
  border-radius: 32rpx;
}
.shift-list-card {
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  padding: 8rpx 40rpx;
}
.shift-item {
  padding: 32rpx 0;
}
.shift-item--tap {
  border-radius: 12rpx;
  margin-left: -8rpx;
  margin-right: -8rpx;
  padding-left: 8rpx;
  padding-right: 8rpx;
}
.shift-item-hover {
  background: rgba(0, 0, 0, 0.04);
}
.shift-item-top {
  display: flex;
  flex-direction: row;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 12rpx;
}
.shift-name {
  font-size: 32rpx;
  font-weight: 600;
  color: #1a1c1d;
  flex: 1;
  min-width: 0;
}
.shift-revenue {
  font-size: 30rpx;
  font-weight: 700;
  color: #1a1c1d;
  flex-shrink: 0;
  margin-left: 24rpx;
}
.shift-qty {
  display: block;
  margin-bottom: 20rpx;
  color: #474747;
  font-size: 26rpx;
}
.shift-pay-row {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
}
.pay-pill {
  font-size: 22rpx;
  color: #1a1c1d;
  background: #f3f3f5;
  padding: 10rpx 20rpx;
  border-radius: 999rpx;
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  margin-right: 12rpx;
  margin-bottom: 12rpx;
}
.shift-divider {
  height: 2rpx;
  background: rgba(0, 0, 0, 0.06);
  margin: 0;
}
</style>
