<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { authApi } from '@/api'
import { useSession } from '@/composables/useSession'
import { useSubmitLock } from '@/composables/useSubmitLock'
import { useAuthStore } from '@/stores/auth'
import { errorMessage } from '@/utils/errors'

/**
 * 编辑昵称页：登录态必填，保存成功后写回 auth store 并 navigateBack。
 * 仅需登录态即可访问（非 onboarding/ 店铺校验），因此只触发 redirectToLoginIfNeeded。
 */

const auth = useAuthStore()
const session = useSession()
const submitLock = useSubmitLock()

const nickname = ref('')
const submitting = computed(() => submitLock.running.value)

onShow(() => {
  if (!session.redirectToLoginIfNeeded()) return
  const n = (auth.userInfo?.nickname ?? '').trim()
  nickname.value = n
})

function onInput(e: Event) {
  nickname.value = String((e as unknown as { detail?: { value?: string } }).detail?.value ?? '')
}

function onSubmit() {
  const name = nickname.value.trim()
  if (!name) {
    uni.showToast({ title: '请填写昵称', icon: 'none' })
    return
  }
  void submitLock.guard(async () => {
    try {
      const res = await authApi.updateProfile({ nickname: name })
      auth.applyUserInfoPatch(res.user_info)
      uni.showToast({ title: '已保存', icon: 'success' })
      setTimeout(() => {
        uni.navigateBack({ delta: 1 })
      }, 450)
    } catch (err) {
      const msg = errorMessage(err, '保存失败')
      uni.showToast({ title: msg, icon: 'none' })
    }
  })
}
</script>

<template>
  <view class="page">
    <view class="headline">
      <text class="tag">显示名称</text>
      <text class="title">修改昵称</text>
      <text class="desc">保存后将与录入页「记账姓名」一致，并用于报表等处的操作者展示。</text>
    </view>

    <view class="card">
      <text class="label">昵称</text>
      <input
        class="input"
        type="text"
        maxlength="64"
        placeholder="请输入昵称"
        :value="nickname"
        @input="onInput"
      />
    </view>

    <view
      :class="['submit', { disabled: submitting }]"
      hover-class="submit-hover"
      @tap="onSubmit"
      >{{ submitting ? '保存中…' : '保存' }}</view
    >
  </view>
</template>

<style scoped>
.page {
  padding: 32rpx 32rpx 120rpx;
  background: #f9f9fb;
  min-height: 100vh;
  box-sizing: border-box;
}
.headline {
  padding: 24rpx 8rpx 32rpx;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.tag {
  font-size: 22rpx;
  color: #5e5e63;
  letter-spacing: 2rpx;
}
.title {
  font-size: 48rpx;
  font-weight: 700;
  color: #1a1c1d;
}
.desc {
  font-size: 26rpx;
  color: #5e5e63;
  line-height: 1.5;
  margin-top: 8rpx;
}
.card {
  padding: 32rpx 40rpx;
  background: #fff;
  border-radius: 32rpx;
  border: 2rpx solid rgba(0, 0, 0, 0.04);
}
.label {
  display: block;
  margin-bottom: 12rpx;
  font-size: 24rpx;
  color: #5e5e63;
}
.input {
  width: 100%;
  padding: 16rpx 0;
  border-bottom: 2rpx solid #e8e8ea;
  font-size: 32rpx;
  color: #1a1c1d;
}
.submit {
  margin-top: 48rpx;
  padding: 28rpx 32rpx;
  background: #1a1c1d;
  color: #fff;
  border-radius: 999rpx;
  text-align: center;
  font-size: 30rpx;
  font-weight: 600;
}
.submit-hover {
  opacity: 0.88;
}
.submit.disabled {
  opacity: 0.55;
}
</style>
