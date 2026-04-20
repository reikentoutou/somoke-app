<script setup lang="ts">
/**
 * 统一的"加载中 / 错误 / 空 / 正常"状态封装。
 * 用法：
 *   <PageState :loading="loading" :error="error" :is-empty="list.length === 0" empty-text="暂无数据">
 *     <slot rendered when ready>
 *   </PageState>
 */
import { computed } from 'vue'

interface Props {
  loading?: boolean
  error?: string
  isEmpty?: boolean
  emptyText?: string
  loadingText?: string
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  error: '',
  isEmpty: false,
  emptyText: '暂无数据',
  loadingText: '加载中…'
})

const stage = computed<'loading' | 'error' | 'empty' | 'ready'>(() => {
  if (props.loading) return 'loading'
  if (props.error) return 'error'
  if (props.isEmpty) return 'empty'
  return 'ready'
})
</script>

<template>
  <view v-if="stage === 'loading'" class="page-state">
    <text class="hint">{{ loadingText }}</text>
  </view>
  <view v-else-if="stage === 'error'" class="page-state">
    <text class="hint error">{{ error }}</text>
    <slot name="error-actions" />
  </view>
  <view v-else-if="stage === 'empty'" class="page-state">
    <text class="hint">{{ emptyText }}</text>
    <slot name="empty-actions" />
  </view>
  <slot v-else />
</template>

<style scoped>
.page-state {
  padding: 96rpx 48rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24rpx;
}
.hint {
  font-size: 28rpx;
  color: #8a8a8f;
}
.hint.error {
  color: #d33;
}
</style>
