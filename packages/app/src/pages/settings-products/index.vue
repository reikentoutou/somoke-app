<script setup lang="ts">
import { computed, ref } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import type { Product } from '@somoke/shared'
import { productApi } from '@/api'
import { useSession } from '@/composables/useSession'
import { useCurrentStore } from '@/composables/useCurrentStore'
import { useProductCatalog } from '@/composables/useProductCatalog'
import { useSubmitLock } from '@/composables/useSubmitLock'
import { errorMessage } from '@/utils/errors'
import PageState from '@/components/PageState.vue'
import ProductCategorySection from '@/components/products/ProductCategorySection.vue'
import ProductEditorModal, {
  type ProductEditorForm,
  type ProductEditorMode
} from '@/components/products/ProductEditorModal.vue'

const { ensureReady } = useSession()
const { isBoss } = useCurrentStore()
const catalog = useProductCatalog()
const submitLock = useSubmitLock()

const modalVisible = ref(false)
const mode = ref<ProductEditorMode>('category')
const form = ref<ProductEditorForm>({
  id: 0,
  categoryId: 0,
  name: '',
  unitPrice: '',
  sortOrder: ''
})

const submitting = computed(() => submitLock.running.value)
const categories = computed(() => catalog.activeCategories.value)
const products = computed(() => catalog.visibleProducts.value)

function productsForCategory(categoryId: number): Product[] {
  return products.value.filter(p => p.category_id === categoryId)
}

onShow(() => {
  if (!ensureReady()) return
  void catalog.refresh()
})

function emptyForm(categoryId = 0): ProductEditorForm {
  return {
    id: 0,
    categoryId,
    name: '',
    unitPrice: '',
    sortOrder: '0'
  }
}

function openAddCategory() {
  if (!isBoss.value) return
  mode.value = 'category'
  form.value = emptyForm()
  modalVisible.value = true
}

function openEditCategory(id: number) {
  const hit = categories.value.find(c => c.id === id)
  if (!hit || !isBoss.value) return
  mode.value = 'category'
  form.value = {
    ...emptyForm(),
    id: hit.id,
    name: hit.name,
    sortOrder: String(hit.sort_order)
  }
  modalVisible.value = true
}

function openAddProduct(categoryId: number) {
  if (!isBoss.value) return
  mode.value = 'product'
  form.value = emptyForm(categoryId)
  modalVisible.value = true
}

function openEditProduct(id: number) {
  const hit = products.value.find(p => p.id === id)
  if (!hit || !isBoss.value) return
  mode.value = 'product'
  form.value = {
    id: hit.id,
    categoryId: hit.category_id,
    name: hit.name,
    unitPrice: String(hit.unit_price),
    sortOrder: String(hit.sort_order)
  }
  modalVisible.value = true
}

function validateForm(): string {
  const name = form.value.name.trim()
  if (!name) return '请填写名称'
  if (mode.value === 'category') return ''
  if (!form.value.categoryId) return '请选择分类'
  const price = Number.parseFloat(form.value.unitPrice)
  if (!Number.isFinite(price) || price < 0) return '请填写有效价格'
  return ''
}

function onSubmit() {
  const msg = validateForm()
  if (msg) {
    uni.showToast({ title: msg, icon: 'none' })
    return
  }
  void submitLock.guard(async () => {
    try {
      if (mode.value === 'category') {
        await productApi.saveProductCategory({
          id: form.value.id || undefined,
          name: form.value.name.trim(),
          sort_order: Number.parseInt(form.value.sortOrder, 10) || 0
        })
      } else {
        await productApi.saveProduct({
          id: form.value.id || undefined,
          category_id: form.value.categoryId,
          name: form.value.name.trim(),
          unit_price: Number.parseFloat(form.value.unitPrice) || 0,
          sort_order: Number.parseInt(form.value.sortOrder, 10) || 0
        })
      }
      uni.showToast({ title: '已保存', icon: 'success' })
      modalVisible.value = false
      await catalog.refresh()
    } catch (err) {
      uni.showToast({ title: errorMessage(err, '保存失败'), icon: 'none' })
    }
  })
}

