<script setup lang="ts">
import { ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useSession } from '@/composables/useSession'
import { useTabBarSync } from '@/composables/useTabBarSync'
import LedgerRecordForm from '@/components/ledger/LedgerRecordForm.vue'

/**
 * 录入 Tab：只负责新增。修改走 `shift-detail` 的内联编辑。
 * 页面只做：会话守卫 + 表头 + 组合 LedgerRecordForm，不持有表单状态。
 */
const { ensureReady } = useSession()
useTabBarSync(1)

/**
 * uni-app 的 `uni-mp-vue` runtime 没有导出 Vue 3.5 的 `useTemplateRef`，
 * 这里回退到 `ref + 模板 ref="formRef"`：变量名与模板字符串一致即可自动绑定。
 */
const formRef = ref<InstanceType<typeof LedgerRecordForm> | null>(null)

const entryTagLabel = ref('新增条目')
const entryTitle = ref('新增记账数据')

onShow(() => {
  if (!ensureReady()) return
  formRef.value?.reloadDeps()
})

function onSubmitSuccess() {
  // 新增成功后 LedgerRecordForm 内部已 toast + reset，这里无需额外动作
}
</script>

<template>
  <view class="entry-page">
    <view class="headline">
      <text class="tag">{{ entryTagLabel }}</text>
      <text class="title">{{ entryTitle }}</text>
    </view>

    <LedgerRecordForm ref="formRef" mode="create" @submit-success="onSubmitSuccess" />

    <view class="spacer" />
  </view>
</template>

<style scoped>
.entry-page {
  min-height: 100vh;
  background: #f9f9fb;
  padding-bottom: 160rpx;
}
.headline {
  padding: 48rpx 48rpx 0;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.tag {
  font-size: 22rpx;
  color: #1677ff;
  background: #e6f4ff;
  align-self: flex-start;
  padding: 6rpx 16rpx;
  border-radius: 999rpx;
}
.title {
  font-size: 44rpx;
  font-weight: 700;
  color: #1a1c1d;
}
.spacer {
  height: 120rpx;
}
</style>
