import { computed, shallowRef } from 'vue'
import type { Product, ProductCategory } from '@somoke/shared'
import { productApi } from '@/api'
import { errorMessage } from '@/utils/errors'

export function useProductCatalog() {
  const categories = shallowRef<ProductCategory[]>([])
  const products = shallowRef<Product[]>([])
  const loading = shallowRef(false)
  const error = shallowRef('')

  const activeCategories = computed(() =>
    categories.value
      .filter(c => c.is_deleted !== 1)
      .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
  )

  const visibleProducts = computed(() =>
    products.value
      .filter(p => p.is_deleted !== 1)
      .sort((a, b) => a.category_id - b.category_id || a.sort_order - b.sort_order || a.id - b.id)
  )

  const activeProducts = computed(() => visibleProducts.value.filter(p => p.is_active !== 0))

  async function refresh(): Promise<void> {
    loading.value = true
    error.value = ''
    try {
      const res = await productApi.listProductCatalog()
      categories.value = Array.isArray(res.categories) ? res.categories : []
      products.value = Array.isArray(res.products) ? res.products : []
    } catch (err) {
      error.value = errorMessage(err, '商品加载失败')
      throw err
    } finally {
      loading.value = false
    }
  }

  return {
    categories,
    products,
    activeCategories,
    visibleProducts,
    activeProducts,
    loading,
    error,
    refresh
  }
}
