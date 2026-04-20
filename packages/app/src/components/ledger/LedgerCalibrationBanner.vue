<script setup lang="ts">
/**
 * 门店尚未校准/日期非今日 的双形态提示条。
 * 纯展示，点击右侧操作触发 `action` 事件；父组件决定跳哪。
 */
interface Props {
  kind: 'zero' | 'date-offset'
}
defineProps<Props>()
defineEmits<{ (e: 'action'): void }>()
</script>

<template>
  <view v-if="kind === 'zero'" class="banner banner--warn">
    <view class="banner-text">
      <text class="banner-title">门店尚未校准</text>
      <text class="banner-desc">
        当前库存与现金均为 0，是否属实？未校准前预填上班数据将为 0。
      </text>
    </view>
    <view class="banner-action" @tap="$emit('action')">去校准</view>
  </view>

  <view v-else-if="kind === 'date-offset'" class="banner banner--info">
    <view class="banner-text">
      <text class="banner-desc">
        所选日期非今日，上班数据为当前库存/现金，可能与当时不一致，请核对后再提交。
      </text>
    </view>
  </view>
</template>

<style scoped>
.banner {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 24rpx;
  border-radius: 16rpx;
  margin-bottom: 24rpx;
}
.banner--warn {
  background: #fff7e6;
  border: 1rpx solid #ffd591;
}
.banner--info {
  background: #e6f4ff;
  border: 1rpx solid #91caff;
}
.banner-text {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}
.banner-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #d46b08;
}
.banner-desc {
  font-size: 24rpx;
  color: #555;
  line-height: 1.45;
}
.banner-action {
  background: #fa8c16;
  color: #fff;
  font-size: 26rpx;
  padding: 12rpx 24rpx;
  border-radius: 12rpx;
}
</style>
