<script setup lang="ts">
/**
 * 单个班次条目。只做展示；点击由父页面处理跳转。
 * 不直接依赖 ShiftRecord 类型，接受装饰后的 props，保持组件解耦。
 *
 * 注意：自定义事件名有意不取 `tap` —— 在 mp-weixin 下，`bindtap` 既会捕获
 * 原生冒泡的点击事件（payload 为 WechatMiniprogram.Event），也会捕获
 * `triggerEvent('tap', ...)`，两者都会打到父组件的 @tap 回调里。父组件
 * 的 handler 拿到的参数会是"原生事件对象"而非 id，从而导致拼出
 * `/pages/shift-detail/index?id=[object%20Object]`、目标页报「缺少记录参数」。
 */
export type ShiftIconTone = 'morning' | 'day' | 'night' | 'neutral'

interface Props {
  id: number
  iconChar: string
  iconTone: ShiftIconTone
  shiftName: string
  timeRange: string
  recorderName: string
  qtySold: number
  revenueText: string
  currency: string
}
const props = defineProps<Props>()
const emit = defineEmits<{ (e: 'open', id: number): void }>()

const onTap = () => emit('open', props.id)
</script>

<template>
  <view class="item" @tap="onTap">
    <view class="icon" :class="`icon--${iconTone}`">
      <text class="icon-text">{{ iconChar }}</text>
    </view>
    <view class="main">
      <view class="row row--head">
        <text class="name">{{ shiftName }}</text>
        <text class="revenue">{{ currency }} {{ revenueText }}</text>
      </view>
      <text class="time">{{ timeRange }}</text>
      <view class="row row--foot">
        <text class="recorder">{{ recorderName }}</text>
        <text class="qty">已售 {{ qtySold }} 件</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.item {
  background: #fff;
  border-radius: 20rpx;
  padding: 24rpx;
  display: flex;
  gap: 20rpx;
  box-shadow: 0 4rpx 16rpx rgba(0, 0, 0, 0.04);
}
.icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 28rpx;
  font-weight: 700;
}
.icon--morning {
  background: #faad14;
}
.icon--day {
  background: #1677ff;
}
.icon--night {
  background: #13c2c2;
}
.icon--neutral {
  background: #474747;
}
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}
.row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}
.name {
  font-size: 30rpx;
  font-weight: 600;
  color: #1a1c1d;
}
.revenue {
  font-size: 28rpx;
  font-weight: 600;
  color: #237804;
}
.time {
  font-size: 22rpx;
  color: #8a8a8f;
}
.recorder,
.qty {
  font-size: 22rpx;
  color: #474747;
}
</style>
