<script setup lang="ts">
import { computed } from 'vue'
import type { LedgerSummary } from '@/utils/ledgerForm'
import { formatCash } from '@/utils/money'

/**
 * 预估报告卡片：全部为派生态，不维护本地状态。
 * revenue 用 formatCash 做千分位（保留 0 位小数，日元整数）。
 */
interface Props {
  summary: LedgerSummary
}
const props = defineProps<Props>()

const revenueText = computed(() => {
  const n = props.summary.totalRevenueJpy
  return formatCash(n, '').replace(/\.00$/, '')
})
</script>

<template>
  <view class="summary">
    <text class="title">结果预估报告</text>

    <view class="total">
      <view class="total-head">
        <text class="hint">支付渠道售出合计（件）</text>
        <text class="big">{{ summary.paymentSoldTotal }}</text>
      </view>
      <text class="formula"> 营业额按每个商品的价格快照分别计算；赠送不计入收入 </text>
    </view>

    <view class="revenue">
      <text class="hint">预估营业额</text>
      <text class="amount">{{ revenueText }} 円</text>
    </view>

    <view class="inventory">
      <text class="inventory-text">
        盘点：上班−下班−赠送 = {{ summary.qtySold }} 件（与支付合计可对账）
      </text>
    </view>

    <view v-if="summary.productRows.length" class="product-list">
      <view v-for="row in summary.productRows" :key="row.productId" class="product-row">
        <view class="product-main">
          <text class="product-name">{{ row.productName }}</text>
          <text class="product-sub"
            >{{ row.categoryName }} · 售出 {{ row.paymentSoldTotal }} 件</text
          >
        </view>
        <text class="product-amount"
          >{{ formatCash(row.totalRevenueJpy, '').replace(/\.00$/, '') }} 円</text
        >
      </view>
    </view>

    <view v-if="summary.hasSoftWarnings" class="warn">
      <text class="warn-title">核对提醒（仍可提交）</text>
      <text v-for="(line, idx) in summary.softWarnings || []" :key="idx" class="warn-line">
        · {{ line }}
      </text>
    </view>
  </view>
</template>

<style scoped>
.summary {
  margin-top: 32rpx;
  background: #fff;
  border-radius: 20rpx;
  padding: 28rpx 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.title {
  font-size: 28rpx;
  font-weight: 600;
  color: #1a1c1d;
}
.total {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}
.total-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.hint {
  font-size: 24rpx;
  color: #8a8a8f;
}
.big {
  font-size: 48rpx;
  font-weight: 700;
  color: #1677ff;
}
.formula {
  font-size: 22rpx;
  color: #8a8a8f;
}
.revenue {
  background: #f6ffed;
  border-radius: 16rpx;
  padding: 20rpx 24rpx;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}
.amount {
  font-size: 44rpx;
  font-weight: 700;
  color: #237804;
}
.inventory-text {
  font-size: 22rpx;
  color: #8a8a8f;
}
.product-list {
  display: flex;
  flex-direction: column;
  gap: 10rpx;
  border-top: 2rpx solid #f3f3f5;
  padding-top: 14rpx;
}
.product-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
}
.product-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}
.product-name {
  font-size: 24rpx;
  color: #1a1c1d;
  font-weight: 600;
}
.product-sub {
  font-size: 22rpx;
  color: #8a8a8f;
}
.product-amount {
  flex-shrink: 0;
  font-size: 24rpx;
  color: #237804;
  font-weight: 600;
}
.warn {
  background: #fff7e6;
  border: 1rpx solid #ffd591;
  border-radius: 12rpx;
  padding: 16rpx;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}
.warn-title {
  font-size: 24rpx;
  font-weight: 600;
  color: #d46b08;
}
.warn-line {
  font-size: 22rpx;
  color: #474747;
  line-height: 1.45;
}
</style>
