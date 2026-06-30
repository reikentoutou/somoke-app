<script setup lang="ts">
import { computed } from 'vue'
import type { ProductLedgerFormFields } from '@/utils/ledgerForm'
import { formatCash } from '@/utils/money'

const items = defineModel<ProductLedgerFormFields[]>('items', { required: true })

interface Group {
  key: string
  name: string
  rows: Array<{ row: ProductLedgerFormFields; index: number }>
}

const groups = computed<Group[]>(() => {
  const map = new Map<string, Group>()
  items.value.forEach((row, index) => {
    const key = `${row.categoryId}:${row.categoryName}`
    const group = map.get(key) ?? { key, name: row.categoryName || '未分类', rows: [] }
    group.rows.push({ row, index })
    map.set(key, group)
  })
  return Array.from(map.values())
})

function pickDigits(e: Event): string {
  const raw = (e as unknown as { detail?: { value?: string } }).detail?.value ?? ''
  return String(raw).replace(/[^0-9]/g, '')
}

function updateLine(index: number, key: keyof ProductLedgerFormFields, value: string) {
  const next = items.value.slice()
  const row = next[index]
  if (!row) return
  next[index] = { ...row, [key]: value }
  items.value = next
}
</script>

<template>
  <view class="products">
    <view class="head">
      <text class="title">商品销售</text>
      <text class="hint">每个商品独立盘点、计价与扣库存</text>
    </view>

    <view v-if="!items.length" class="empty">暂无启用商品，请先在设置中添加商品</view>

    <view v-for="group in groups" :key="group.key" class="group">
      <text class="group-title">{{ group.name }}</text>
      <view v-for="entry in group.rows" :key="entry.row.productId" class="card">
        <view class="product-head">
          <view class="name-col">
            <text class="product-name">{{ entry.row.productName }}</text>
            <text class="product-meta">
              {{ formatCash(entry.row.unitPrice, '').replace(/\.00$/, '') }} 円/件 · 当前库存
              {{ entry.row.currentStock }}
            </text>
          </view>
        </view>

        <view class="grid two">
          <view class="field">
            <text class="label">上班数量</text>
            <input
              class="input"
              type="number"
              placeholder="0"
              :value="entry.row.qtyOpening"
              @input="updateLine(entry.index, 'qtyOpening', pickDigits($event))"
            />
          </view>
          <view class="field">
            <text class="label">下班数量</text>
            <input
              class="input input--right"
              type="number"
              placeholder="0"
              :value="entry.row.qtyClosing"
              @input="updateLine(entry.index, 'qtyClosing', pickDigits($event))"
            />
          </view>
        </view>

        <view class="grid four">
          <view class="mini">
            <text class="mini-label">微信</text>
            <input
              class="mini-input"
              type="number"
              placeholder="0"
              :value="entry.row.soldWechat"
              @input="updateLine(entry.index, 'soldWechat', pickDigits($event))"
            />
          </view>
          <view class="mini">
            <text class="mini-label">支付宝</text>
            <input
              class="mini-input"
              type="number"
              placeholder="0"
              :value="entry.row.soldAlipay"
              @input="updateLine(entry.index, 'soldAlipay', pickDigits($event))"
            />
          </view>
          <view class="mini">
            <text class="mini-label">现金</text>
            <input
              class="mini-input"
              type="number"
              placeholder="0"
              :value="entry.row.soldCash"
              @input="updateLine(entry.index, 'soldCash', pickDigits($event))"
            />
          </view>
          <view class="mini">
            <text class="mini-label">赠送</text>
            <input
              class="mini-input"
              type="number"
              placeholder="0"
              :value="entry.row.qtyGift"
              @input="updateLine(entry.index, 'qtyGift', pickDigits($event))"
            />
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.products {
  margin-top: 32rpx;
  display: flex;
  flex-direction: column;
  gap: 18rpx;
}
.head {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}
.title {
  font-size: 28rpx;
  font-weight: 600;
  color: #1a1c1d;
}
.hint {
  font-size: 22rpx;
  color: #8a8a8f;
}
.empty {
  background: #fff;
  border-radius: 20rpx;
  padding: 40rpx 24rpx;
  color: #8a8a8f;
  font-size: 26rpx;
  text-align: center;
}
.group {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}
.group-title {
  font-size: 24rpx;
  color: #5e5e63;
  padding-left: 8rpx;
}
.card {
  background: #fff;
  border-radius: 20rpx;
  padding: 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}
.product-head {
  display: flex;
  justify-content: space-between;
  margin-bottom: 20rpx;
}
.name-col {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}
.product-name {
  font-size: 30rpx;
  font-weight: 600;
  color: #1a1c1d;
}
.product-meta {
  font-size: 22rpx;
  color: #8a8a8f;
}
.grid {
  display: grid;
  gap: 16rpx;
}
.two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.four {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-top: 18rpx;
}
.field,
.mini {
  min-width: 0;
}
.label,
.mini-label {
  display: block;
  font-size: 22rpx;
  color: #8a8a8f;
  margin-bottom: 8rpx;
}
.input {
  height: 56rpx;
  font-size: 34rpx;
  font-weight: 600;
  color: #1a1c1d;
}
.input--right {
  text-align: right;
}
.mini-input {
  width: 100%;
  height: 54rpx;
  background: #f9f9fb;
  border-radius: 12rpx;
  text-align: center;
  font-size: 28rpx;
  color: #1a1c1d;
}
</style>
