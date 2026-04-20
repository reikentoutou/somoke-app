<script setup lang="ts">
import { computed } from 'vue'
import type { LedgerViewItem } from '@/utils/stockLedger'

/**
 * 单条流水行：左侧时间线小圆点 + 右侧卡片。
 * 所有展示字段均来自父组件装饰好的 `LedgerViewItem`，本组件只做 render。
 */

interface Props {
  item: LedgerViewItem
  /** 是否为最后一条（隐藏连接线） */
  last?: boolean
}
const props = withDefaults(defineProps<Props>(), { last: false })

const deltaToneStock = computed(() =>
  props.item.delta > 0 ? 'pos' : props.item.delta < 0 ? 'neg' : ''
)
const deltaToneCash = computed(() =>
  props.item.cashDelta > 0 ? 'pos' : props.item.cashDelta < 0 ? 'neg' : ''
)

const toneClass = computed(() => `tone-${props.item.tone}`)
</script>

<template>
  <view class="row">
    <view class="rail">
      <view :class="['dot', toneClass]" />
      <view v-if="!last" class="line" />
    </view>

    <view class="body">
      <view class="head">
        <view :class="['badge', toneClass]">
          <text class="badge-initial">{{ item.initial }}</text>
          <text class="badge-label">{{ item.typeLabel }}</text>
        </view>
        <text class="time">{{ item.timeDisplay }}</text>
      </view>

      <view v-if="item.hasStock" class="metric">
        <text class="metric-label">库存</text>
        <text :class="['metric-delta', deltaToneStock]">{{ item.stockDeltaDisplay }}</text>
        <text class="metric-balance">结余 {{ item.balanceAfter }} 件</text>
      </view>

      <view v-if="item.hasCash" class="metric">
        <text class="metric-label">现金</text>
        <text :class="['metric-delta', deltaToneCash]">{{ item.cashDeltaDisplay }}</text>
        <text class="metric-balance">结余 {{ item.cashBalanceAfter }} 円</text>
      </view>

      <view v-if="item.shiftChip || item.operatorName" class="meta">
        <view v-if="item.shiftChip" class="chip chip-shift">
          <text class="chip-dot">·</text>
          <text>{{ item.shiftChip }}</text>
          <text v-if="item.recorderName" class="chip-sub">{{ item.recorderName }}</text>
        </view>
        <view v-if="item.operatorName" class="chip chip-op">
          <text>操作人 {{ item.operatorName }}</text>
        </view>
      </view>

      <text v-if="item.note" class="note">{{ item.note }}</text>
    </view>
  </view>
</template>

<style scoped>
.row {
  position: relative;
  display: flex;
  gap: 20rpx;
  padding-bottom: 28rpx;
}
.rail {
  position: relative;
  width: 20rpx;
  flex-shrink: 0;
  padding-top: 10rpx;
}
.dot {
  width: 16rpx;
  height: 16rpx;
  border-radius: 50%;
  background: #1a1c1d;
  border: 4rpx solid #fff;
  box-shadow: 0 0 0 2rpx rgba(0, 0, 0, 0.06);
  position: relative;
  z-index: 1;
}
.line {
  position: absolute;
  top: 28rpx;
  left: 50%;
  transform: translateX(-50%);
  width: 2rpx;
  bottom: -28rpx;
  background: rgba(0, 0, 0, 0.06);
}
.body {
  flex: 1;
  background: #fff;
  border-radius: 24rpx;
  padding: 28rpx 32rpx;
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}
.badge {
  display: inline-flex;
  align-items: center;
  gap: 10rpx;
  padding: 8rpx 18rpx 8rpx 8rpx;
  border-radius: 999rpx;
  background: #f3f3f5;
}
.badge-initial {
  display: inline-flex;
  width: 40rpx;
  height: 40rpx;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: #1a1c1d;
  color: #fff;
  font-size: 22rpx;
  font-weight: 700;
}
.badge-label {
  font-size: 26rpx;
  font-weight: 600;
  color: #1a1c1d;
}
.time {
  font-size: 24rpx;
  color: #8a8a8f;
}

.dot.tone-record {
  background: #1a1c1d;
}
.dot.tone-restock {
  background: #07c160;
}
.dot.tone-withdraw {
  background: #ba1a1a;
}
.dot.tone-adjust {
  background: #c48200;
}
.dot.tone-neutral {
  background: #8a8a8f;
}

.badge.tone-record .badge-initial {
  background: #1a1c1d;
}
.badge.tone-restock {
  background: #e6f9ee;
}
.badge.tone-restock .badge-initial {
  background: #07c160;
}
.badge.tone-restock .badge-label {
  color: #065f2f;
}
.badge.tone-withdraw {
  background: #fdeaea;
}
.badge.tone-withdraw .badge-initial {
  background: #ba1a1a;
}
.badge.tone-withdraw .badge-label {
  color: #7a1010;
}
.badge.tone-adjust {
  background: #fff3d9;
}
.badge.tone-adjust .badge-initial {
  background: #c48200;
}
.badge.tone-adjust .badge-label {
  color: #6b4500;
}
.badge.tone-neutral .badge-initial {
  background: #8a8a8f;
}

.metric {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 12rpx 16rpx;
  background: #f9f9fb;
  border-radius: 16rpx;
}
.metric-label {
  font-size: 22rpx;
  color: #8a8a8f;
  width: 64rpx;
  flex-shrink: 0;
}
.metric-delta {
  font-size: 30rpx;
  font-weight: 700;
  color: #1a1c1d;
  flex: 1;
}
.metric-delta.pos {
  color: #07c160;
}
.metric-delta.neg {
  color: #ba1a1a;
}
.metric-balance {
  font-size: 22rpx;
  color: #6e6e73;
}

.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 4rpx;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 8rpx;
  padding: 8rpx 18rpx;
  border-radius: 999rpx;
  font-size: 22rpx;
  background: #f3f3f5;
  color: #474747;
}
.chip-shift {
  background: #eef2ff;
  color: #2c3d8f;
}
.chip-dot {
  color: #99a6d3;
}
.chip-sub {
  color: #5b6aa1;
  font-weight: 500;
}
.chip-op {
  background: #f7f3eb;
  color: #6b5425;
}
.note {
  display: block;
  font-size: 24rpx;
  color: #474747;
  line-height: 1.5;
  padding-top: 16rpx;
  border-top: 2rpx dashed rgba(0, 0, 0, 0.06);
  margin-top: 4rpx;
}
</style>
