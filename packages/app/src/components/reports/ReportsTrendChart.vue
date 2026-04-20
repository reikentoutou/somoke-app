<script setup lang="ts">
import type { ChartMode, ChartRow } from '@/utils/reports'

/**
 * 柱状图（按日 / 按周）。所有计算在 pages/reports 里用 buildChartRows 生成，
 * 本组件只负责切换 mode 与渲染。
 */
interface Props {
  rows: ChartRow[]
  mode: ChartMode
}
defineProps<Props>()

const mode = defineModel<ChartMode>('mode', { required: true })

function setDaily() {
  if (mode.value !== 'daily') mode.value = 'daily'
}
function setWeekly() {
  if (mode.value !== 'weekly') mode.value = 'weekly'
}
</script>

<template>
  <view class="chart-card card-low">
    <view class="chart-toggle-row">
      <view
        class="chart-toggle"
        :class="{ active: mode === 'daily' }"
        hover-class="chart-toggle-hover"
        @tap="setDaily"
      >
        按日
      </view>
      <view
        class="chart-toggle"
        :class="{ active: mode === 'weekly' }"
        hover-class="chart-toggle-hover"
        @tap="setWeekly"
      >
        按周
      </view>
    </view>
    <view v-if="rows.length" class="chart-bars">
      <view
        v-for="row in rows"
        :key="row.chartKey"
        class="chart-col"
        hover-class="chart-col-hover"
        hover-stay-time="80"
      >
        <text class="chart-amount-label">{{ row.amountFmt }}</text>
        <view class="chart-bar-track">
          <view class="chart-bar-fill" :style="{ height: row.heightPct + '%' }" />
        </view>
        <text class="chart-day-label">{{ row.label }}</text>
        <text v-if="row.sublabel" class="chart-sublabel">{{ row.sublabel }}</text>
      </view>
    </view>
    <view v-else class="chart-empty">本月暂无数据</view>
  </view>
</template>

<style scoped>
.card-low {
  background: #f9f9fb;
  border-radius: 32rpx;
  padding: 32rpx;
}
.chart-card {
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  margin-bottom: 48rpx;
}
.chart-toggle-row {
  display: flex;
  flex-direction: row;
  margin-bottom: 40rpx;
}
.chart-toggle {
  flex: 1;
  margin-right: 16rpx;
  text-align: center;
  padding: 20rpx 24rpx;
  font-size: 26rpx;
  font-weight: 600;
  color: #474747;
  background: #fff;
  border: 2rpx solid rgba(0, 0, 0, 0.06);
  border-radius: 999rpx;
  line-height: 1.2;
  box-sizing: border-box;
}
.chart-toggle:last-child {
  margin-right: 0;
}
.chart-toggle.active {
  color: #f5f6f8;
  background: #1a1c1d;
  border-color: #1a1c1d;
}
.chart-toggle-hover {
  opacity: 0.85;
}
.chart-bars {
  display: flex;
  flex-direction: row;
  align-items: flex-end;
  justify-content: space-between;
  min-height: 340rpx;
  padding: 12rpx 4rpx 0;
}
.chart-col {
  flex: 1;
  margin-right: 12rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
}
.chart-col:last-child {
  margin-right: 0;
}
.chart-col-hover {
  opacity: 0.92;
}
.chart-amount-label {
  font-size: 20rpx;
  font-weight: 600;
  color: #474747;
  margin-bottom: 14rpx;
  text-align: center;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.2;
}
.chart-bar-track {
  width: 100%;
  max-width: 76rpx;
  height: 240rpx;
  background: #ececee;
  border-radius: 22rpx;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  overflow: hidden;
  margin-bottom: 16rpx;
  border: 2rpx solid rgba(0, 0, 0, 0.04);
}
.chart-bar-fill {
  width: 100%;
  min-height: 0;
  background: #1a1c1d;
  border-radius: 20rpx;
}
.chart-day-label {
  font-size: 22rpx;
  font-weight: 600;
  color: #1a1c1d;
  text-align: center;
}
.chart-sublabel {
  font-size: 18rpx;
  color: #474747;
  margin-top: 4rpx;
  text-align: center;
}
.chart-empty {
  text-align: center;
  padding: 48rpx 0;
  color: #474747;
  font-size: 26rpx;
}
</style>
