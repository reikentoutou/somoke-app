import type {
  GetStoresReq,
  GetStoresRes,
  Store,
  StoreCreateReq,
  StoreCreateRes,
  StoreDeleteReq,
  StoreDeleteRes,
  StoreDetailReq,
  StoreDetailRes,
  StoreJoinReq,
  StoreJoinRes,
  StoreSwitchReq,
  StoreSwitchRes,
  StoreUpdateReq,
  StoreUpdateRes
} from '@somoke/shared'
import { rpc, rpcCached } from '../client'

const STORE_DETAIL_TTL_MS = 30_000

export function getStores(req: GetStoresReq = {}) {
  return rpc('getStores', req)
}

/**
 * 历史云函数里 Store 文档字段名是 `id`，Shared 契约用 `store_id` 作统一键名；
 * 在 API 边界做一次归一化，后续所有上层代码只看到 `store_id`。
 */
function normalizeStore(raw: Store & { id?: number }): Store {
  const sid = raw.store_id && raw.store_id > 0 ? raw.store_id : raw.id && raw.id > 0 ? raw.id : 0
  return { ...raw, store_id: sid }
}

export async function createStore(req: StoreCreateReq): Promise<StoreCreateRes> {
  const res = await rpc('storeCreate', req)
  return { store: normalizeStore(res.store) }
}

export function switchStore(req: StoreSwitchReq) {
  return rpc('storeSwitch', req)
}

export function joinStore(req: StoreJoinReq) {
  return rpc('storeJoin', req)
}

export function updateStore(req: StoreUpdateReq): Promise<StoreUpdateRes> {
  return rpc('storeUpdate', req)
}

export function deleteStore(req: StoreDeleteReq): Promise<StoreDeleteRes> {
  return rpc('storeDelete', req)
}

/**
 * 门店详情（含 recorder_names）短 TTL 缓存，写操作会自动失效。
 */
export function getStoreDetail(req: StoreDetailReq = {}): Promise<StoreDetailRes> {
  return rpcCached('storeDetail', req, {
    key: 'storeDetail:',
    ttlMs: STORE_DETAIL_TTL_MS
  })
}

/** 抑制"未使用符号"告警，下列类型在调用方推导返回值时需要 */
export type {
  GetStoresRes,
  StoreCreateRes,
  StoreSwitchRes,
  StoreJoinRes,
  StoreUpdateRes,
  StoreDeleteRes
}
