<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import type { Product } from '@somoke/shared'
import { ledgerApi, productApi } from '@/api'
import { useSession } from '@/composables/useSession'
import { useSubmitLock } from '@/composables/useSubmitLock'
import PageState from '@/components/PageState.vue'
import { errorMessage } from '@/utils/errors'

/**
 * 库存调整：独立的「管理员」入口。
 * - 输入实盘库存，保存后覆盖 store.current_stock，并记一条 adjust_stock 流水。
 * - 非店长进入会提示并自动返回，避免将 UI 暴露给记录员。
 */

const { ensureReady, auth } = useSession()
const submitLock = useSubmitLock()

const MAX_STOCK = 10_000_000

const stockLoading = ref(true)
const loadError = ref('')
const products = ref<Product[]>([])
const productIndex = ref(0)
const currentStock = ref(0)
const targetStock = ref('')
const note = ref('')

const submitting = computed(() => submitLock.running.value)
const selectedProduct = computed(() => products.value[productIndex.value] ?? null)

function syncSelectedProductStock(): void {
  const hit = selectedProduct.value
  const safe = hit ? Math.max(0, Math.floor(Number(hit.current_stock) || 0)) : 0
  currentStock.value = safe
  targetStock.value = hit ? String(safe) : ''
}

async function loadCurrentStock(): Promise<void> {
  stockLoading.value = true
  loadError.value = ''
  try {
    const res = await productApi.listProductCatalog({})
    products.value = (res.products ?? []).filter(p => p.is_active !== 0 && p.is_deleted !== 1)
    productIndex.value = 0
    syncSelectedProductStock()
  } catch (err) {
    const msg = errorMessage(err, '加载失败')
    loadError.value = msg
  } finally {
    stockLoading.value = false
  }
}

function guardBossOrExit(): boolean {
  if (auth.isBoss) return true
  uni.showToast({ title: '仅管理员可使用', icon: 'none' })
  setTimeout(() => {
    uni.navigateBack({ delta: 1 })
  }, 400)
  return false
}

onShow(() => {
  if (!ensureReady()) return
  if (!guardBossOrExit()) return
  void loadCurrentStock()
})

function onProductPick(e: Event): void {
  const raw = (e as unknown as { detail?: { value?: string | number } }).detail?.value ?? 0
  const ix = Number.parseInt(String(raw), 10)
  productIndex.value = Number.isFinite(ix)
    ? Math.max(0, Math.min(ix, products.value.length - 1))
    : 0
  syncSelectedProductStock()
}

function onSubmit(): void {
  const product = selectedProduct.value
  if (!product) {
    uni.showToast({ title: '请选择商品', icon: 'none' })
    return
  }
  const target = Number.parseInt((targetStock.value ?? '').trim(), 10)
  if (!Number.isFinite(target) || target < 0) {
    uni.showToast({ title: '请输入有效的实盘件数', icon: 'none' })
    return
  }
  if (target > MAX_STOCK) {
    uni.showToast({ title: `实盘件数不能超过 ${MAX_STOCK}`, icon: 'none' })
    return
  }

  void submitLock.guard(async () => {
    try {
      const res = await ledgerApi.adjustStock({
        product_id: product.id,
        target_stock: target,
        note: note.value.trim()
      })
      currentStock.value = target
      targetStock.value = String(target)
      products.value = products.value.map(p =>
        p.id === product.id ? { ...p, current_stock: target } : p
      )
      note.value = ''
      uni.showToast({
        title: res.skipped ? '未变化' : '已校准',
        icon: res.skipped ? 'none' : 'success'
      })
    } catch (err) {
      const msg = errorMessage(err, '保存失败')
      uni.showToast({ title: msg, icon: 'none' })
    }
  })
}
</script>

<template>
  <view class="page">
    <text class="hint">
      先选择商品，再将「实盘库存」填为该商品当前实际件数。保存后会更新商品库存和门店总库存，并记一条流水。
    </text>

    <PageState :loading="stockLoading" :error="loadError" loading-text="加载当前库存…">
      <view class="card">
        <text class="label">商品</text>
        <picker
          v-if="products.length"
          mode="selector"
          :range="products"
          range-key="name"
          :value="productIndex"
          @change="onProductPick"
        >
          <view class="picker-val">{{ selectedProduct?.name || '请选择商品' }}</view>
        </picker>
        <text v-else class="empty-products">暂无启用商品，请先在设置中添加商品。</text>
      </view>

      <view class="card">
        <text class="label">该商品当前库存</text>
        <text class="headline">{{ currentStock }} 件</text>
      </view>

      <view class="card">
        <text class="label">实盘库存（件）</text>
        <input v-model="targetStock" class="input" type="number" placeholder="请输入整数" />
      </view>

      <view class="card">
        <text class="label">备注（可选，最多 200 字）</text>
        <textarea v-model="note" class="textarea" maxlength="200" placeholder="如：月末盘点调整" />
      </view>

      <view
        :class="['submit', { disabled: submitting }]"
        hover-class="submit-hover"
        @tap="onSubmit"
      >
        <text>{{ submitting ? '保存中…' : '保存校准' }}</text>
      </view>
    </PageState>

    <view class="bottom-spacer" />
  </view>
</template>

<style scoped>
.page {
  padding: 24rpx 40rpx 240rpx;
  background: #f9f9fb;
  min-height: 100vh;
}
.hint {
  display: block;
  color: #5e5e63;
  margin-bottom: 32rpx;
  line-height: 1.45;
  font-size: 26rpx;
}
.card {
  padding: 36rpx 40rpx;
  margin-bottom: 24rpx;
  background: #fff;
  border-radius: 24rpx;
  border: 2rpx solid rgba(0, 0, 0, 0.04);
}
.label {
  display: block;
  margin-bottom: 16rpx;
  font-size: 24rpx;
  color: #8a8a8f;
}
.headline {
  display: block;
  font-size: 48rpx;
  font-weight: 700;
  color: #1a1c1d;
  margin-top: 8rpx;
}
.input {
  width: 100%;
  padding: 16rpx 0;
  border-bottom: 2rpx solid #e8e8ea;
  font-size: 32rpx;
  color: #1a1c1d;
}
.picker-val {
  width: 100%;
  padding: 16rpx 0;
  border-bottom: 2rpx solid #e8e8ea;
  font-size: 32rpx;
  color: #1a1c1d;
}
.empty-products {
  display: block;
  color: #8a8a8f;
  font-size: 26rpx;
  line-height: 1.45;
}
.textarea {
  width: 100%;
  min-height: 160rpx;
  margin-top: 12rpx;
  padding: 16rpx;
  box-sizing: border-box;
  background: #f9f9fb;
  border-radius: 12rpx;
  font-size: 28rpx;
  color: #1a1c1d;
}
.submit {
  margin-top: 48rpx;
  padding: 28rpx 32rpx;
  border-radius: 16rpx;
  background: #1a1c1d;
  color: #fff;
  text-align: center;
  font-weight: 500;
  font-size: 28rpx;
}
.submit-hover {
  opacity: 0.88;
}
.submit.disabled {
  opacity: 0.5;
}
.bottom-spacer {
  height: 80rpx;
}
</style>
