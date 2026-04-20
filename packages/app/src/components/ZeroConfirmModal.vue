<script setup lang="ts">
/**
 * "当前库存/现金为 0，是否确认？" 确认框：迁自旧 ledger-record-form 里的二次确认逻辑。
 * 调用方用 v-model:open 双向绑定，confirm 事件用于继续提交。
 */
interface Props {
  open: boolean
  title?: string
  message?: string
  confirmText?: string
  cancelText?: string
}

withDefaults(defineProps<Props>(), {
  title: '确认提交',
  message: '当前库存/现金数值为 0，是否确认？',
  confirmText: '确认',
  cancelText: '再看看'
})

const emit = defineEmits<{
  (e: 'update:open', v: boolean): void
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

function close() {
  emit('update:open', false)
  emit('cancel')
}
function confirm() {
  emit('update:open', false)
  emit('confirm')
}
</script>

<template>
  <view v-if="open" class="mask" @tap="close">
    <view class="dialog" @tap.stop>
      <text class="title">{{ title }}</text>
      <text class="msg">{{ message }}</text>
      <view class="actions">
        <text class="btn ghost" @tap="close">{{ cancelText }}</text>
        <text class="btn primary" @tap="confirm">{{ confirmText }}</text>
      </view>
    </view>
  </view>
</template>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.dialog {
  width: 560rpx;
  background: #fff;
  border-radius: 24rpx;
  padding: 48rpx 40rpx 32rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}
.title {
  font-size: 32rpx;
  font-weight: 700;
}
.msg {
  font-size: 28rpx;
  color: #555;
  line-height: 1.6;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 16rpx;
  margin-top: 16rpx;
}
.btn {
  padding: 16rpx 32rpx;
  border-radius: 40rpx;
  font-size: 28rpx;
  font-weight: 600;
}
.btn.ghost {
  color: #474747;
  background: #f3f3f5;
}
.btn.primary {
  color: #fff;
  background: #1a1c1d;
}
</style>
