<script setup lang="ts">
import { computed, reactive, ref, shallowRef } from 'vue'
import { onShow, onPullDownRefresh, onReachBottom } from '@dcloudio/uni-app'
import type { LedgerEntry } from '@somoke/shared'
import { ledgerApi, storeApi } from '@/api'
import { useSession } from '@/composables/useSession'
import { usePagination } from '@/composables/usePagination'
import { useSubmitLock } from '@/composables/useSubmitLock'
import {
  ACTION_CONFIG,
  decorateLedgerEntry,
  filterByCategory,
  validateActionPayload,
  type LedgerCategory,
  type OpsActionKey
} from '@/utils/stockLedger'

import StockLedgerSummary from '@/components/stock-ledger/StockLedgerSummary.vue'
import StockLedgerActions from '@/components/stock-ledger/StockLedgerActions.vue'
import StockLedgerFilterBar from '@/components/stock-ledger/StockLedgerFilterBar.vue'
import StockLedgerTimelineItem from '@/components/stock-ledger/StockLedgerTimelineItem.vue'
import StockLedgerActionModal from '@/components/stock-ledger/StockLedgerActionModal.vue'
import PageState from '@/components/PageState.vue'
import LoadMoreFooter from '@/components/LoadMoreFooter.vue'
import { errorMessage } from '@/utils/errors'

/**
 * 运营与流水：
 * - 顶部汇总（库存 / 现金） + 四快捷操作（仅店长）；
 * - 下方按类目筛选的时间线流水，支持分页加载。
 * - 所有装饰 / 校验都走 utils/stockLedger 纯函数；页面只做请求编排与 UI 组合。
 */

const PAGE_SIZE = 50

const { ensureReady, auth } = useSession()

const isBoss = computed(() => auth.isBoss)

const store = ref<{ current_stock: number; current_cash: number }>({
  current_stock: 0,
  current_cash: 0
})

const category = ref<LedgerCategory>('all')
const raw = shallowRef<LedgerEntry[]>([])

const pager = usePagination<LedgerEntry>(cursor =>
  ledgerApi.listLedger({ cursor: cursor ?? null, limit: PAGE_SIZE }).then(r => ({
    items: r.items,
    has_more: r.has_more,
    next_cursor: r.next_cursor
  }))
)

const decorated = computed(() => raw.value.map(decorateLedgerEntry))
const visibleItems = computed(() => filterByCategory(decorated.value, category.value))

// 同步 pager.items -> raw（pager.items 是平铺数据，装饰在 computed 里做以保持纯净）
function syncPagerToRaw() {
  raw.value = pager.items.value.slice()
}

const loading = computed(() => pager.loading.value)
const loadingMore = computed(() => pager.loadingMore.value)
const hasMore = computed(() => pager.hasMore.value)
const pageError = computed(() => pager.error.value)

async function fetchAll(): Promise<void> {
  try {
    const detail = await storeApi.getStoreDetail({})
    store.value = {
      current_stock: Number(detail.current_stock) || 0,
      current_cash: Number(detail.current_cash) || 0
    }
  } catch {
    // 不阻塞 ledger 列表加载；失败时保留上次数值或 0
  }
  await pager.refresh()
  syncPagerToRaw()
}

async function loadMore(): Promise<void> {
  await pager.loadMore()
  syncPagerToRaw()
}

onShow(() => {
  if (!ensureReady()) return
  void fetchAll()
})

onPullDownRefresh(() => {
  void fetchAll().finally(() => uni.stopPullDownRefresh())
})

onReachBottom(() => {
  if (hasMore.value && !loadingMore.value && !loading.value) {
    void loadMore()
  }
})

/* ---------------------- action modal ---------------------- */

const modal = reactive({
  visible: false,
  action: 'restock' as OpsActionKey,
  valStock: '',
  valCash: '',
  note: ''
})

const submitLock = useSubmitLock()
const submitting = computed(() => submitLock.running.value)

function openModal(key: OpsActionKey) {
  modal.action = key
  modal.valStock = ''
  modal.valCash = ''
  modal.note = ''
  modal.visible = true
}

function closeModal() {
  modal.visible = false
}

async function onSubmit(): Promise<void> {
  const v = validateActionPayload(modal.action, {
    val_stock: modal.valStock,
    val_cash: modal.valCash
  })
  if (!v.ok) {
    uni.showToast({ title: v.message || ACTION_CONFIG[modal.action].invalidMessage, icon: 'none' })
    return
  }

  await submitLock.guard(async () => {
    uni.showLoading({ title: '提交中', mask: true })
    try {
      const res = await ledgerApi.opsAction({
        action_type: modal.action,
        val_stock: v.val_stock,
        val_cash: v.val_cash,
        note: modal.note.trim()
      })
      uni.hideLoading()
      if (res.skipped) {
        uni.showToast({ title: '未变化', icon: 'none' })
      } else {
        uni.showToast({ title: '操作成功', icon: 'success' })
      }
      closeModal()
      await fetchAll()
    } catch (err) {
      uni.hideLoading()
      const msg = errorMessage(err, '操作失败')
      uni.showToast({ title: msg, icon: 'none' })
    }
  })
}
</script>

<template>
  <view class="page">
    <StockLedgerSummary :current-stock="store.current_stock" :current-cash="store.current_cash" />

    <StockLedgerActions v-if="isBoss" @action="openModal" />

    <view class="section-head">
      <text class="title">流水</text>
      <text class="hint">按类目筛选，按班次回溯</text>
    </view>

    <StockLedgerFilterBar v-model="category" />

    <PageState
      :loading="loading"
      :error="pageError"
      :is-empty="visibleItems.length === 0"
      loading-text="加载中…"
    >
      <template #empty-actions>
        <view class="empty">
          <text class="empty-title">暂无流水</text>
          <text class="empty-hint">当前筛选下没有记录，切换类目再试</text>
        </view>
      </template>

      <view class="timeline">
        <StockLedgerTimelineItem
          v-for="(item, idx) in visibleItems"
          :key="item.id"
          :item="item"
          :last="idx === visibleItems.length - 1"
        />
      </view>

      <LoadMoreFooter :loading="loadingMore" :has-more="hasMore" @load-more="loadMore" />
    </PageState>

    <view class="bottom-spacer" />

    <StockLedgerActionModal
      v-model:visible="modal.visible"
      v-model:val-stock="modal.valStock"
      v-model:val-cash="modal.valCash"
      v-model:note="modal.note"
      :action="modal.action"
      :submitting="submitting"
      @submit="onSubmit"
    />
  </view>
</template>

<style scoped>
.page {
  padding: 24rpx 40rpx 240rpx;
  background: #f9f9fb;
  min-height: 100vh;
}
.section-head {
  margin-bottom: 20rpx;
}
.title {
  font-size: 32rpx;
  font-weight: 700;
  color: #1a1c1d;
  letter-spacing: -0.5rpx;
}
.hint {
  display: block;
  color: #8a8a8f;
  margin-top: 8rpx;
  font-size: 24rpx;
}
.timeline {
  position: relative;
  padding-left: 8rpx;
}
.empty {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8rpx;
  padding: 40rpx 0;
}
.empty-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #474747;
}
.empty-hint {
  font-size: 24rpx;
  color: #8a8a8f;
}
.bottom-spacer {
  height: 80rpx;
}
</style>
