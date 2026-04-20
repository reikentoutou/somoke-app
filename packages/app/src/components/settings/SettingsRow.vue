<script setup lang="ts">
/**
 * 设置项单行：左圆 icon / 中标题 + 可选 sub / 右 trailing + chevron。
 * 支持 `divider` 属性在自身上方绘制分割线，用于同卡内多行场景。
 *
 * 事件命名为 `select` 而非 `tap`：mp-weixin 里父层 `<SettingsRow @tap=...>`
 * 会把原生 bindtap 与子组件 `triggerEvent('tap')` 合并触发，导致 handler
 * 被调用两次（曾在 shift-detail 里复现为"双重 navigateTo"）。
 */
interface Props {
  icon: string
  label: string
  sub?: string
  trailing?: string
  divider?: boolean
}
withDefaults(defineProps<Props>(), { sub: '', trailing: '', divider: false })
defineEmits<{ (e: 'select'): void }>()
</script>

<template>
  <view v-if="divider" class="divider" />
  <view class="row" hover-class="row-hover" @tap="$emit('select')">
    <view class="icon">{{ icon }}</view>
    <view class="col">
      <text class="label">{{ label }}</text>
      <text v-if="sub" class="sub">{{ sub }}</text>
    </view>
    <text v-if="trailing" class="trailing">{{ trailing }}</text>
    <text class="chevron">›</text>
  </view>
</template>

<style scoped>
.row {
  display: flex;
  align-items: center;
  padding: 28rpx 40rpx;
  min-height: 96rpx;
  box-sizing: border-box;
}
.row-hover {
  opacity: 0.88;
}
.divider {
  height: 2rpx;
  background: #f3f3f5;
  margin: 0 40rpx;
}
.icon {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: #f3f3f5;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 30rpx;
  font-weight: 600;
  color: #474747;
  flex-shrink: 0;
}
.col {
  flex: 1;
  min-width: 0;
  margin-left: 24rpx;
  margin-right: 16rpx;
  display: flex;
  flex-direction: column;
  gap: 10rpx;
}
.label {
  color: #1a1c1d;
  font-weight: 500;
  font-size: 28rpx;
}
.sub {
  color: #474747;
  font-size: 26rpx;
}
.trailing {
  flex-shrink: 0;
  max-width: 46%;
  color: #474747;
  font-size: 26rpx;
  text-align: right;
  margin-right: 8rpx;
}
.chevron {
  font-size: 40rpx;
  font-weight: 300;
  color: #c6c6c6;
  line-height: 1;
  flex-shrink: 0;
}
</style>
