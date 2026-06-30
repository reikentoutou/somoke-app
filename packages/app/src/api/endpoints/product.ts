import type {
  ProductCatalogListReq,
  ProductCategoryDeleteReq,
  ProductCategoryDisableReq,
  ProductCategorySaveReq,
  ProductDeleteReq,
  ProductDisableReq,
  ProductSaveReq
} from '@somoke/shared'
import { rpc, rpcCached } from '../client'

const PRODUCT_CATALOG_TTL_MS = 30_000

export function listProductCatalog(req: ProductCatalogListReq = {}) {
  return rpcCached('productCatalogList', req, {
    key: 'productCatalog:',
    ttlMs: PRODUCT_CATALOG_TTL_MS
  })
}

export function saveProductCategory(req: ProductCategorySaveReq) {
  return rpc('productCategorySave', req)
}

export function disableProductCategory(req: ProductCategoryDisableReq) {
  return rpc('productCategoryDisable', req)
}

export function deleteProductCategory(req: ProductCategoryDeleteReq) {
  return rpc('productCategoryDelete', req)
}

export function saveProduct(req: ProductSaveReq) {
  return rpc('productSave', req)
}

export function disableProduct(req: ProductDisableReq) {
  return rpc('productDisable', req)
}

export function deleteProduct(req: ProductDeleteReq) {
  return rpc('productDelete', req)
}
