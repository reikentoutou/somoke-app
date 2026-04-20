<script setup lang="ts">
/**
 * 顶部用户名片：头像首字母 + 昵称 + 角色，整块可点进入编辑。
 *
 * 事件命名为 `select` 而非 `tap`：避免父层 `@tap=` 编译出的 bindtap
 * 被原生 tap 与子组件 triggerEvent('tap') 同时触发两次。
 */
interface Props {
  avatar: string
  displayName: string
  roleText: string
}
defineProps<Props>()
defineEmits<{ (e: 'select'): void }>()
</script>

<template>
  <view class="card" hover-class="card-hover" @tap="$emit('select')">
    <view class="main">
      <view class="avatar">{{ avatar }}</view>
      <view class="text">
        <text class="name">{{ displayName }}</text>
        <text class="role">{{ roleText }}</text>
        <text class="hint">登录昵称；录入时的记账姓名在「记账姓名」里选</text>
      </view>
    </view>
    <view class="arrow">
      <text class="trailing">修改</text>
      <text class="chevron">›</text>
    </view>
  </view>
</template>

<style scoped>
.card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 24rpx;
  margin-bottom: 40rpx;
  padding: 40rpx 48rpx;
  background: #fff;
  border-radius: 48rpx;
  border: 2rpx solid rgba(0, 0, 0, 0.04);
}
.card-hover {
  opacity: 0.92;
}
.main {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
}
.avatar {
  width: 128rpx;
  height: 128rpx;
  border-radius: 50%;
  background: #f3f3f5;
  border: 2rpx solid #e8e8ea;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 48rpx;
  font-weight: 600;
  color: #1a1c1d;
  flex-shrink: 0;
}
.text {
  margin-left: 32rpx;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.name {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 8rpx;
  font-size: 32rpx;
  font-weight: 700;
  color: #1a1c1d;
}
.role {
  display: block;
  color: #474747;
  margin-bottom: 6rpx;
  font-size: 26rpx;
}
.hint {
  display: block;
  font-size: 22rpx;
  color: #5e5e63;
  line-height: 1.35;
}
.arrow {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  margin-left: 16rpx;
}
.trailing {
  color: #474747;
  font-size: 26rpx;
  margin-right: 8rpx;
}
.chevron {
  font-size: 40rpx;
  font-weight: 300;
  color: #c6c6c6;
  line-height: 1;
}
</style>
