<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { memberApi, shiftApi, storeApi } from '@/api'
import { useSession } from '@/composables/useSession'
import { useTabBarSync } from '@/composables/useTabBarSync'
import { useAuthStore } from '@/stores/auth'
import { useRecorderNamesStore } from '@/stores/recorderNames'
import { useCurrentStore } from '@/composables/useCurrentStore'
import { avatarLetter, currentStoreLine, roleText } from '@/utils/settings'
import { errorMessage } from '@/utils/errors'
import SettingsProfileCard from '@/components/settings/SettingsProfileCard.vue'
import SettingsGroup from '@/components/settings/SettingsGroup.vue'
import SettingsRow from '@/components/settings/SettingsRow.vue'

/**
 * 「设置」主入口（tabBar 第 4 项）：
 * - 顶部用户名片 → 编辑资料；
 * - 门店分组：当前门店 + 邀请码（仅店长）；
 * - 管理分组：班次 / 记账姓名 / 团队；三项 summary 并行拉取，失败静默保留占位；
 * - 运营控制：库存与现金；
 * - 底部退出登录。
 */

const { ensureReady } = useSession()
const auth = useAuthStore()
const recorderNames = useRecorderNamesStore()
const { isBoss, storeId } = useCurrentStore()
useTabBarSync(3)

const displayName = computed(() => {
  const n = (auth.userInfo?.nickname ?? '').trim()
  return n || '未设置昵称'
})
const avatar = computed(() => avatarLetter(displayName.value))
const role = computed(() => roleText(auth.roleInCurrentStore))
const storeLine = computed(() => currentStoreLine(auth.userInfo))
const showInvite = computed(() => isBoss.value && storeId.value > 0)

const shiftSummary = ref('—')
const recorderSummary = ref('—')
const teamSummary = ref('—')

let summarySeq = 0

async function loadSummaries(): Promise<void> {
  if (storeId.value <= 0) {
    shiftSummary.value = '—'
    recorderSummary.value = '—'
    teamSummary.value = '—'
    return
  }
  summarySeq += 1
  const seq = summarySeq
  try {
    const [shifts, members, detail] = await Promise.all([
      shiftApi.getShifts(),
      memberApi.getStoreMembers(),
      storeApi.getStoreDetail()
    ])
    if (seq !== summarySeq) return
    shiftSummary.value = `${Array.isArray(shifts) ? shifts.length : 0} 个班次`
    teamSummary.value = `${Array.isArray(members.members) ? members.members.length : 0} 人`
    const names = Array.isArray(detail.recorder_names) ? detail.recorder_names : []
    recorderSummary.value = `${names.length} 个`
    recorderNames.setNames(names)
  } catch {
    /* 静默：保留占位，避免打搅用户 */
  }
}

onShow(() => {
  if (!ensureReady()) return
  void loadSummaries()
})

function goProfileEdit() {
  uni.navigateTo({ url: '/pages/profile-edit/index' })
}
function goStoreSwitch() {
  uni.navigateTo({ url: '/pages/store-select/index?from=settings' })
}
function goShifts() {
  uni.navigateTo({ url: '/pages/settings-shifts/index' })
}
function goRecorders() {
  uni.navigateTo({ url: '/pages/settings-recorders/index' })
}
function goTeam() {
  uni.navigateTo({ url: '/pages/settings-team/index' })
}
function goStockLedger() {
  uni.navigateTo({ url: '/pages/stock-ledger/index' })
}

function onGenerateInvite() {
  const sid = storeId.value
  if (sid <= 0) return
  uni.showLoading({ title: '生成中', mask: true })
  memberApi
    .createInvite({ store_id: sid, max_uses: 1, expire_days: 7 })
    .then(res => {
      const code = res?.code ? String(res.code) : ''
      uni.showModal({
        title: '邀请码（仅显示一次）',
        content: code ? `${code}\n\n请立即复制保存，关闭后将无法在此再次查看。` : '未返回邀请码',
        confirmText: code ? '复制' : '知道了',
        success: r => {
          if (r.confirm && code) {
            uni.setClipboardData({ data: code })
          }
        }
      })
    })
    .catch(err => {
      const msg = errorMessage(err, '生成失败')
      uni.showToast({ title: msg, icon: 'none' })
    })
    .finally(() => {
      uni.hideLoading()
    })
}

function onLogout() {
  uni.showModal({
    title: '退出登录',
    content: '确定退出当前账号？',
    confirmText: '退出',
    confirmColor: '#ba1a1a',
    success: r => {
      if (!r.confirm) return
      auth.clearSession()
      uni.reLaunch({ url: '/pages/login/index' })
    }
  })
}
</script>

<template>
  <view class="page">
    <SettingsProfileCard
      :avatar="avatar"
      :display-name="displayName"
      :role-text="role"
      @select="goProfileEdit"
    />

    <SettingsGroup label="门店">
      <SettingsRow
        icon="店"
        label="当前门店"
        :sub="storeLine"
        trailing="切换"
        @select="goStoreSwitch"
      />
      <SettingsRow
        v-if="showInvite"
        icon="邀"
        label="生成邀请码"
        trailing="员工加入"
        divider
        @select="onGenerateInvite"
      />
    </SettingsGroup>

    <SettingsGroup label="管理">
      <SettingsRow icon="班" label="班次设置" :trailing="shiftSummary" @select="goShifts" />
      <SettingsRow
        icon="名"
        label="记账姓名"
        :trailing="recorderSummary"
        divider
        @select="goRecorders"
      />
      <SettingsRow icon="团" label="团队管理" :trailing="teamSummary" divider @select="goTeam" />
    </SettingsGroup>

    <SettingsGroup label="运营控制">
      <SettingsRow
        icon="运"
        label="库存与现金"
        sub="进货、取现、盘点与流水"
        @select="goStockLedger"
      />
    </SettingsGroup>

    <view class="logout" hover-class="logout-hover" @tap="onLogout">退出登录</view>
    <text class="version">Ledger v2.5.0</text>

    <view class="bottom-spacer" />
  </view>
</template>

<style scoped>
.page {
  padding: 0 32rpx 240rpx;
  background: #f9f9fb;
  min-height: 100vh;
  box-sizing: border-box;
}
.logout {
  width: 100%;
  margin-top: 48rpx;
  padding: 28rpx;
  text-align: center;
  color: #ba1a1a;
  font-weight: 500;
  font-size: 28rpx;
}
.logout-hover {
  opacity: 0.7;
}
.version {
  display: block;
  text-align: center;
  margin-top: 32rpx;
  color: #c6c6c6;
  font-size: 24rpx;
}
.bottom-spacer {
  height: 80rpx;
}
</style>
