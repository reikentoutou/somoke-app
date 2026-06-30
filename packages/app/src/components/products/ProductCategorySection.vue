<script setup lang="ts">
import type { Product, ProductCategory } from '@somoke/shared'
import { formatCash } from '@/utils/money'

interface Props {
  category: ProductCategory
  products: Product[]
  canEdit: boolean
}
defineProps<Props>()

const emit = defineEmits<{
  (e: 'edit-category', id: number): void
  (e: 'disable-category', id: number): void
  (e: 'delete-category', id: number): void
  (e: 'add-product', categoryId: number): void
  (e: 'edit-product', id: number): void
  (e: 'disable-product', id: number): void
  (e: 'delete-product', id: number): void
}>()
</script>

<template>
  <view class="section">
    <view class="section-head">
      <view class="title-col">
        <view class="category-title-row">
          <text class="title">{{ category.name }}</text>
          <text v-if="category.is_active === 0" class="badge">已停用</text>
        </view>
        <text class="sub">{{ products.length }} 个商品</text>
      </view>
      <view v-if="canEdit" class="head-actions">
        <text class="link" @tap="emit('edit-category', category.id)">编辑</text>
        <text
          v-if="category.is_active !== 0"
          class="link"
          @tap="emit('disable-category', category.id)"
          >停用</text
        >
        <text class="link danger" @tap="emit('delete-category', category.id)">删除</text>
      </view>
    </view>

    <view v-if="!products.length" class="empty">该分类暂无商品</view>

    <view v-for="product in products" :key="product.id" class="product">
      <view class="info">
        <view class="name-row">
          <text class="name">{{ product.name }}</text>
          <text v-if="product.is_active === 0" class="badge">已停用</text>
        </view>
        <text class="meta">
          {{ formatCash(product.unit_price, '').replace(/\.00$/, '') }} 円/件 · 库存
          {{ product.current_stock }}
        </text>
      </view>
      <view v-if="canEdit" class="actions">
        <text v-if="category.is_active !== 0" class="action" @tap="emit('edit-product', product.id)"
          >编辑</text
        >
        <text
          v-if="category.is_active !== 0 && product.is_active !== 0"
          class="action"
          @tap="emit('disable-product', product.id)"
          >停用</text
        >
        <text class="action danger" @tap="emit('delete-product', product.id)">删除</text>
      </view>
    </view>

    <view
      v-if="canEdit && category.is_active !== 0"
      class="add"
      hover-class="add-hover"
      @tap="emit('add-product', category.id)"
    >
      + 添加商品
    </view>
  </view>
</template>

<style scoped>
.section {
  background: #fff;
  border-radius: 32rpx;
  padding: 28rpx 28rpx 24rpx;
  margin-bottom: 24rpx;
  border: 2rpx solid rgba(0, 0, 0, 0.04);
}
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 20rpx;
}
.title-col {
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}
.category-title-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
}
.title {
  font-size: 32rpx;
  font-weight: 700;
  color: #1a1c1d;
}
.sub {
  font-size: 22rpx;
  color: #8a8a8f;
}
.head-actions,
.actions {
  display: flex;
  gap: 18rpx;
  flex-shrink: 0;
}
.link,
.action {
  font-size: 24rpx;
  color: #1677ff;
}
.danger {
  color: #ba1a1a;
}
.empty {
  padding: 28rpx 0;
  text-align: center;
  color: #8a8a8f;
  font-size: 24rpx;
}
.product {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 22rpx 0;
  border-top: 2rpx solid #f3f3f5;
}
.info {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.name-row {
  display: flex;
  align-items: center;
  gap: 10rpx;
}
.name {
  font-size: 28rpx;
  font-weight: 600;
  color: #1a1c1d;
}
.badge {
  font-size: 20rpx;
  color: #8a8a8f;
  background: #f3f3f5;
  padding: 4rpx 10rpx;
  border-radius: 999rpx;
}
.meta {
  font-size: 22rpx;
  color: #5e5e63;
}
.add {
  margin-top: 20rpx;
  padding: 22rpx 20rpx;
  border-radius: 999rpx;
  text-align: center;
  color: #1a1c1d;
  border: 2rpx solid #1a1c1d;
  font-size: 26rpx;
  font-weight: 600;
}
.add-hover {
  background: #f9f9fb;
}
</style>
