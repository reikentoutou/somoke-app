<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useSession } from '@/composables/useSession'
import { useSubmitLock } from '@/composables/useSubmitLock'
import { storeApi } from '@/api'
import SubmitButton from '@/components/SubmitButton.vue'
import { errorMessage } from '@/utils/errors'

const { auth, redirectToLoginIfNeeded } = useSession()
const { running, guard } = useSubmitLock()

const inviteCode = ref('')

onShow(() => {
  if (!redirectToLoginIfNeeded()) return
  if (!auth.needsOnboarding) {
    uni.switchTab({ url: '/pages/overview/index' })
  }
})

function onCodeInput(e: Event) {
  const v = (e as unknown as { detail?: { value?: string } }).detail?.value ?? ''
  inviteCode.value = v
}

async function submit() {
  const code = inviteCode.value.trim()
  if (!code) {
    uni.showToast({ title: '请输入邀请码', icon: 'none' })
    return
  }
  await guard(async () => {
    try {
      const res = await storeApi.joinStore({ code })
      const merged = auth.applyStoreJoined(res)
      if (!merged) {
        uni.showToast({ title: '加入成功但状态异常，请重新登录', icon: 'none' })
        return
      }
      uni.showToast({ title: '加入成功', icon: 'success' })
      uni.switchTab({ url: '/pages/overview/index' })
    } catch (err) {
      uni.showToast({ title: errorMessage(err, '加入失败'), icon: 'none' })
    }
  })
}
</script>

<template>
  <view class="page">
    <view class="headline">
      <text class="tag">邀请码</text>
      <text class="title">加入门店</text>
      <text class="desc">向门店管理员索取邀请码，成功后将切换到该门店。</text>
    </view>

    <view class="field card">
      <text class="label">邀请码</text>
      <input
        class="input"
        placeholder="请输入邀请码"
        :value="inviteCode"
        maxlength="32"
        @input="onCodeInput"
      />
    </view>

    <SubmitButton
      :loading="running"
      text="加入并进入首页"
      loading-text="加入中…"
      @submit="submit"
    />
  </view>
</template>

<style scoped>
.page {
  padding: 48rpx 32rpx;
  display: flex;
  flex-direction: column;
  gap: 32rpx;
}
.headline {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}
.tag {
  font-size: 24rpx;
  color: #8a8a8f;
}
.title {
  font-size: 44rpx;
  font-weight: 700;
}
.desc {
  font-size: 26rpx;
  color: #474747;
  line-height: 1.6;
}
.card {
  background: #fff;
  border-radius: 20rpx;
  padding: 32rpx;
  box-shadow: 0 4rpx 24rpx rgba(0, 0, 0, 0.04);
}
.field {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.label {
  font-size: 24rpx;
  color: #8a8a8f;
}
.input {
  font-size: 32rpx;
}
</style>
