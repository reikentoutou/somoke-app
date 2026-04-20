<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import type { Role, StoreMember } from '@somoke/shared'
import { memberApi, storeApi } from '@/api'
import { useSession } from '@/composables/useSession'
import { useLoadSeq } from '@/composables/useLoadSeq'
import { useSubmitLock } from '@/composables/useSubmitLock'
import { useAuthStore } from '@/stores/auth'
import { useCurrentStore } from '@/composables/useCurrentStore'
import { normalizeStores } from '@/stores/user'
import { countBosses, memberPermissions } from '@/utils/settings'
import PageState from '@/components/PageState.vue'
import MemberCard from '@/components/settings/MemberCard.vue'
import { errorMessage } from '@/utils/errors'

/**
 * 成员管理：展示本店成员；店长可以移除 / 升降级 / 自己退出（保留 >=1 店长）；
 * 普通员工只看得到「退出门店」。
 * 邀请新员工通过设置页的「生成邀请码」入口，这里只保留 footnote 指引。
 */

const { ensureReady } = useSession()
const auth = useAuthStore()
const { isBoss } = useCurrentStore()
const loadSeq = useLoadSeq()
const submitLock = useSubmitLock()

const loading = ref(true)
const errMsg = ref('')
const members = shallowRef<StoreMember[]>([])
const myUserId = computed(() => auth.userInfo?.id ?? 0)
const bossCount = computed(() => countBosses(members.value))

function permsOf(member: StoreMember) {
  return memberPermissions(member, myUserId.value, isBoss.value, bossCount.value)
}

async function loadMembers() {
  const token = loadSeq.bump()
  loading.value = true
  errMsg.value = ''
  try {
    const res = await memberApi.getStoreMembers()
    if (loadSeq.isStale(token)) return
    members.value = Array.isArray(res.members) ? res.members : []
  } catch (err) {
    if (loadSeq.isStale(token)) return
    errMsg.value = errorMessage(err, '加载失败')
  } finally {
    if (!loadSeq.isStale(token)) loading.value = false
  }
}

onShow(() => {
  if (!ensureReady()) return
  void loadMembers()
})

function onRemove(userId: number) {
  if (!userId) return
  uni.showModal({
    title: '移除成员',
    content: '确定将该成员从本店移除？其将无法再访问本店数据。',
    confirmText: '移除',
    confirmColor: '#ba1a1a',
    success: r => {
      if (!r.confirm) return
      void submitLock.guard(async () => {
        uni.showLoading({ title: '处理中', mask: true })
        try {
          await memberApi.removeMember({ user_id: userId })
          uni.showToast({ title: '已移除', icon: 'success' })
          await loadMembers()
        } catch (err) {
          const msg = errorMessage(err, '操作失败')
          uni.showToast({ title: msg, icon: 'none' })
        } finally {
          uni.hideLoading()
        }
      })
    }
  })
}

function onSetRole(userId: number, role: Role) {
  if (!userId) return
  const content = role === 1 ? '将该成员设为管理员？' : '将该成员设为员工？'
  uni.showModal({
    title: '调整角色',
    content,
    confirmText: '确定',
    success: r => {
      if (!r.confirm) return
      void submitLock.guard(async () => {
        uni.showLoading({ title: '保存中', mask: true })
        try {
          await memberApi.setMemberRole({ user_id: userId, role })
          uni.showToast({ title: '已更新', icon: 'success' })
          await loadMembers()
        } catch (err) {
          const msg = errorMessage(err, '操作失败')
          uni.showToast({ title: msg, icon: 'none' })
        } finally {
          uni.hideLoading()
        }
      })
    }
  })
}

function onLeave() {
  const uid = myUserId.value
  if (!uid) return
  uni.showModal({
    title: '退出门店',
    content: '确定退出当前门店？退出后需重新加入或切换其他门店。',
    confirmText: '退出',
    confirmColor: '#ba1a1a',
    success: r => {
      if (!r.confirm) return
      void submitLock.guard(async () => {
        uni.showLoading({ title: '处理中', mask: true })
        try {
          await memberApi.removeMember({ user_id: uid })
          uni.showToast({ title: '已退出', icon: 'success' })
          try {
            const stores = await storeApi.getStores()
            auth.applyStoresListRefreshed(stores.stores ?? [], stores.current_store_id)
          } catch {
            /* getStores 失败也不阻塞跳转 */
          }
          const left = normalizeStores(auth.userInfo)
          if (!left.length) {
            uni.reLaunch({ url: '/pages/onboarding/index' })
          } else {
            uni.reLaunch({ url: '/pages/store-select/index' })
          }
        } catch (err) {
          const msg = errorMessage(err, '操作失败')
          uni.showToast({ title: msg, icon: 'none' })
        } finally {
          uni.hideLoading()
        }
      })
    }
  })
}
</script>

<template>
  <view class="page">
    <PageState :loading="loading" :error="errMsg" loading-text="加载中…">
      <view v-if="!members.length" class="empty">暂无成员</view>
      <MemberCard
        v-for="m in members"
        :key="m.user_id"
        :member="m"
        :permissions="permsOf(m)"
        @remove="onRemove"
        @set-role="onSetRole"
        @leave="onLeave"
      />
      <text class="footnote">邀请新员工：在设置页使用「生成邀请码」。</text>
    </PageState>

    <view class="bottom-spacer" />
  </view>
</template>

<style scoped>
.page {
  padding: 32rpx 32rpx 120rpx;
  background: #f9f9fb;
  min-height: 100vh;
  box-sizing: border-box;
}
.empty {
  padding: 48rpx 16rpx;
  text-align: center;
  color: #474747;
  font-size: 26rpx;
}
.footnote {
  display: block;
  margin-top: 24rpx;
  color: #5e5e63;
  line-height: 1.45;
  font-size: 26rpx;
}
.bottom-spacer {
  height: 80rpx;
}
</style>
