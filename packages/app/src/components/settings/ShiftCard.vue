<script setup lang="ts">
import type { ShiftConfigListItem } from '@somoke/shared'

/** 单个班次卡片：显示名称 + 时间段，店长可点进入编辑。 */
interface Props {
  shift: ShiftConfigListItem
  canEdit?: boolean
}
withDefaults(defineProps<Props>(), { canEdit: false })
defineEmits<{ (e: 'edit', id: number): void }>()
</script>

<template>
  <view
    :class="['card', { tappable: canEdit }]"
    :hover-class="canEdit ? 'card-hover' : ''"
    @tap="canEdit && $emit('edit', shift.id)"
  >
    <view class="top">
      <text class="name">{{ shift.name }}</text>
      <text v-if="canEdit" class="edit-hint">编辑</text>
    </view>
    <text class="time">{{ shift.start_time }} — {{ shift.end_time }}</text>
  </view>
</template>

<style scoped>
.card {
  margin-bottom: 24rpx;
  display: flex;
  flex-direction: column;
  padding: 32rpx 40rpx;
  background: #fff;
  border-radius: 32rpx;
  border: 2rpx solid rgba(0, 0, 0, 0.04);
}
.card-hover {
  opacity: 0.92;
}
.top {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}
.name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 16rpx;
  font-size: 32rpx;
  font-weight: 700;
  color: #1a1c1d;
}
.edit-hint {
  flex-shrink: 0;
  color: #5e5e63;
  letter-spacing: 2rpx;
  font-size: 22rpx;
}
.time {
  display: block;
  color: #474747;
  font-size: 26rpx;
}
</style>
