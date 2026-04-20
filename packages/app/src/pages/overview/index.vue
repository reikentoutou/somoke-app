<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import type { ShiftRecord } from '@somoke/shared'
import { recordApi } from '@/api'
import { useSession } from '@/composables/useSession'
import { useLoadSeq } from '@/composables/useLoadSeq'
import { useCurrentStore } from '@/composables/useCurrentStore'
import { useTabBarSync } from '@/composables/useTabBarSync'
import { computePaymentMix } from '@/utils/ledgerForm'
import { formatCash } from '@/utils/money'
import { formatDate } from '@/utils/date'
import OverviewHero from '@/components/overview/OverviewHero.vue'
import OverviewChannelCards from '@/components/overview/OverviewChannelCards.vue'
import OverviewShiftItem, { type ShiftIconTone } from '@/components/overview/OverviewShiftItem.vue'

/**
 * 今日概览：
 * - 页面只负责会话守卫 + 拉取今日数据 + 组合 3 个子组件（hero/channels/shift-list）。
 * - 数据装饰（iconChar/iconTone/timeRange 等）在 computed 里做，不污染组件。
 */

const { ensureReady } = useSession()
const { displayName } = useCurrentStore()
useTabBarSync(0)

const loadSeq = useLoadSeq()
const loading = ref(false)
const loadError = ref(false)
const todayDate = ref(formatDate(new Date()))

interface Summary {
  total_revenue: number
  wechat_qty: number
  alipay_qty: number
  cash_qty: number
  wechat_amount: number
  alipay_amount: number
  cash_amount: number
}

const summary = ref<Summary>({
  total_revenue: 0,
  wechat_qty: 0,
  alipay_qty: 0,
  cash_qty: 0,
  wechat_amount: 0,
  alipay_amount: 0,
  cash_amount: 0
})

const records = shallowRef<ShiftRecord[]>([])

const currency = '¥'

const heroAmount = computed(() => formatCash(summary.value.total_revenue))

const mix = computed(() =>
  computePaymentMix(summary.value.wechat_qty, summary.value.alipay_qty, summary.value.cash_qty)
)

const channelRows = computed(() => [
  {
    key: 'wechat' as const,
    label: '微信',
    amount: formatCash(summary.value.wechat_amount),
    qty: summary.value.wechat_qty,
    pct: mix.value.payPctW,
    hasVolume: summary.value.wechat_qty > 0
  },
  {
    key: 'alipay' as const,
    label: '支付宝',
    amount: formatCash(summary.value.alipay_amount),
    qty: summary.value.alipay_qty,
    pct: mix.value.payPctA,
    hasVolume: summary.value.alipay_qty > 0
  },
  {
    key: 'cash' as const,
    label: '现金',
    amount: formatCash(summary.value.cash_amount),
    qty: summary.value.cash_qty,
    pct: mix.value.payPctC,
    hasVolume: summary.value.cash_qty > 0
  }
])

function iconToneFor(name: string): ShiftIconTone {
  if (/早|晨/.test(name)) return 'morning'
  if (/晚|夜/.test(name)) return 'night'
  if (/白|中/.test(name)) return 'day'
  return 'neutral'
}

function trimTime(t: string | undefined): string {
  const s = String(t ?? '')
  return s.length >= 5 ? s.slice(0, 5) : s
}

const decoratedRecords = computed(() =>
  records.value.map(r => ({
    id: r.id,
    shiftName: r.shift_name || '未知班次',
    timeRange: `${trimTime(r.shift_start)} - ${trimTime(r.shift_end)}`,
    iconChar: (r.shift_name || '班').charAt(0),
    iconTone: iconToneFor(r.shift_name || ''),
    recorderName: r.recorder_name || '—',
    qtySold: r.qty_sold ?? 0,
    revenueText: formatCash(r.total_revenue),
    recordDate: r.record_date
  }))
)

const isEmpty = computed(() => !loading.value && records.value.length === 0 && !loadError.value)

