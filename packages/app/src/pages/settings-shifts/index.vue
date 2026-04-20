<script setup lang="ts">
import { computed, ref, shallowRef } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import type { ShiftConfigListItem } from '@somoke/shared'
import { shiftApi } from '@/api'
import { useSession } from '@/composables/useSession'
import { useSubmitLock } from '@/composables/useSubmitLock'
import { useLoadSeq } from '@/composables/useLoadSeq'
import { useShiftConfigsStore } from '@/stores/shiftConfigs'
import { useCurrentStore } from '@/composables/useCurrentStore'
import {
  DEFAULT_SHIFT_FORM,
  formForNewShift,
  formFromShift,
  validateShiftForm,
  type ShiftFormValues
} from '@/utils/settings'
import { errorMessage } from '@/utils/errors'
import PageState from '@/components/PageState.vue'
import ShiftCard from '@/components/settings/ShiftCard.vue'
import ShiftEditorModal from '@/components/settings/ShiftEditorModal.vue'

/**
 * 班次设置：列表 + 新增/编辑/停用弹层。
 * 店长可编辑；非店长只读，底部给出提示。
 * 列表强制从 shiftConfigs store 重新拉取（写操作会自动失效 shifts: 前缀缓存）。
 */

const { ensureReady } = useSession()
const { isBoss } = useCurrentStore()
const shiftStore = useShiftConfigsStore()
const submitLock = useSubmitLock()
const loadSeq = useLoadSeq()

const loading = ref(true)
const errMsg = ref('')
const shifts = shallowRef<ShiftConfigListItem[]>([])

const editorVisible = ref(false)
const isAdd = ref(true)
const form = ref<ShiftFormValues>({ ...DEFAULT_SHIFT_FORM })
const submitting = computed(() => submitLock.running.value)

async function loadShifts() {
  const token = loadSeq.bump()
  loading.value = true
  errMsg.value = ''
  try {
    const list = await shiftStore.refresh()
    if (loadSeq.isStale(token)) return
    shifts.value = Array.isArray(list) ? list : []
  } catch (err) {
    if (loadSeq.isStale(token)) return
    errMsg.value = errorMessage(err, '加载失败')
  } finally {
    if (!loadSeq.isStale(token)) loading.value = false
  }
}

onShow(() => {
  if (!ensureReady()) return
  void loadShifts()
})

function openAdd() {
  if (!isBoss.value) return
  isAdd.value = true
  form.value = formForNewShift(shifts.value)
  editorVisible.value = true
}

function onEdit(id: number) {
  if (!isBoss.value) return
  const hit = shifts.value.find(x => x.id === id)
  if (!hit) return
  isAdd.value = false
  form.value = formFromShift(hit)
  editorVisible.value = true
}

function closeEditor() {
  if (submitting.value) return
  editorVisible.value = false
}

function onSubmit() {
  const v = validateShiftForm(form.value, isAdd.value)
  if (!v.ok) {
    uni.showToast({ title: v.message, icon: 'none' })
    return
  }
  void submitLock.guard(async () => {
    try {
      await shiftApi.saveShift(v.payload)
      uni.showToast({ title: isAdd.value ? '已添加' : '已保存', icon: 'success' })
      editorVisible.value = false
      await loadShifts()
    } catch (err) {
      const msg = errorMessage(err, '保存失败')
      uni.showToast({ title: msg, icon: 'none' })
    }
  })
}

function onDelete() {
  if (isAdd.value || !form.value.id) return
  const id = form.value.id
  uni.showModal({
    title: '停用班次',
    content: '停用后录入页将不再显示该班次；已有历史记录仍保留。确定停用？',
    confirmText: '停用',
    confirmColor: '#ba1a1a',
    success: r => {
      if (!r.confirm) return
      void submitLock.guard(async () => {
        try {
          await shiftApi.deleteShift({ id })
          uni.showToast({ title: '已停用', icon: 'success' })
          editorVisible.value = false
          await loadShifts()
        } catch (err) {
          const msg = errorMessage(err, '操作失败')
          uni.showToast({ title: msg, icon: 'none' })
        }
      })
    }
  })
}
</script>

<template>
  <view class="page">
    <PageState :loading="loading" :error="errMsg" loading-text="加载中…">
      <view v-if="!shifts.length" class="empty">当前门店暂无启用班次</view>
      <ShiftCard
        v-for="shift in shifts"
        :key="shift.id"
        :shift="shift"
        :can-edit="isBoss"
        @edit="onEdit"
      />

      <view v-if="isBoss" class="add-btn" hover-class="add-btn-hover" @tap="openAdd">
        <text class="add-plus">+</text>
        <text class="add-text">新增班次</text>
      </view>

      <text v-if="!isBoss" class="footnote">仅门店管理员可新增或修改班次。</text>
    </PageState>

    <ShiftEditorModal
      v-model:visible="editorVisible"
      v-model:form="form"
      :is-add="isAdd"
      :submitting="submitting"
      @submit="onSubmit"
      @delete="onDelete"
      @close="closeEditor"
    />
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
.add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-top: 16rpx;
  margin-bottom: 32rpx;
  padding: 26rpx 24rpx;
  border-radius: 999rpx;
  border: 2rpx solid #1a1c1d;
  background: #fff;
}
.add-btn-hover {
  background: #f9f9fb;
}
.add-plus {
  font-size: 36rpx;
  font-weight: 500;
  margin-right: 12rpx;
  color: #1a1c1d;
  line-height: 1;
}
.add-text {
  font-size: 30rpx;
  font-weight: 600;
  color: #1a1c1d;
}
.footnote {
  display: block;
  margin-top: 40rpx;
  color: #5e5e63;
  line-height: 1.45;
  font-size: 26rpx;
}
</style>
