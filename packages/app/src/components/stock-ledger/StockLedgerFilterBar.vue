<script setup lang="ts">
import { CATEGORY_TABS, type LedgerCategory } from '@/utils/stockLedger'

/** 类目筛选 pill 条。v-model 绑定当前类目 key。 */

const model = defineModel<LedgerCategory>({ required: true })

function onTap(key: LedgerCategory) {
  if (model.value !== key) model.value = key
}
</script>

<template>
  <scroll-view class="bar" scroll-x :show-scrollbar="false">
    <view
      v-for="tab in CATEGORY_TABS"
      :key="tab.key"
      :class="['pill', { active: model === tab.key }]"
      @tap="onTap(tab.key)"
    >
      <text>{{ tab.label }}</text>
    </view>
  </scroll-view>
</template>

<style scoped>
.bar {
  white-space: nowrap;
  margin-bottom: 28rpx;
  padding-bottom: 4rpx;
}
.pill {
  display: inline-block;
  padding: 14rpx 28rpx;
  margin-right: 12rpx;
  border-radius: 999rpx;
  font-size: 26rpx;
  font-weight: 500;
  color: #474747;
  background: #f3f3f5;
  border: 2rpx solid transparent;
}
.pill.active {
  background: #1a1c1d;
  color: #fff;
  border-color: #1a1c1d;
}
</style>
