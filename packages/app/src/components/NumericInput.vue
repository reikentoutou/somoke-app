<script setup lang="ts">
/**
 * 数字输入：支持整数/两位小数，绑定字符串 v-model（便于保留空串状态）。
 * 父组件拿到字符串后用 parseNonNegInt / parseNonNegFloat 做最终校验与转换。
 */
interface Props {
  modelValue: string
  placeholder?: string
  kind?: 'int' | 'float'
  label?: string
  suffix?: string
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '',
  kind: 'int',
  label: '',
  suffix: '',
  disabled: false
})

const emit = defineEmits<{ (e: 'update:modelValue', v: string): void }>()

function sanitize(raw: string): string {
  const allowed = props.kind === 'int' ? /[^0-9]/g : /[^0-9.]/g
  let s = raw.replace(allowed, '')
  if (props.kind === 'float') {
    const parts = s.split('.')
    if (parts.length > 2) s = parts[0] + '.' + parts.slice(1).join('')
    const m = s.match(/^(\d*)(\.\d{0,2})?/)
    if (m) s = (m[1] ?? '') + (m[2] ?? '')
  }
  return s
}

function onInput(e: Event) {
  // uni-app 的 input 事件 detail: { value: string }，DOM 侧是 InputEvent；统一做窄化处理
  const raw = (e as unknown as { detail?: { value?: string } }).detail?.value ?? ''
  const cleaned = sanitize(raw)
  emit('update:modelValue', cleaned)
}
</script>

<template>
  <view class="numeric-input">
    <text v-if="label" class="label">{{ label }}</text>
    <view class="field" :class="{ disabled }">
      <input
        class="ctrl"
        type="digit"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        @input="onInput"
      />
      <text v-if="suffix" class="suffix">{{ suffix }}</text>
    </view>
  </view>
</template>

<style scoped>
.numeric-input {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.label {
  font-size: 24rpx;
  color: #474747;
}
.field {
  display: flex;
  align-items: center;
  gap: 12rpx;
  background: #fff;
  border-radius: 16rpx;
  padding: 0 24rpx;
  height: 88rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}
.field.disabled {
  opacity: 0.5;
}
.ctrl {
  flex: 1;
  font-size: 32rpx;
}
.suffix {
  color: #8a8a8f;
  font-size: 26rpx;
}
</style>
