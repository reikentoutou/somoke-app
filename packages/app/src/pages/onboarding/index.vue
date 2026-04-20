<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { useSession } from '@/composables/useSession'

const { auth, redirectToLoginIfNeeded } = useSession()

onShow(() => {
  if (!redirectToLoginIfNeeded()) return
  if (!auth.needsOnboarding) {
    uni.switchTab({ url: '/pages/overview/index' })
  }
})

function goCreate() {
  uni.navigateTo({ url: '/pages/store-create/index' })
}
function goJoin() {
  uni.navigateTo({ url: '/pages/store-join/index' })
}
</script>

<template>
  <view class="page">
    <view class="headline">
      <text class="tag">开始使用</text>
      <text class="title">创建或加入门店</text>
      <text class="desc">
        需先加入至少一家门店才能使用记账。你可以创建新门店（成为管理员），或使用同事提供的邀请码加入已有门店。
      </text>
    </view>

    <view class="card action" hover-class="hover" @tap="goCreate">
      <text class="action-label">创建门店</text>
      <text class="action-hint">填写门店信息并提交</text>
    </view>

    <view class="card action" hover-class="hover" @tap="goJoin">
      <text class="action-label">加入门店</text>
      <text class="action-hint">输入管理员提供的邀请码</text>
    </view>
  </view>
</template>

<style scoped>
.page {
  padding: 64rpx 32rpx 48rpx;
  display: flex;
  flex-direction: column;
  gap: 32rpx;
}
.headline {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-bottom: 24rpx;
}
.tag {
  font-size: 24rpx;
  color: #8a8a8f;
  letter-spacing: 2rpx;
}
.title {
  font-size: 48rpx;
  font-weight: 700;
}
.desc {
  font-size: 28rpx;
  color: #474747;
  line-height: 1.6;
}
.card {
  background: #fff;
  border-radius: 24rpx;
  padding: 40rpx 32rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.04);
}
.card.hover {
  opacity: 0.7;
}
.action-label {
  font-size: 32rpx;
  font-weight: 600;
}
.action-hint {
  font-size: 26rpx;
  color: #8a8a8f;
}
</style>
