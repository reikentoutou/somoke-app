<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import type { StoreBrief } from '@somoke/shared'
import { storeApi } from '@/api'
import { useSession } from '@/composables/useSession'
import { useSubmitLock } from '@/composables/useSubmitLock'
import { useLoadSeq } from '@/composables/useLoadSeq'
import { normalizeStores } from '@/stores/user'
import PageState from '@/components/PageState.vue'
import { errorMessage } from '@/utils/errors'

/**
 * 选店页双模式：
 *   默认：登录后"请选择要进入的门店"
 *   ?from=settings：设置页"切换当前门店 / 创建 / 加入"
 */
interface DecoratedStore extends StoreBrief {
  displayName: string
  roleLabel: string
  isCurrent: boolean
  avatarLetter: string
}

const { auth, redirectToLoginIfNeeded } = useSession()
const switchLock = useSubmitLock()
const joinLock = useSubmitLock()
const loadSeq = useLoadSeq()

const fromSettings = ref(false)
const loading = ref(false)
const stores = ref<DecoratedStore[]>([])
const joinInviteCode = ref('')

const isEmpty = computed(() => !loading.value && stores.value.length === 0)

function decorate(list: StoreBrief[], currentStoreId: number): DecoratedStore[] {
  return list.map(s => {
    const name = (s.name ?? '').trim() || `门店 #${s.store_id}`
    const firstChar = name.charAt(0) || '店'
    return {
      ...s,
      displayName: name,
      roleLabel: s.role === 1 ? '管理员' : '员工',
      isCurrent: s.store_id === currentStoreId,
      avatarLetter: /[a-z]/i.test(firstChar) ? firstChar.toUpperCase() : firstChar
    }
  })
}

function renderFromLocal(): void {
  const list = normalizeStores(auth.userInfo)
  stores.value = decorate(list, auth.currentStoreId)
  loading.value = false
  if (!list.length) return
  // 默认模式下已选好门店：直接进首页
  if (!auth.needsStoreSelection && !fromSettings.value) {
    uni.switchTab({ url: '/pages/overview/index' })
  }
}

async function loadFromServer(): Promise<void> {
  const seq = loadSeq.bump()
  loading.value = true
  try {
    const res = await storeApi.getStores()
    if (loadSeq.isStale(seq)) return
    auth.applyStoresListRefreshed(res.stores ?? [], res.current_store_id)
    renderFromLocal()
  } catch {
    if (loadSeq.isStale(seq)) return
    renderFromLocal()
    uni.showToast({ title: '已显示本地列表', icon: 'none' })
  }
}

onLoad(options => {
  fromSettings.value = options?.from === 'settings'
  uni.setNavigationBarTitle({
    title: fromSettings.value ? '我的门店' : '选择门店'
  })
})

onShow(() => {
  if (!redirectToLoginIfNeeded()) return
  if (auth.needsOnboarding) {
    uni.redirectTo({ url: '/pages/onboarding/index' })
    return
  }
  if (fromSettings.value) {
    loadFromServer()
  } else {
    renderFromLocal()
  }
})

async function onPickStore(item: DecoratedStore) {
  const sid = item.store_id
  if (!sid) return
  if (fromSettings.value && sid === auth.currentStoreId) {
    uni.showToast({ title: '已是当前门店', icon: 'none' })
    return
  }
  await switchLock.guard(async () => {
    uni.showLoading({ title: '切换中', mask: true })
    try {
      const res = await storeApi.switchStore({ store_id: sid })
      const newSid = res.current_store_id
      if (!newSid) {
        uni.showToast({ title: '切换失败', icon: 'none' })
        return
      }
      auth.applyStoreSwitch(newSid)
      uni.showToast({ title: '已切换', icon: 'success' })
      if (fromSettings.value) {
        uni.navigateBack()
      } else {
        uni.switchTab({ url: '/pages/overview/index' })
      }
    } catch (err) {
      uni.showToast({ title: errorMessage(err, '切换失败'), icon: 'none' })
    } finally {
      uni.hideLoading()
    }
  })
}

function onJoinCodeInput(e: Event) {
  const v = (e as unknown as { detail?: { value?: string } }).detail?.value ?? ''
  joinInviteCode.value = v
}

async function submitJoin() {
  const code = joinInviteCode.value.trim()
  if (!code) {
    uni.showToast({ title: '请输入邀请码', icon: 'none' })
    return
  }
  await joinLock.guard(async () => {
    uni.showLoading({ title: '加入中', mask: true })
    try {
      const res = await storeApi.joinStore({ code })
      const merged = auth.applyStoreJoined(res)
      if (!merged) {
        uni.showToast({ title: '加入成功但状态异常，请重新登录', icon: 'none' })
        return
      }
      joinInviteCode.value = ''
      uni.showToast({ title: '已加入', icon: 'success' })
      if (fromSettings.value) {
        await loadFromServer()
      } else {
        uni.switchTab({ url: '/pages/overview/index' })
      }
    } catch (err) {
      uni.showToast({ title: errorMessage(err, '加入失败'), icon: 'none' })
    } finally {
      uni.hideLoading()
    }
  })
}