function confirmAction(title: string, content: string, run: () => Promise<void>) {
  uni.showModal({
    title,
    content,
    confirmText: title.includes('删除') ? '删除' : '确认',
    confirmColor: '#ba1a1a',
    success: res => {
      if (!res.confirm) return
      void submitLock.guard(async () => {
        try {
          await run()
          uni.showToast({ title: '操作成功', icon: 'success' })
          await catalog.refresh()
        } catch (err) {
          uni.showToast({ title: errorMessage(err, '操作失败'), icon: 'none' })
        }
      })
    }
  })
}

function onDeleteCategory(id: number) {
  confirmAction(
    '删除分类',
    '分类下所有商品库存都必须先在「库存与现金」校准为 0；未被引用的商品会删除，被历史引用的商品会软删除。确定继续？',
    () => productApi.deleteProductCategory({ id }).then(() => undefined)
  )
}

function onDisableCategory(id: number) {
  confirmAction(
    '停用分类',
    '停用后该分类下商品不再出现在新记账列表，历史记录保留。确定停用？',
    () => productApi.disableProductCategory({ id }).then(() => undefined)
  )
}

function onDisableProduct(id: number) {
  confirmAction('停用商品', '停用后新记账不再显示该商品，历史记录保留。确定停用？', () =>
    productApi.disableProduct({ id }).then(() => undefined)
  )
}

function onDeleteProduct(id: number) {
  confirmAction(
    '删除商品',
    '商品库存必须先在「库存与现金」校准为 0；未被引用的商品会删除，已有历史记录引用的商品会软删除。确定删除？',
    () => productApi.deleteProduct({ id }).then(() => undefined)
  )
}
</script>

<template>
  <view class="page">
    <view class="headline">
      <text class="tag">商品管理</text>
      <text class="title">分类与价格</text>
      <text class="desc">按分类维护商品与价格；库存请在「库存与现金」中补货或校准。</text>
    </view>

    <PageState
      :loading="catalog.loading.value"
      :error="catalog.error.value"
      :is-empty="categories.length === 0"
      empty-text="暂无商品分类"
    >
      <template #empty-actions>
        <view
          v-if="isBoss"
          class="add-category"
          hover-class="add-category-hover"
          @tap="openAddCategory"
        >
          + 新增分类
        </view>
        <text v-else class="footnote">仅门店管理员可新增、修改或删除商品。</text>
      </template>

      <ProductCategorySection
        v-for="category in categories"
        :key="category.id"
        :category="category"
        :products="productsForCategory(category.id)"
        :can-edit="isBoss"
        @edit-category="openEditCategory"
        @disable-category="onDisableCategory"
        @delete-category="onDeleteCategory"
        @add-product="openAddProduct"
        @edit-product="openEditProduct"
        @disable-product="onDisableProduct"
        @delete-product="onDeleteProduct"
      />

      <view
        v-if="isBoss"
        class="add-category"
        hover-class="add-category-hover"
        @tap="openAddCategory"
      >
        + 新增分类
      </view>

      <text v-if="!isBoss" class="footnote">仅门店管理员可新增、修改或删除商品。</text>
    </PageState>

    <ProductEditorModal
      v-model:visible="modalVisible"
      v-model:form="form"
      :mode="mode"
      :categories="categories"
      :submitting="submitting"
      @submit="onSubmit"
    />
  </view>
</template>

<style scoped>
.page {
  min-height: 100vh;
  padding: 32rpx 32rpx 140rpx;
  box-sizing: border-box;
  background: #f9f9fb;
}
.headline {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  margin-bottom: 28rpx;
}
.tag {
  align-self: flex-start;
  padding: 6rpx 16rpx;
  border-radius: 999rpx;
  background: #e6f4ff;
  color: #1677ff;
  font-size: 22rpx;
}
.title {
  font-size: 44rpx;
  font-weight: 700;
  color: #1a1c1d;
}
.desc {
  font-size: 26rpx;
  color: #5e5e63;
}
.add-category {
  margin-top: 16rpx;
  padding: 26rpx 24rpx;
  border-radius: 999rpx;
  border: 2rpx solid #1a1c1d;
  background: #fff;
  text-align: center;
  color: #1a1c1d;
  font-size: 30rpx;
  font-weight: 600;
}
.add-category-hover {
  background: #f3f3f5;
}
.footnote {
  display: block;
  margin-top: 40rpx;
  color: #5e5e63;
  font-size: 26rpx;
}
</style>
