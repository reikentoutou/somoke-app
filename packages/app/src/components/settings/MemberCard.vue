<script setup lang="ts">
import type { Role, StoreMember } from '@somoke/shared'
import type { MemberPermissions } from '@/utils/settings'
import { roleLabel } from '@/utils/settings'

/**
 * 团队成员卡片：昵称 / 角色 pill / 可执行的操作按钮。
 * 权限由父组件通过 `permissions` 传入（memberPermissions() 推导）。
 */

interface Props {
  member: StoreMember
  permissions: MemberPermissions
}
const props = defineProps<Props>()

const emit = defineEmits<{
  (e: 'remove', userId: number): void
  (e: 'set-role', userId: number, role: Role): void
  (e: 'leave'): void
}>()

function onRemove() {
  emit('remove', props.member.user_id)
}
function onPromote() {
  emit('set-role', props.member.user_id, 1)
}
function onDemote() {
  emit('set-role', props.member.user_id, 2)
}
function onLeave() {
  emit('leave')
}
</script>

<template>
  <view class="card">
    <view class="row">
      <text class="name">{{ member.nickname || '—' }}</text>
      <text class="pill">{{ roleLabel(member.role) }}</text>
    </view>
    <view
      v-if="
        permissions.canRemove ||
        permissions.canPromote ||
        permissions.canDemote ||
        permissions.canLeave
      "
      class="actions"
    >
      <text
        v-if="permissions.canRemove"
        class="action danger"
        hover-class="action-hover"
        @tap="onRemove"
        >移除</text
      >
      <text v-if="permissions.canPromote" class="action" hover-class="action-hover" @tap="onPromote"
        >设为管理员</text
      >
      <text v-if="permissions.canDemote" class="action" hover-class="action-hover" @tap="onDemote"
        >设为员工</text
      >
      <text
        v-if="permissions.canLeave"
        class="action danger"
        hover-class="action-hover"
        @tap="onLeave"
        >退出门店</text
      >
    </view>
  </view>
</template>

<style scoped>
.card {
  margin-bottom: 24rpx;
  padding: 28rpx 32rpx;
  background: #fff;
  border-radius: 32rpx;
  border: 2rpx solid rgba(0, 0, 0, 0.04);
}
.row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  flex-wrap: wrap;
}
.name {
  font-size: 32rpx;
  font-weight: 700;
  color: #1a1c1d;
}
.pill {
  padding: 6rpx 18rpx;
  border-radius: 999rpx;
  background: #f3f3f5;
  color: #474747;
  font-size: 22rpx;
}
.actions {
  margin-top: 20rpx;
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
}
.action {
  padding: 12rpx 24rpx;
  border-radius: 999rpx;
  background: #f3f3f5;
  color: #1a1c1d;
  font-size: 26rpx;
}
.action.danger {
  background: #fdeaea;
  color: #ba1a1a;
}
.action-hover {
  opacity: 0.82;
}
</style>
