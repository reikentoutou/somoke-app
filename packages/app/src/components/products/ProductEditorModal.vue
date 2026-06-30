<script setup lang="ts">
import { computed } from 'vue'
import type { ProductCategory } from '@somoke/shared'

export type ProductEditorMode = 'category' | 'product'

export interface ProductEditorForm {
  id: number
  categoryId: number
  name: string
  unitPrice: string
  sortOrder: string
}

interface Props {
  mode: ProductEditorMode
  categories: ProductCategory[]
  submitting?: boolean
}
const props = withDefaults(defineProps<Props>(), { submitting: false })

const visible = defineModel<boolean>('visible', { required: true })
const form = defineModel<ProductEditorForm>('form', { required: true })

const emit = defineEmits<{ (e: 'submit'): void; (e: 'close'): void }>()

const title = computed(() => {
  if (props.mode === 'category') return form.value.id ? '编辑分类' : '新增分类'
  return form.value.id ? '编辑商品' : '新增商品'
})

const categoryIndex = computed(() => {
  const ix = props.categories.findIndex(c => c.id === form.value.categoryId)
  return ix < 0 ? 0 : ix
})

function pickValue(e: Event): string {
  return String((e as unknown as { detail?: { value?: string | number } }).detail?.value ?? '')
}

function onCategoryPick(e: Event) {
  const ix = Number.parseInt(pickValue(e), 10)
  const hit = props.categories[Number.isFinite(ix) ? ix : 0]
  if (hit) form.value = { ...form.value, categoryId: hit.id }
}

function close() {
  if (props.submitting) return
  visible.value = false
  emit('close')
}
</script>

<template>
  <view v-if="visible" class="mask" @tap="close">
    <view class="panel" @tap.stop>
      <text class="title">{{ title }}</text>

      <view class="field">
        <text class="label">名称</text>
        <input v-model="form.name" class="input" maxlength="64" placeholder="请输入名称" />
      </view>

      <block v-if="mode === 'product'">
        <view class="field">
          <text class="label">分类</text>
          <picker
            mode="selector"
            :range="categories"
            range-key="name"
            :value="categoryIndex"
            @change="onCategoryPick"
          >
            <view class="picker-val">{{ categories[categoryIndex]?.name || '请选择分类' }}</view>
          </picker>
        </view>
        <view class="field">
          <text class="label">价格（円/件）</text>
          <input v-model="form.unitPrice" class="input" type="digit" placeholder="如 3000" />
        </view>
        <text class="form-hint">库存请到「库存与现金」里补货或校准。</text>
      </block>

      <view class="field">
        <text class="label">排序</text>
        <input v-model="form.sortOrder" class="input" type="number" placeholder="数字越小越靠前" />
      </view>

      <view class="actions">
        <button class="btn cancel" :disabled="submitting" @tap="close">取消</button>
        <button class="btn confirm" :disabled="submitting" @tap="emit('submit')">
          {{ submitting ? '保存中…' : '保存' }}
        </button>
      </view>
    </view>
  </view>
</template>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  z-index: 10040;
  background: rgba(26, 28, 29, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 48rpx 32rpx;
  box-sizing: border-box;
}
.panel {
  width: 100%;
  max-width: 640rpx;
  background: #fff;
  border-radius: 32rpx;
  padding: 40rpx 36rpx 32rpx;
  box-sizing: border-box;
}
.title {
  display: block;
  margin-bottom: 28rpx;
  font-size: 36rpx;
  font-weight: 700;
  color: #1a1c1d;
}
.field {
  margin-bottom: 28rpx;
}
.label {
  display: block;
  margin-bottom: 14rpx;
  color: #5e5e63;
  font-size: 24rpx;
}
.input,
.picker-val {
  display: block;
  width: 100%;
  min-height: 48rpx;
  padding: 20rpx 0;
  border-bottom: 2rpx solid #e8e8ea;
  box-sizing: border-box;
  color: #1a1c1d;
  font-size: 28rpx;
}
.form-hint {
  display: block;
  margin: -8rpx 0 28rpx;
  color: #75757a;
  font-size: 24rpx;
  line-height: 1.5;
}
.actions {
  display: flex;
  gap: 20rpx;
  margin-top: 36rpx;
}
.btn {
  flex: 1;
  height: 88rpx;
  border-radius: 999rpx;
  font-size: 30rpx;
  font-weight: 600;
  border: none;
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
