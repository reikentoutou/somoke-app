import type { LoginRes, Role, StoreBrief, UserInfo } from '@somoke/shared'

/**
 * 纯函数工具：从 userInfo 推导"当前店 id / 当前店角色 / 是否需要引导流程"。
 * 与旧 miniprogram/utils/store.js 一致；TS 版本不依赖 getApp()，全部参数化。
 */

function toStoreId(raw: unknown): number {
  if (raw === null || raw === undefined || raw === '') return 0
  const n = typeof raw === 'number' ? raw : Number.parseInt(String(raw), 10)
  return Number.isNaN(n) || n <= 0 ? 0 : n
}

export function normalizeStores(u: Partial<UserInfo> | null | undefined): StoreBrief[] {
  if (!u || !Array.isArray(u.stores)) return []
  const out: StoreBrief[] = []
  for (const row of u.stores) {
    const sid = toStoreId(row?.store_id)
    if (!sid) continue
    const rRaw = typeof row?.role === 'number' ? row.role : Number.parseInt(String(row?.role), 10)
    const role: Role = rRaw === 1 ? 1 : 2
    out.push({ store_id: sid, name: row?.name ?? '', role })
  }
  return out
}

export function getStoreIdFromUserInfo(u: Partial<UserInfo> | null | undefined): number {
  if (!u) return 0
  const stores = normalizeStores(u)
  if (!stores.length) return 0
  const cur = toStoreId(u.current_store_id)
  if (cur && stores.some(s => s.store_id === cur)) return cur
  const compat = toStoreId(u.store_id)
  if (compat && stores.some(s => s.store_id === compat)) return compat
  return stores.length === 1 ? stores[0]!.store_id : 0
}

export function getRoleInCurrentStore(u: Partial<UserInfo> | null | undefined): Role | null {
  const sid = getStoreIdFromUserInfo(u)
  if (!sid) return null
  const stores = normalizeStores(u)
  const hit = stores.find(s => s.store_id === sid)
  if (hit) return hit.role
  if (typeof u?.role === 'number' && (u.role === 1 || u.role === 2)) return u.role
  return null
}

export function isBossInCurrentStore(u: Partial<UserInfo> | null | undefined): boolean {
  return getRoleInCurrentStore(u) === 1
}

export function loginPayloadNeedsOnboarding(data: LoginRes | null | undefined): boolean {
  if (!data) return true
  if (data.needs_onboarding) return true
  return normalizeStores(data.user_info).length === 0
}

export function loginPayloadNeedsStoreSelection(data: LoginRes | null | undefined): boolean {
  if (!data) return false
  if (data.needs_store_selection) return true
  const stores = normalizeStores(data.user_info)
  if (stores.length <= 1) return false
  return getStoreIdFromUserInfo(data.user_info) <= 0
}
