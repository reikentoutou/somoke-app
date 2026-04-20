<script setup lang="ts">
import { computed } from 'vue'
import { ACTION_CONFIG, type OpsActionKey } from '@/utils/stockLedger'

/**
 * 操作弹窗：
 * - `v-model:visible` 控制显隐；
 * - `action` 决定展示哪种输入与文案（restock / withdraw / adjust_stock / adjust_cash）；
 * - 输入值通过 `v-model:valStock` / `v-model:valCash` / `v-model:note` 双向绑定。
 * - 本组件不做业务校验，只负责 UI；父组件在 submit 时调 utils.validateActionPayload。
 */

interface Props {
  action: OpsActionKey
  submitting?: boolean
}
const props = withDefaults(defineProps<Props>(), { submitting: false })

const visible = defineModel<boolean>('visible', { required: true })
const valStock = defineModel<string>('valStock', { default: '' })
const valCash = defineModel<string>('valCash', { default: '' })
const note = defineModel<string>('note', { default: '' })

const emit = defineEmits<{ (e: 'submit'): void; (e: 'close'): void }>()

const cfg = computed(() => ACTION_CONFIG[props.action])
const useStockInput = computed(() => cfg.value.inputType === 'stock')

function onMaskTap() {
  if (!props.submitting) {
    visible.value = false
    emit('close')
  }
}

function onCancel() {
  if (props.submitting) return
  visible.value = false
  emit('close')
}

function onConfirm() {
  if (props.submitting) return
  emit('submit')
}
</script>

<template>
  <view v-if="visible" class="mask" @tap="onMaskTap">
    <view class="panel" @tap.stop>
      <view class="head">
        <text class="title">{{ cfg.title }}</text>
        <text class="sub">{{ cfg.sub }}</text>
      </view>

      <view class="body">
        <view class="group">
          <text class="label">{{ cfg.inputLabel }}</text>
          <input
            v-if="useStockInput"
            v-model="valStock"
            class="input"
            type="number"
            :placeholder="cfg.placeholder"
          />
          <input
            v-else
            v-model="valCash"
            class="input"
            type="digit"
            :placeholder="cfg.placeholder"
          />
        </view>

        <view class="group">
          <text class="label">备注（选填）</text>
          <input v-model="note" class="input" type="text" placeholder="留个理由，方便日后回查" />
        </view>
      </view>

      <view class="foot">
        <button
          class="btn cancel"
          :class="{ 'is-disabled': submitting }"
          :disabled="submitting"
          @tap="onCancel"
        >
          取消
        </button>
        <button
          class="btn confirm"
          :class="{ 'is-disabled': submitting }"
          :disabled="submitting"
          @tap="onConfirm"
        >
          {{ submitting ? '提交中…' : '确认' }}
        </button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 999;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48rpx;
}
.panel {
  width: 100%;
  background: #fff;
  border-radius: 48rpx;
  overflow: hidden;
}
.head {
  padding: 48rpx 48rpx 24rpx;
}
.title {
  font-size: 40rpx;
  font-weight: 700;
  color: #1a1c1d;
}
.sub {
  display: block;
  margin-top: 12rpx;
  font-size: 24rpx;
  color: #8a8a8f;
  line-height: 1.4;
}
.body {
  padding: 16rpx 48rpx 0;
}
.group {
  margin-bottom: 32rpx;
}
.label {
  display: block;
  margin-bottom: 16rpx;
  font-size: 24rpx;
  color: #474747;
}
.input {
  width: 100%;
  height: 96rpx;
  background: #f3f3f5;
  border-radius: 24rpx;
  padding: 0 32rpx;
  box-sizing: border-box;
  font-size: 32rpx;
  color: #1a1c1d;
}
.foot {
  display: flex;
  flex-direction: row;
  padding: 32rpx 48rpx 48rpx;
  gap: 24rpx;
}
.btn {
  flex: 1;
  height: 96rpx;
  border-radius: 999rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  font-weight: 600;
  margin: 0;
  border: none;
}
.btn.is-disabled {
  opacity: 0.6;
}
.cancel {
  background: #f3f3f5;
  color: #474747;
}
.confirm {
  background: #1a1c1d;
  color: #fff;
}
</style>
