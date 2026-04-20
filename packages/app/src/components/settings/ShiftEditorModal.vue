<script setup lang="ts">
import type { ShiftFormValues } from '@/utils/settings'

/**
 * 班次编辑弹层：
 * - `v-model:visible` 控制显隐；
 * - `v-model:form` 双向绑定表单值（父组件装填）。
 * - 提交 / 停用 / 关闭 都是事件，由父组件去打 API，本组件只做 UI。
 */

interface Props {
  isAdd: boolean
  submitting?: boolean
}
const props = withDefaults(defineProps<Props>(), { submitting: false })

const visible = defineModel<boolean>('visible', { required: true })
const form = defineModel<ShiftFormValues>('form', { required: true })

const emit = defineEmits<{
  (e: 'submit'): void
  (e: 'delete'): void
  (e: 'close'): void
}>()

function pickInputValue(e: Event): string {
  return String((e as unknown as { detail?: { value?: string } }).detail?.value ?? '')
}

function onMaskTap() {
  if (props.submitting) return
  visible.value = false
  emit('close')
}

function onCancel() {
  if (props.submitting) return
  visible.value = false
  emit('close')
}

function onNameInput(e: Event) {
  form.value = { ...form.value, name: pickInputValue(e) }
}

function onSortInput(e: Event) {
  form.value = { ...form.value, sort: pickInputValue(e) }
}

function onStartChange(e: Event) {
  form.value = { ...form.value, start: pickInputValue(e) || '09:00' }
}

function onEndChange(e: Event) {
  form.value = { ...form.value, end: pickInputValue(e) || '18:00' }
}
</script>

<template>
  <view v-if="visible" class="mask" @tap="onMaskTap">
    <view class="panel" @tap.stop>
      <text class="title">{{ isAdd ? '新增班次' : '编辑班次' }}</text>

      <scroll-view scroll-y class="body">
        <view class="field">
          <text class="label">名称</text>
          <input
            class="input"
            maxlength="32"
            placeholder="如 早班"
            :value="form.name"
            @input="onNameInput"
          />
        </view>

        <view class="row">
          <view class="field half">
            <text class="label">上班时间</text>
            <picker mode="time" :value="form.start" @change="onStartChange">
              <view class="picker-val">{{ form.start }}</view>
            </picker>
          </view>
          <view class="field half">
            <text class="label">下班时间</text>
            <picker mode="time" :value="form.end" @change="onEndChange">
              <view class="picker-val">{{ form.end }}</view>
            </picker>
          </view>
        </view>

        <view class="field last">
          <text class="label">排序</text>
          <input
            class="input"
            type="number"
            placeholder="数字越小越靠前"
            :value="form.sort"
            @input="onSortInput"
          />
        </view>
      </scroll-view>

      <view class="actions">
        <view v-if="!isAdd" class="delete-text" @tap.stop="emit('delete')">停用此班次</view>
        <view :class="['save-btn', { disabled: submitting }]" @tap.stop="emit('submit')">{{
          submitting ? '保存中…' : '保存'
        }}</view>
      </view>
      <text class="cancel" @tap.stop="onCancel">取消</text>
    </view>
  </view>
</template>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  background: rgba(26, 28, 29, 0.5);
  z-index: 10040;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48rpx 32rpx;
  box-sizing: border-box;
}
.panel {
  width: 100%;
  max-width: 640rpx;
  max-height: calc(100vh - 120rpx);
  background: #fff;
  border-radius: 32rpx;
  padding: 40rpx 36rpx 32rpx;
  box-sizing: border-box;
  box-shadow: 0 24rpx 80rpx rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  min-height: 0;
}
.title {
  display: block;
  flex-shrink: 0;
  font-size: 36rpx;
  font-weight: 600;
  color: #1a1c1d;
  margin-bottom: 28rpx;
}
.body {
  flex: 1;
  min-height: 0;
  max-height: 52vh;
}
.field {
  margin-bottom: 32rpx;
}
.field.last {
  margin-bottom: 0;
}
.label {
  display: block;
  margin-bottom: 16rpx;
  color: #5e5e63;
  font-size: 24rpx;
}
.input {
  display: block;
  width: 100%;
  min-width: 0;
  padding: 22rpx 0 20rpx;
  min-height: 44rpx;
  line-height: 1.45;
  border-bottom: 2rpx solid #e8e8ea;
  color: #1a1c1d;
  box-sizing: border-box;
  font-size: 28rpx;
}
.row {
  display: flex;
  gap: 32rpx;
  margin-bottom: 32rpx;
}
.half {
  flex: 1;
  min-width: 0;
  margin-bottom: 0;
}
.picker-val {
  display: block;
  width: 100%;
  padding: 22rpx 0 20rpx;
  min-height: 44rpx;
  line-height: 1.45;
  border-bottom: 2rpx solid #e8e8ea;
  color: #1a1c1d;
  font-size: 28rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.actions {
  flex-shrink: 0;
  margin-top: 36rpx;
}
.delete-text {
  text-align: center;
  color: #ba1a1a;
  margin-bottom: 24rpx;
  padding: 12rpx;
  font-size: 26rpx;
}
.save-btn {
  width: 100%;
  text-align: center;
  padding: 26rpx 24rpx;
  font-size: 30rpx;
  font-weight: 600;
  color: #fff;
  background: #1a1c1d;
  border-radius: 999rpx;
  box-sizing: border-box;
}
.save-btn.disabled {
  opacity: 0.55;
}
.cancel {
  display: block;
  text-align: center;
  margin-top: 24rpx;
  color: #5e5e63;
  padding: 12rpx;
  font-size: 26rpx;
}
</style>
