<script setup lang="ts">
import { ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useSession } from '@/composables/useSession'
import { useSubmitLock } from '@/composables/useSubmitLock'
import { storeApi } from '@/api'
import SubmitButton from '@/components/SubmitButton.vue'
import { errorMessage } from '@/utils/errors'

/**
 * 创建门店。
 * - 入口 A：onboarding 流程（首次强制）
 * - 入口 B：设置页「创建新门店」（已有门店时允许停留）
 */
const { auth, redirectToLoginIfNeeded } = useSession()
const { running, guard } = useSubmitLock()

const storeName = ref('')
const fromSettings = ref(false)

onLoad(options => {
  fromSettings.value = options?.from === 'settings'
})

onShow(() => {
  if (!redirectToLoginIfNeeded()) return
  if (!auth.needsOnboarding && !fromSettings.value) {
    uni.switchTab({ url: '/pages/overview/index' })
  }
})

function onNameInput(e: Event) {
  const v = (e as unknown as { detail?: { value?: string } }).detail?.value ?? ''
  storeName.value = v
}

async function submit() {
  const name = storeName.value.trim()
  if (!name) {
    uni.showToast({ title: '请输入门店名称', icon: 'none' })
    return
  }
  await guard(async () => {
    try {
      const res = await storeApi.createStore({ name })
      const merged = auth.applyStoreCreated(res.store)
      if (!merged) {
        uni.showToast({ title: '创建成功但未解析到门店，请重新登录', icon: 'none' })
        return
      }
      uni.showToast({ title: '创建成功', icon: 'success' })
      setTimeout(() => {
        uni.switchTab({ url: '/pages/overview/index' })
      }, 200)
    } catch (err) {
      uni.showToast({ title: errorMessage(err, '创建失败'), icon: 'none' })
    }
  })
}
</script>

<template>
  <view class="page">
    <view class="headline">
      <text class="tag">新门店</text>
      <text class="title">创建门店</text>
      <text class="desc">提交后将关联到当前账号；名称不超过 64 个字。</text>
    </view>

    <view class="field card">
      <text class="label">门店名称</text>
      <input
        class="input"
        placeholder="请输入门店名称"
        :value="storeName"
        maxlength="64"
        @input="onNameInput"
      />
    </view>

    <SubmitButton
      :loading="running"
      text="创建并进入首页"
      loading-text="创建中…"
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
