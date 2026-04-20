<script setup lang="ts">
import { computed } from 'vue'

/**
 * 记账员 picker：列表通过 props，选中姓名通过 v-model 双向绑定。
 * 父组件拿到新姓名后再决定是否写入 storage（composable 统一做）。
 */
interface Props {
  names: string[]
}
const props = defineProps<Props>()

const modelValue = defineModel<string>({ required: true })

const currentIndex = computed(() => {
  const ix = props.names.indexOf(modelValue.value)
  return ix < 0 ? 0 : ix
})

const display = computed(() => modelValue.value || props.names[0] || '请选择')

function onPick(e: Event) {
  const raw = (e as unknown as { detail?: { value?: string | number } }).detail?.value ?? 0
  const ix = Number.parseInt(String(raw), 10)
  const hit = props.names[Number.isFinite(ix) ? ix : 0]
  if (hit) modelValue.value = hit
}
</script>

<template>
  <view class="recorder">
    <text class="label">记账姓名</text>
    <picker mode="selector" :range="names" :value="currentIndex" @change="onPick">
      <view class="pick-display">
        <text class="display-text">{{ display }}</text>
        <text class="chev">›</text>
      </view>
    </picker>
  </view>
</template>

<style scoped>
.recorder {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  margin-top: 24rpx;
}
.label {
  font-size: 24rpx;
  color: #8a8a8f;
}
.pick-display {
  background: #fff;
  border-radius: 20rpx;
  padding: 24rpx;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}
.display-text {
  font-size: 32rpx;
  color: #1a1c1d;
  font-weight: 500;
}
.chev {
  color: #bfbfbf;
  font-size: 32rpx;
}
</style>
