<script setup lang="ts">
/**
 * 列表底部状态条：加载中 / 加载更多按钮 / 已到底。
 * 与 usePagination 直接对接。
 */
interface Props {
  loading?: boolean
  hasMore?: boolean
}

withDefaults(defineProps<Props>(), { loading: false, hasMore: false })
defineEmits<{ (e: 'load-more'): void }>()
</script>

<template>
  <view class="load-more">
    <text v-if="loading" class="hint">加载中…</text>
    <text v-else-if="!hasMore" class="hint">已到底</text>
    <text v-else class="link" @tap="$emit('load-more')">加载更多</text>
  </view>
</template>

<style scoped>
.load-more {
  padding: 32rpx;
  text-align: center;
}
.hint {
  font-size: 26rpx;
  color: #999;
}
.link {
  font-size: 26rpx;
  color: #1a1c1d;
  font-weight: 600;
}
</style>
