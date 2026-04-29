<script setup lang="ts">
import { computed, ref, shallowRef, watch } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import type { ShiftRecord } from '@somoke/shared'
import { getRecords } from '@/api/endpoints/record'
import { useSession } from '@/composables/useSession'
import { useLoadSeq } from '@/composables/useLoadSeq'
import { useTabBarSync } from '@/composables/useTabBarSync'
import { formatCash } from '@/utils/money'
import { formatMonth } from '@/utils/date'
import {
  buildChartRows,
  buildReportsHeroLabel,
  defaultPickerDateInMonth,
  detailFilterDayLabel,
  filterGroupsByDate,
  groupRecordsByDate,
  monthDayBounds,
  type ChartMode,
  type DailyGroup
} from '@/utils/reports'

import ReportsMonthPicker from '@/components/reports/ReportsMonthPicker.vue'
import ReportsHero from '@/components/reports/ReportsHero.vue'
import ReportsSummaryMetrics from '@/components/reports/ReportsSummaryMetrics.vue'
import ReportsTrendChart from '@/components/reports/ReportsTrendChart.vue'
import ReportsDayFilter from '@/components/reports/ReportsDayFilter.vue'
import ReportsDateGroup from '@/components/reports/ReportsDateGroup.vue'

/**
 * 月度报表（tab 页）。
 * - 页面仅负责：会话守卫 + 请求/缓存 + 状态编排 + 组合子组件。
 * - 所有计算（分组/柱状图/筛选 label）走 utils/reports.ts 纯函数。
 */

const { ensureReady } = useSession()
const loadSeq = useLoadSeq()
useTabBarSync(2)

const currentMonth = ref(formatMonth(new Date()))
const records = shallowRef<ShiftRecord[]>([])
const summary = ref({
  total_revenue: 0,
  total_wechat_amount: 0,
  total_alipay_amount: 0,
  total_cash_amount: 0,
  total_wechat_qty: 0,
  total_alipay_qty: 0,
  total_cash_qty: 0
})
const loading = ref(false)
const chartMode = ref<ChartMode>('daily')

const detailFilterDate = ref('')
const detailDayPickerValue = ref('')

const heroLabel = computed(() => buildReportsHeroLabel(currentMonth.value))
const revenueFormatted = computed(() => formatCash(summary.value.total_revenue))
const wechatAmountFmt = computed(() => formatCash(summary.value.total_wechat_amount))
const alipayAmountFmt = computed(() => formatCash(summary.value.total_alipay_amount))
const cashAmountFmt = computed(() => formatCash(summary.value.total_cash_amount))

const monthBounds = computed(() => monthDayBounds(currentMonth.value))

const allGroups = computed<DailyGroup[]>(() => groupRecordsByDate(records.value))

const filteredGroups = computed(() =>
  detailFilterDate.value
    ? filterGroupsByDate(allGroups.value, detailFilterDate.value)
    : allGroups.value
)

const chartRows = computed(() => buildChartRows(records.value, currentMonth.value, chartMode.value))

const detailFilterLabel = computed(() =>
  detailFilterDate.value ? detailFilterDayLabel(detailFilterDate.value) : ''
)

async function loadMonthData(): Promise<void> {
  const month = currentMonth.value
  if (!month) return
  const seq = loadSeq.bump()
  loading.value = true
  try {
    const data = await getRecords({ month })
    if (loadSeq.isStale(seq)) return
    const s = data.summary ?? null
    summary.value = {
      total_revenue: Number(s?.total_revenue) || 0,
      total_wechat_amount: Number(s?.total_wechat_amount) || 0,
      total_alipay_amount: Number(s?.total_alipay_amount) || 0,
      total_cash_amount: Number(s?.total_cash_amount) || 0,
      total_wechat_qty: Number(s?.total_wechat_qty) || 0,
      total_alipay_qty: Number(s?.total_alipay_qty) || 0,
      total_cash_qty: Number(s?.total_cash_qty) || 0
    }
    records.value = Array.isArray(data.records) ? data.records : []

    // picker 指针：优先命中已选筛选日，否则本月默认
    if (!detailFilterDate.value) {
      detailDayPickerValue.value = defaultPickerDateInMonth(month)
    }
  } catch {
    if (loadSeq.isStale(seq)) return
    uni.showToast({ title: '数据加载失败，请稍后重试', icon: 'none' })
  } finally {
    if (!loadSeq.isStale(seq)) loading.value = false
  }
}

watch(currentMonth, next => {
  if (!next) return
  detailFilterDate.value = ''
  detailDayPickerValue.value = defaultPickerDateInMonth(next)
  void loadMonthData()
})

function goShiftDetail(payload: { id: number; date: string }) {
  if (!payload.id) return
  const qs = `id=${encodeURIComponent(String(payload.id))}${
    payload.date ? `&date=${encodeURIComponent(payload.date)}` : ''
  }`
  uni.navigateTo({ url: `/pages/shift-detail/index?${qs}` })
}

onShow(() => {
  if (!ensureReady()) return
  void loadMonthData()
})
</script>

<template>
  <view class="page">
    <ReportsMonthPicker v-model="currentMonth" />

    <ReportsHero :label="heroLabel" :amount="revenueFormatted" />

    <ReportsSummaryMetrics
      :wechat-amount="wechatAmountFmt"
      :alipay-amount="alipayAmountFmt"
      :cash-amount="cashAmountFmt"
      :wechat-qty="summary.total_wechat_qty"
      :alipay-qty="summary.total_alipay_qty"
      :cash-qty="summary.total_cash_qty"
    />

    <view class="section-head">
      <text class="section-title">营收趋势</text>
    </view>
    <ReportsTrendChart v-model:mode="chartMode" :rows="chartRows" />

    <view class="section-head section-head-spaced">
      <text class="section-title">每日班次明细</text>
    </view>
    <ReportsDayFilter
      v-model="detailFilterDate"
      v-model:pickerDate="detailDayPickerValue"
      :label="detailFilterLabel"
      :range-start="monthBounds.start"
      :range-end="monthBounds.end"
    />

    <block v-for="group in filteredGroups" :key="group.date">
      <ReportsDateGroup :group="group" @tap-shift="goShiftDetail" />
    </block>

    <view v-if="!filteredGroups.length && !loading && !detailFilterDate" class="list-empty">
      本月暂无班次记录
    </view>
    <view v-if="!filteredGroups.length && !loading && detailFilterDate" class="list-empty">
      该日暂无班次记录
    </view>

    <view class="bottom-spacer" />
  </view>
</template>

<style scoped>
.page {
  padding: 24rpx 40rpx 240rpx;
  background: #f9f9fb;
  min-height: 100vh;
}
.section-head {
  margin-bottom: 24rpx;
}
.section-head-spaced {
  margin-top: 16rpx;
  margin-bottom: 8rpx;
}
.section-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #1a1c1d;
  letter-spacing: -0.5rpx;
}
.list-empty {
  text-align: center;
  padding: 64rpx 0;
  color: #474747;
  font-size: 26rpx;
}
.bottom-spacer {
  height: 80rpx;
}
</style>
