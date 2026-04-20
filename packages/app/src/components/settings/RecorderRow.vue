<script setup lang="ts">
/** 记账姓名行：左标题 + 右（店长可见）删除按钮。 */
interface Props {
  name: string
  canDelete?: boolean
}
withDefaults(defineProps<Props>(), { canDelete: false })
defineEmits<{ (e: 'delete', name: string): void }>()
</script>

<template>
  <view class="row">
    <text class="name">{{ name }}</text>
    <text v-if="canDelete" class="del" hover-class="del-hover" @tap="$emit('delete', name)"
      >删除</text
    >
  </view>
</template>

<style scoped>
.row {
  margin-bottom: 16rpx;
  padding: 28rpx 32rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border-radius: 24rpx;
  border: 2rpx solid rgba(0, 0, 0, 0.04);
}
.name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 16rpx;
  font-size: 30rpx;
  font-weight: 600;
  color: #1a1c1d;
}
.del {
  color: #ba1a1a;
  font-size: 26rpx;
  padding: 8rpx 16rpx;
}
.del-hover {
  opacity: 0.8;
}
</style>
