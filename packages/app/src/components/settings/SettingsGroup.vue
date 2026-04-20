<script setup lang="ts">
/** 设置分组：label + 卡片容器；行与分割线由 slot 里的 SettingsRow 提供。 */
interface Props {
  label?: string
}
defineProps<Props>()
</script>

<template>
  <text v-if="label" class="label">{{ label }}</text>
  <view class="card">
    <slot />
  </view>
</template>

<style scoped>
.label {
  display: block;
  margin: 32rpx 8rpx 16rpx;
  font-size: 22rpx;
  color: #5e5e63;
}
.card {
  background: #fff;
  border-radius: 48rpx;
  border: 2rpx solid rgba(0, 0, 0, 0.04);
  overflow: hidden;
  margin-bottom: 8rpx;
}
</style>
