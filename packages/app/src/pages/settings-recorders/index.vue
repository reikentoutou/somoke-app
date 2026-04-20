<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { memberApi, storeApi } from '@/api'
import { useSession } from '@/composables/useSession'
import { useSubmitLock } from '@/composables/useSubmitLock'
import { useLoadSeq } from '@/composables/useLoadSeq'
import { useCurrentStore } from '@/composables/useCurrentStore'
import { useRecorderNamesStore } from '@/stores/recorderNames'
import PageState from '@/components/PageState.vue'
import RecorderRow from '@/components/settings/RecorderRow.vue'
import { errorMessage } from '@/utils/errors'

/**
 * 记账姓名管理：
 * - 从 storeDetail.recorder_names 读取；
 * - 店长可添加 / 删除；普通员工只读；
 * - 写操作成功后用后端返回的最新 names 直接覆盖 store + 本地 state。
 */

const { ensureReady } = useSession()
const { isBoss } = useCurrentStore()
const submitLock = useSubmitLock()
const loadSeq = useLoadSeq()
const recorderNames = useRecorderNamesStore()

const loading = ref(true)
const errMsg = ref('')
const names = shallowRef<string[]>([])
const newName = ref('')
const submitting = computed(() => submitLock.running.value)

async function loadNames() {
  const token = loadSeq.bump()
  loading.value = true
  errMsg.value = ''
  try {
    const detail = await storeApi.getStoreDetail()
    if (loadSeq.isStale(token)) return
    const list = Array.isArray(detail.recorder_names) ? detail.recorder_names : []
    names.value = list
    recorderNames.setNames(list)
  } catch (err) {
    if (loadSeq.isStale(token)) return
    errMsg.value = errorMessage(err, '加载失败')
  } finally {
    if (!loadSeq.isStale(token)) loading.value = false
  }
}

onShow(() => {
  if (!ensureReady()) return
  void loadNames()
})

function onInput(e: Event) {
  newName.value = String((e as unknown as { detail?: { value?: string } }).detail?.value ?? '')
}

function onAdd() {
  if (!isBoss.value) return
  const name = newName.value.trim()
  if (!name) {
    uni.showToast({ title: '请输入姓名', icon: 'none' })
    return
  }
  void submitLock.guard(async () => {
    uni.showLoading({ title: '保存中', mask: true })
    try {
      const res = await memberApi.addRecorderName({ name })
      const list = Array.isArray(res.recorder_names) ? res.recorder_names : []
      names.value = list
      recorderNames.setNames(list)
      newName.value = ''
      uni.showToast({ title: '已添加', icon: 'success' })
    } catch (err) {
      const msg = errorMessage(err, '添加失败')
      uni.showToast({ title: msg, icon: 'none' })
    } finally {
      uni.hideLoading()
    }
  })
}

function onDelete(name: string) {
  if (!isBoss.value) return
  const nm = String(name).trim()
  if (!nm) return
  uni.showModal({
    title: '删除记账姓名',
    content: `确定从名单中删除「${nm}」？历史记录中的记账人显示不受影响。`,
    confirmText: '删除',
    confirmColor: '#ba1a1a',
    success: r => {
      if (!r.confirm) return
      void submitLock.guard(async () => {
        uni.showLoading({ title: '删除中', mask: true })
        try {
          const res = await memberApi.deleteRecorderName({ name: nm })
          const list = Array.isArray(res.recorder_names) ? res.recorder_names : []
          names.value = list
          recorderNames.setNames(list)
          uni.showToast({ title: '已删除', icon: 'success' })
        } catch (err) {
          const msg = errorMessage(err, '删除失败')
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
      <text class="hint">录入页将从下列姓名中选择记账人；管理员可添加或删除（最多 50 个）。</text>

      <RecorderRow
        v-for="name in names"
        :key="name"
        :name="name"
        :can-delete="isBoss"
        @delete="onDelete"
      />

      <view v-if="!names.length" class="empty">暂无姓名，请添加。</view>

      <view v-if="isBoss" class="add-bar">
        <input
          class="add-input"
          maxlength="32"
          placeholder="新姓名"
          :value="newName"
          @input="onInput"
        />
        <view
          :class="['add-btn', { disabled: submitting }]"
          hover-class="add-btn-hover"
          @tap="onAdd"
          >添加</view
        >
      </view>

      <text v-if="!isBoss" class="footnote">仅门店管理员可维护名单。</text>
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
.hint {
  display: block;
  margin-bottom: 24rpx;
  color: #5e5e63;
  line-height: 1.45;
  font-size: 26rpx;
}
.empty {
  padding: 48rpx 16rpx;
  text-align: center;
  color: #474747;
  font-size: 26rpx;
}
.add-bar {
  display: flex;
  gap: 16rpx;
  align-items: center;
  margin-top: 32rpx;
}
.add-input {
  flex: 1;
  height: 80rpx;
  padding: 0 24rpx;
  background: #fff;
  border-radius: 16rpx;
  border: 2rpx solid #e8e8ea;
  color: #1a1c1d;
  font-size: 28rpx;
}
.add-btn {
  flex-shrink: 0;
  padding: 0 32rpx;
  height: 80rpx;
  line-height: 80rpx;
  background: #1a1c1d;
  color: #fff;
  border-radius: 16rpx;
  font-size: 28rpx;
  font-weight: 500;
}
.add-btn.disabled {
  opacity: 0.55;
}
.add-btn-hover {
  opacity: 0.88;
}
.footnote {
  display: block;
  margin-top: 40rpx;
  color: #5e5e63;
  line-height: 1.45;
  font-size: 26rpx;
}
.bottom-spacer {
  height: 80rpx;
}
</style>
