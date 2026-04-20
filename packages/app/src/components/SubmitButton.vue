<script setup lang="ts">
/**
 * 与 useSubmitLock 搭配的提交按钮：loading 时自动禁用。
 *
 * 事件命名为 `submit` 而非 `tap`：mp-weixin 里父层 `<SubmitButton @tap=...>`
 * 会编译成 `bindtap`，同时接到原生 tap 与子组件 `triggerEvent('tap')` 两次，
 * 导致 handler 被触发两遍。换成语义事件名可避开这个碰撞。
 */
interface Props {
  loading?: boolean
  disabled?: boolean
  text?: string
  loadingText?: string
}

withDefaults(defineProps<Props>(), {
  loading: false,
  disabled: false,
  text: '提交',
  loadingText: '提交中…'
})

defineEmits<{ (e: 'submit'): void }>()
</script>

<template>
  <button
    class="submit-btn"
    :class="{ disabled: disabled || loading }"
    :disabled="disabled || loading"
    @tap="$emit('submit')"
  >
    <text>{{ loading ? loadingText : text }}</text>
  </button>
</template>

<style scoped>
.submit-btn {
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 48rpx;
  font-size: 30rpx;
  font-weight: 600;
  text-align: center;
  background: #1a1c1d;
  color: #fff;
}
.submit-btn.disabled {
  opacity: 0.5;
}
</style>
