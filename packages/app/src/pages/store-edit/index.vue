<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { storeApi } from '@/api'
import { useSession } from '@/composables/useSession'
import { useSubmitLock } from '@/composables/useSubmitLock'
import { useAuthStore } from '@/stores/auth'
import { normalizeStores } from '@/stores/user'
import SubmitButton from '@/components/SubmitButton.vue'
import { errorMessage } from '@/utils/errors'

/**
 * 门店管理员：修改门店名称、删除门店（软删）。
 * 入口：`store-select` 列表「管理」。
 */

const { redirectToLoginIfNeeded } = useSession()
const auth = useAuthStore()
const { running: saveRunning, guard: guardSave } = useSubmitLock()
const { running: deleteRunning, guard: guardDelete } = useSubmitLock()

const storeId = ref(0)
const storeName = ref('')

const canManage = computed(() => {
  const sid = storeId.value
  if (!sid) return false
  const hit = normalizeStores(auth.userInfo).find(s => s.store_id === sid)
  return hit?.role === 1
})

onLoad(options => {
  const sid = Number.parseInt(String(options?.store_id ?? ''), 10)
  storeId.value = Number.isFinite(sid) && sid > 0 ? sid : 0
  const raw = options?.name != null ? decodeURIComponent(String(options.name)) : ''
  storeName.value = raw.trim()
})

onShow(() => {
  if (!redirectToLoginIfNeeded()) return
  if (!storeId.value) {
    uni.showToast({ title: '参数无效', icon: 'none' })
    setTimeout(() => uni.navigateBack(), 400)
    return
  }
  if (!canManage.value) {
    uni.showToast({ title: '仅管理员可管理门店', icon: 'none' })
    setTimeout(() => uni.navigateBack(), 400)
  }
})

function onNameInput(e: Event) {
  const v = (e as unknown as { detail?: { value?: string } }).detail?.value ?? ''
  storeName.value = v
}

async function syncSessionFromServer(): Promise<void> {
  const res = await storeApi.getStores()
  auth.applyStoresListRefreshed(res.stores ?? [], res.current_store_id)
}

function routeAfterMutation(): void {
  if (auth.needsOnboarding) {
    uni.reLaunch({ url: '/pages/onboarding/index' })
    return
  }
  if (auth.needsStoreSelection) {
    uni.reLaunch({ url: '/pages/store-select/index?from=settings' })
    return
  }
  uni.navigateBack()
}

async function onSave() {
  const sid = storeId.value
  const name = storeName.value.trim()
  if (!sid || !name) {
    uni.showToast({ title: '请填写门店名称', icon: 'none' })
    return
  }
  await guardSave(async () => {
    try {
      await storeApi.updateStore({ store_id: sid, name })
      await syncSessionFromServer()
      uni.showToast({ title: '已保存', icon: 'success' })
      setTimeout(() => routeAfterMutation(), 400)
    } catch (err) {
      uni.showToast({ title: errorMessage(err, '保存失败'), icon: 'none' })
    }
  })
}

function onDeleteTap() {
  const sid = storeId.value
  if (!sid) return
  uni.showModal({
    title: '删除门店',
    content:
      '删除后全员将无法进入该门店，门店数据仍保留在系统中以便对账。此操作不可从 App 内恢复，确定继续？',
    confirmText: '删除',
    confirmColor: '#ba1a1a',
    success: r => {
      if (!r.confirm) return
      void runDelete()
    }
  })
}

async function runDelete() {
  const sid = storeId.value
  if (!sid) return
  await guardDelete(async () => {
    uni.showLoading({ title: '处理中', mask: true })
    try {
      await storeApi.deleteStore({ store_id: sid })
      await syncSessionFromServer()
      uni.showToast({ title: '已删除', icon: 'success' })
      setTimeout(() => routeAfterMutation(), 400)
    } catch (err) {
      uni.showToast({ title: errorMessage(err, '删除失败'), icon: 'none' })
    } finally {
      uni.hideLoading()
    }
  })
}
</script>

<template>
  <view class="page">
    <view class="headline">
      <text class="tag">门店</text>
      <text class="title">门店设置</text>
      <text class="desc">仅管理员可修改名称或删除门店。删除为软删除，历史记账仍会保留。</text>
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

    <SubmitButton :loading="saveRunning" text="保存名称" loading-text="保存中…" @submit="onSave" />

    <view
      class="danger"
      :class="{ disabled: deleteRunning }"
      hover-class="danger-hover"
      @tap="onDeleteTap"
    >
      删除门店
    </view>
  </view>
</template>

<style scoped>
.page {
  padding: 48rpx 32rpx 120rpx;
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
  color: #1a1c1d;
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
  color: #1a1c1d;
}
.danger {
  margin-top: 16rpx;
  padding: 28rpx;
  text-align: center;
  font-size: 28rpx;
  font-weight: 500;
  color: #ba1a1a;
  border-radius: 20rpx;
  background: #fff;
  border: 2rpx solid rgba(186, 26, 26, 0.25);
}
.danger-hover {
  opacity: 0.85;
}
.danger.disabled {
  opacity: 0.45;
}
</style>
