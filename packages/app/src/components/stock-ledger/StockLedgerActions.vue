<script setup lang="ts">
import type { OpsActionKey } from '@/utils/stockLedger'

/**
 * 顶部四格快捷操作。
 * - 点击后 emit `action` 事件，父组件负责打开 ActionModal。
 * - 只有店长可见（由父组件控制 mounted 条件）。
 */

interface ActionItem {
  key: OpsActionKey
  label: string
  initial: string
}

const ACTIONS: readonly ActionItem[] = [
  { key: 'restock', label: '进货', initial: '进' },
  { key: 'withdraw', label: '取现', initial: '取' },
  { key: 'adjust_stock', label: '库存校准', initial: '库' },
  { key: 'adjust_cash', label: '现金校准', initial: '现' }
] as const

const emit = defineEmits<{ (e: 'action', key: OpsActionKey): void }>()

function onTap(key: OpsActionKey) {
  emit('action', key)
}
</script>

<template>
  <view class="actions">
    <view v-for="a in ACTIONS" :key="a.key" class="btn" hover-class="btn-hover" @tap="onTap(a.key)">
      <view class="icon">{{ a.initial }}</view>
      <text class="text">{{ a.label }}</text>
    </view>
  </view>
</template>

<style scoped>
.actions {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16rpx;
  margin-bottom: 56rpx;
}
.btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32rpx 0;
  border-radius: 32rpx;
  background: #fff;
  border: 2rpx solid rgba(0, 0, 0, 0.04);
}
.btn-hover {
  background: #f9f9fb;
}
.icon {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
  background: #f3f3f5;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28rpx;
  font-weight: 700;
  color: #1a1c1d;
  margin-bottom: 16rpx;
}
.text {
  font-size: 24rpx;
  font-weight: 600;
  color: #474747;
}
</style>