function goCreateStore() {
  uni.navigateTo({ url: '/pages/store-create/index?from=settings' })
}
</script>

<template>
  <view class="page">
    <view v-if="fromSettings" class="headline">
      <text class="tag">门店</text>
      <text class="title">切换当前门店</text>
      <text class="desc">轻触列表即可切换；底部可创建新店或输入邀请码加入其他门店。</text>
    </view>
    <view v-else class="headline">
      <text class="tag">当前门店</text>
      <text class="title">请选择要进入的门店</text>
      <text class="desc">切换后将使用所选门店。</text>
    </view>

    <PageState
      :loading="loading"
      :is-empty="isEmpty"
      empty-text="暂无门店，请返回创建或加入。"
      loading-text="正在同步…"
    >
      <view class="list">
        <view
          v-for="s in stores"
          :key="s.store_id"
          class="row card"
          :class="{ current: s.isCurrent }"
          hover-class="row-hover"
          @tap="onPickStore(s)"
        >
          <view v-if="fromSettings" class="avatar">{{ s.avatarLetter }}</view>
          <view class="main">
            <text class="name">{{ s.displayName }}</text>
            <text class="role">{{ s.roleLabel }}</text>
          </view>
          <view class="trail">
            <view v-if="s.isCurrent" class="current-mark">
              <view class="dot" />
              <text class="current-text">使用中</text>
            </view>
            <text v-else class="chevron">›</text>
          </view>
        </view>
      </view>
    </PageState>

    <view v-if="fromSettings && !loading" class="footer">
      <text class="footer-label">新店</text>
      <view class="create-row" hover-class="hover" @tap="goCreateStore">
        <text class="plus">+</text>
        <text class="create-text">创建新门店</text>
      </view>
      <text class="footer-label">加入门店</text>
      <view class="join-row">
        <input
          class="join-input"
          type="text"
          placeholder="输入邀请码"
          confirm-type="done"
          :value="joinInviteCode"
          @input="onJoinCodeInput"
        />
        <view
          class="join-btn"
          :class="{ disabled: joinLock.running.value }"
          hover-class="hover"
          @tap="submitJoin"
        >
          加入
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.page {
  padding: 48rpx 32rpx 96rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}
.headline {
  display: flex;
  flex-direction: column;
  gap: 12rpx;
  margin-bottom: 16rpx;
}
.tag {
  font-size: 24rpx;
  color: #8a8a8f;
}
.title {
  font-size: 42rpx;
  font-weight: 700;
}
.desc {
  font-size: 26rpx;
  color: #474747;
  line-height: 1.6;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.card {
  background: #fff;
  border-radius: 20rpx;
  box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.04);
}
.row {
  display: flex;
  align-items: center;
  gap: 20rpx;
  padding: 28rpx 24rpx;
}
.row.current {
  background: #f3f6ff;
}
.row-hover {
  opacity: 0.7;
}
.avatar {
  width: 72rpx;
  height: 72rpx;
  border-radius: 50%;
  background: #1a1c1d;
  color: #fff;
  font-weight: 700;
  font-size: 28rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6rpx;
}
.name {
  font-size: 30rpx;
  font-weight: 600;
}
.role {
  font-size: 24rpx;
  color: #8a8a8f;
}
.trail {
  display: flex;
  align-items: center;
}
.current-mark {
  display: flex;
  align-items: center;
  gap: 8rpx;
}
.dot {
  width: 14rpx;
  height: 14rpx;
  border-radius: 50%;
  background: #0f66ff;
}
.current-text {
  font-size: 22rpx;
  color: #0f66ff;
  font-weight: 600;
}
.chevron {
  font-size: 36rpx;
  color: #c6c6c6;
}

.footer {
  margin-top: 48rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.footer-label {
  font-size: 22rpx;
  color: #8a8a8f;
  margin-top: 16rpx;
}
.create-row {
  background: #fff;
  border-radius: 16rpx;
  padding: 28rpx 24rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.plus {
  font-size: 36rpx;
  font-weight: 700;
}
.create-text {
  font-size: 28rpx;
}
.join-row {
  display: flex;
  gap: 16rpx;
  align-items: center;
  background: #fff;
  border-radius: 16rpx;
  padding: 16rpx 20rpx;
}
.join-input {
  flex: 1;
  font-size: 28rpx;
}
.join-btn {
  padding: 16rpx 32rpx;
  background: #1a1c1d;
  color: #fff;
  border-radius: 40rpx;
  font-size: 26rpx;
  font-weight: 600;
}
.join-btn.disabled {
  opacity: 0.5;
}
.hover {
  opacity: 0.7;
}
</style>