async function loadToday(): Promise<void> {
  const seq = loadSeq.bump()
  loading.value = true
  loadError.value = false
  const today = formatDate(new Date())
  todayDate.value = today
  try {
    const res = await recordApi.getRecords({ date: today })
    if (loadSeq.isStale(seq)) return
    const s = res.summary ?? null
    summary.value = {
      total_revenue: Number(s?.total_revenue) || 0,
      wechat_qty: Number(s?.total_wechat_qty) || 0,
      alipay_qty: Number(s?.total_alipay_qty) || 0,
      cash_qty: Number(s?.total_cash_qty) || 0,
      wechat_amount: Number(s?.total_wechat_amount) || 0,
      alipay_amount: Number(s?.total_alipay_amount) || 0,
      cash_amount: Number(s?.total_cash_amount) || 0
    }
    records.value = Array.isArray(res.records) ? res.records : []
  } catch {
    if (loadSeq.isStale(seq)) return
    loadError.value = true
    uni.showToast({ title: '数据加载失败，请稍后重试', icon: 'none' })
  } finally {
    if (!loadSeq.isStale(seq)) loading.value = false
  }
}

onShow(() => {
  if (!ensureReady()) return
  uni.setNavigationBarTitle({ title: displayName.value || '今日概览' })
  void loadToday()
})

function goShiftDetail(id: number) {
  // 子组件只会 emit 数值 id；这里再做一次收紧，避免事件改名后又接到
  // 非数值（比如原生事件对象）静默跳到 shift-detail 再报"缺少记录参数"。
  const numericId = Number(id)
  if (!Number.isFinite(numericId) || numericId <= 0) return
  const item = decoratedRecords.value.find(x => x.id === numericId)
  const qs = `id=${encodeURIComponent(String(numericId))}${
    item?.recordDate ? `&date=${encodeURIComponent(item.recordDate)}` : ''
  }`
  uni.navigateTo({ url: `/pages/shift-detail/index?${qs}` })
}

function goViewAll() {
  uni.switchTab({ url: '/pages/reports/index' })
}
</script>

<template>
  <view class="overview">
    <OverviewHero :currency="currency" :amount="heroAmount" />

    <OverviewChannelCards :currency="currency" :rows="channelRows" :show-mix="mix.showPaymentMix" />

    <view class="section">
      <view class="section-head">
        <text class="section-title">班次详情</text>
        <text class="section-link" @tap="goViewAll">查看全部</text>
      </view>

      <view v-if="isEmpty" class="empty">
        <text>今日暂无班次记录</text>
      </view>

      <view v-else-if="loadError" class="empty empty--err">
        <text>加载失败，请稍后重试</text>
      </view>

      <view v-else class="list">
        <OverviewShiftItem
          v-for="row in decoratedRecords"
          :key="row.id"
          :id="row.id"
          :icon-char="row.iconChar"
          :icon-tone="row.iconTone"
          :shift-name="row.shiftName"
          :time-range="row.timeRange"
          :recorder-name="row.recorderName"
          :qty-sold="row.qtySold"
          :revenue-text="row.revenueText"
          :currency="currency"
          @open="goShiftDetail"
        />
      </view>
    </view>

    <view class="spacer" />
  </view>
</template>

<style scoped>
.overview {
  min-height: 100vh;
  background: #f9f9fb;
  padding-bottom: 160rpx;
}
.section {
  padding: 32rpx 24rpx 0;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 0 8rpx;
}
.section-title {
  font-size: 32rpx;
  font-weight: 700;
  color: #1a1c1d;
}
.section-link {
  font-size: 26rpx;
  color: #1677ff;
}
.list {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}
.empty {
  background: #fff;
  border-radius: 20rpx;
  padding: 48rpx;
  text-align: center;
  font-size: 26rpx;
  color: #8a8a8f;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
}
.empty--err {
  color: #ff4d4f;
}
.spacer {
  height: 80rpx;
}
</style>
