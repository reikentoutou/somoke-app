<script setup lang="ts">
import { computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { authApi } from '@/api'
import { useAuthStore } from '@/stores/auth'
import { useSubmitLock } from '@/composables/useSubmitLock'
import { loginPayloadNeedsOnboarding, loginPayloadNeedsStoreSelection } from '@/stores/user'
import { errorMessage } from '@/utils/errors'

/**
 * 登录页：唯一入口。
 * - 已有会话时按下游「需不需要引导 / 选店」直接跳走，不让用户停在此页；
 * - 点击微信一键登录 → 云函数会用 OPENID 自动识别身份；
 * - 登录成功后：需引导 → onboarding；需选店 → store-select；否则进 tabBar。
 */

const auth = useAuthStore()
const submitLock = useSubmitLock()

const submitting = computed(() => submitLock.running.value)
const loginBtnText = computed(() => (submitting.value ? '登录中…' : '微信一键登录'))

function routeByLoginResult(needsOnboarding: boolean, needsStoreSelection: boolean): void {
  if (needsOnboarding) {
    uni.reLaunch({ url: '/pages/onboarding/index' })
    return
  }
  if (needsStoreSelection) {
    uni.reLaunch({ url: '/pages/store-select/index' })
    return
  }
  // overview 是 tabBar 页面：switchTab 更自然（不销毁其他 tab 的状态）
  uni.switchTab({ url: '/pages/overview/index' })
}

onShow(() => {
  if (!auth.token) return
  routeByLoginResult(auth.needsOnboarding, auth.needsStoreSelection)
})

function onLogin(): void {
  void submitLock.guard(async () => {
    try {
      const res = await authApi.login({})
      auth.applyLoginSuccess(res)
      routeByLoginResult(loginPayloadNeedsOnboarding(res), loginPayloadNeedsStoreSelection(res))
    } catch (err) {
      const msg = errorMessage(err, '登录失败，请重试')
      uni.showToast({ title: msg, icon: 'none' })
    }
  })
}
</script>

<template>
  <view class="page">
    <view class="headline">
      <text class="tag">店铺班次记账</text>
      <text class="title">Ledger</text>
      <text class="desc">使用微信账号登录后，可同步门店班次与销售数据。</text>
    </view>

    <view :class="['btn', { disabled: submitting }]" hover-class="btn-hover" @tap="onLogin">{{
      loginBtnText
    }}</view>
  </view>
</template>

<style scoped>
.page {
  min-height: 100vh;
  padding: 160rpx 48rpx 80rpx;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  background: #f9f9fb;
}
.headline {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  flex: 1;
}
.tag {
  font-size: 22rpx;
  color: #5e5e63;
  letter-spacing: 4rpx;
}
.title {
  font-size: 72rpx;
  font-weight: 700;
  color: #1a1c1d;
  letter-spacing: 2rpx;
  margin-bottom: 8rpx;
}
.desc {
  font-size: 28rpx;
  color: #474747;
  line-height: 1.6;
  max-width: 80%;
}
.btn {
  margin-top: auto;
  padding: 32rpx 24rpx;
  background: #1a1c1d;
  color: #fff;
  border-radius: 999rpx;
  text-align: center;
  font-size: 32rpx;
  font-weight: 600;
}
.btn-hover {
  opacity: 0.88;
}
.btn.disabled {
  opacity: 0.55;
}
</style>
