<script setup lang="ts">
import { computed } from 'vue'

/**
 * 上下班 2x1 输入卡：数量或现金两种形态。
 * 字符串 v-model 两路绑定（openingValue / closingValue），
 * 父组件决定是否显示 prefill 提示（openingPrefillHint 可选）。
 */
export type OpeningClosingVariant = 'qty' | 'cash'

interface Props {
  variant: OpeningClosingVariant
  openingLabel?: string
  closingLabel?: string
  /** 已用当前库存/现金预填时，展示在卡片顶部的提示文案 */
  openingPrefillHint?: string
}

const props = withDefaults(defineProps<Props>(), {
  openingLabel: '',
  closingLabel: '',
  openingPrefillHint: ''
})

const openingValue = defineModel<string>('openingValue', { required: true })
const closingValue = defineModel<string>('closingValue', { required: true })

const inputType = computed(() => (props.variant === 'cash' ? 'digit' : 'number'))
const placeholder = computed(() => (props.variant === 'cash' ? '¥ 0.00' : '请输入'))

const resolvedOpeningLabel = computed(
  () => props.openingLabel || (props.variant === 'cash' ? '上班现金' : '上班数量')
)
const resolvedClosingLabel = computed(
  () => props.closingLabel || (props.variant === 'cash' ? '下班现金' : '下班数量')
)

function onOpeningInput(e: Event) {
  const v = (e as unknown as { detail?: { value?: string } }).detail?.value ?? ''
  openingValue.value = v
}
function onClosingInput(e: Event) {
  const v = (e as unknown as { detail?: { value?: string } }).detail?.value ?? ''
  closingValue.value = v
}
</script>

<template>
  <view class="oc-card" :class="`oc-card--${variant}`">
    <text v-if="variant === 'cash'" class="kicker">上下班现金</text>
    <text v-if="openingPrefillHint" class="prefill-hint">{{ openingPrefillHint }}</text>
    <view class="row">
      <view class="col">
        <text class="col-label">
          {{ resolvedOpeningLabel }}
          <text class="req">*</text>
        </text>
        <input
          class="input"
          :type="inputType"
          :placeholder="placeholder"
          :value="openingValue"
          @input="onOpeningInput"
        />
      </view>
      <view class="divider" />
      <view class="col">
        <text class="col-label">
          {{ resolvedClosingLabel }}
          <text class="req">*</text>
        </text>
        <input
          class="input input--right"
          :type="inputType"
          :placeholder="placeholder"
          :value="closingValue"
          @input="onClosingInput"
        />
      </view>
    </view>
  </view>
</template>

<style scoped>
.oc-card {
  background: #fff;
  border-radius: 20rpx;
  padding: 28rpx 24rpx;
  margin-top: 24rpx;
  box-shadow: 0 2rpx 8rpx rgba(0, 0, 0, 0.04);
}
.kicker {
  display: block;
  font-size: 24rpx;
  color: #8a8a8f;
  margin-bottom: 8rpx;
}
.prefill-hint {
  display: block;
  font-size: 22rpx;
  color: #237804;
  background: #f6ffed;
  padding: 8rpx 16rpx;
  border-radius: 8rpx;
  margin-bottom: 16rpx;
}
.row {
  display: flex;
  align-items: stretch;
  gap: 8rpx;
}
.col {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.divider {
  width: 1rpx;
  background: #f3f3f5;
}
.col-label {
  font-size: 24rpx;
  color: #474747;
}
.req {
  color: #ff4d4f;
  margin-left: 4rpx;
}
.input {
  font-size: 40rpx;
  font-weight: 600;
  color: #1a1c1d;
  height: 60rpx;
}
.input--right {
  text-align: right;
}
</style>
