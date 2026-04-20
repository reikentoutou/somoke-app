import { defineStore } from 'pinia'
import type { LoginRes, Role, Store, StoreBrief, StoreJoinRes, UserInfo } from '@somoke/shared'
import { storage, STORAGE_KEYS } from './keys'
import {
  getRoleInCurrentStore,
  getStoreIdFromUserInfo,
  loginPayloadNeedsOnboarding,
  loginPayloadNeedsStoreSelection,
  normalizeStores
} from './user'

interface AuthState {
  token: string
  userInfo: UserInfo | null
  currentStoreId: number
  needsOnboarding: boolean
  needsStoreSelection: boolean
}

function emptyUser(): UserInfo {
  return {
    id: 0,
    nickname: '',
    avatar_url: '',
    current_store_id: null,
    store_id: null,
    role: 2,
    stores: [],
    store_count: 0
  }
}

/**
 * 会话存储：启动时从 storage 水合，登录 / 切店 / 成员变更时更新并同步回 storage。
 * 替代旧版 app.globalData + utils/store.js 的复合状态。
 */
export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    token: '',
    userInfo: null,
    currentStoreId: 0,
    needsOnboarding: false,
    needsStoreSelection: false
  }),

  getters: {
    isLoggedIn: (s): boolean => Boolean(s.token),
    roleInCurrentStore: (s): Role | null => getRoleInCurrentStore(s.userInfo),
    isBoss(): boolean {
      return this.roleInCurrentStore === 1
    }
  },

  actions: {
    hydrateFromStorage() {
      const token = storage.get<string>(STORAGE_KEYS.token) ?? ''
      const userInfo = storage.get<UserInfo>(STORAGE_KEYS.userInfo) ?? null
      const needsOnboarding = storage.get<boolean>(STORAGE_KEYS.needsOnboarding) === true
      const needsStoreSelection = storage.get<boolean>(STORAGE_KEYS.needsStoreSelection) === true
      const currentStoreId = needsStoreSelection ? 0 : getStoreIdFromUserInfo(userInfo)

      this.$patch({
        token,
        userInfo,
        currentStoreId,
        needsOnboarding,
        needsStoreSelection
      })
    },

    /**
     * login / storeSwitch 成功后刷新会话。
     */
    applyLoginSuccess(res: LoginRes) {
      const user = res.user_info
      const needsOnboarding = loginPayloadNeedsOnboarding(res)
      const needsStoreSelection = loginPayloadNeedsStoreSelection(res)
      const sid = needsOnboarding || needsStoreSelection ? 0 : getStoreIdFromUserInfo(user)

      this.$patch({
        token: res.token,
        userInfo: user,
        currentStoreId: sid,
        needsOnboarding,
        needsStoreSelection
      })

      storage.set(STORAGE_KEYS.token, res.token)
      storage.set(STORAGE_KEYS.userInfo, user)
      storage.set(STORAGE_KEYS.needsOnboarding, needsOnboarding)
      storage.set(STORAGE_KEYS.needsStoreSelection, needsStoreSelection)
      storage.set(STORAGE_KEYS.currentStoreId, sid)
    },

    applyUserInfoPatch(userInfo: UserInfo) {
      const stores = normalizeStores(userInfo)
      const sid = getStoreIdFromUserInfo(userInfo)
      const needsOnboarding = stores.length === 0
      const needsStoreSelection = stores.length > 1 && sid <= 0

      this.$patch({
        userInfo,
        currentStoreId: sid,
        needsOnboarding,
        needsStoreSelection
      })
      storage.set(STORAGE_KEYS.userInfo, userInfo)
      storage.set(STORAGE_KEYS.needsOnboarding, needsOnboarding)
      storage.set(STORAGE_KEYS.needsStoreSelection, needsStoreSelection)
      storage.set(STORAGE_KEYS.currentStoreId, sid)
    },

    applyStoreSwitch(newStoreId: number) {
      if (!this.userInfo || newStoreId <= 0) return
      const merged: UserInfo = {
        ...this.userInfo,
        current_store_id: newStoreId,
        store_id: newStoreId
      }
      this.applyUserInfoPatch(merged)
      this.needsStoreSelection = false
      storage.set(STORAGE_KEYS.needsStoreSelection, false)
    },

    /** storeCreate 成功：把新建门店并入列表并设为当前 */
    applyStoreCreated(store: Store) {
      const id = store.store_id
      if (!id || id <= 0) return null
      const base = this.userInfo ?? emptyUser()
      const stores = Array.isArray(base.stores) ? base.stores.slice() : []
      const hit = stores.findIndex(s => s.store_id === id)
      const brief: StoreBrief = { store_id: id, name: store.name ?? '', role: 1 }
      if (hit >= 0) stores[hit] = brief
      else stores.push(brief)
      const merged: UserInfo = {
        ...base,
        current_store_id: id,
        store_id: id,
        role: 1,
        stores,
        store_count: stores.length
      }
      this.applyUserInfoPatch(merged)
      return merged
    },

    /** storeJoin 成功：把新加入门店并入列表并设为当前 */
    applyStoreJoined(res: StoreJoinRes) {
      const id = res.store_id
      if (!id || id <= 0) return null
      const role: Role = res.role === 1 ? 1 : 2
      const base = this.userInfo ?? emptyUser()
      const stores = Array.isArray(base.stores) ? base.stores.slice() : []
      const hit = stores.findIndex(s => s.store_id === id)
      const brief: StoreBrief = { store_id: id, name: res.store_name ?? '', role }
      if (hit >= 0) stores[hit] = brief
      else stores.push(brief)
      const merged: UserInfo = {
        ...base,
        current_store_id: id,
        store_id: id,
        role,
        stores,
        store_count: stores.length
      }
      this.applyUserInfoPatch(merged)
      return merged
    },

    /** getStores 刷新：不改变当前门店，除非列表中已无当前店 */
    applyStoresListRefreshed(stores: StoreBrief[], currentStoreId?: number | null) {
      const base = this.userInfo ?? emptyUser()
      const safeStores = Array.isArray(stores) ? stores : []
      const patch: UserInfo = {
        ...base,
        stores: safeStores,
        store_count: safeStores.length
      }
      if (currentStoreId != null) {
        const cs = Number.parseInt(String(currentStoreId), 10)
        if (!Number.isNaN(cs) && cs > 0) {
          patch.current_store_id = cs
          patch.store_id = cs
        } else {
          patch.current_store_id = null
          patch.store_id = null
        }
      }
      this.applyUserInfoPatch(patch)
      return patch
    },

    clearSession() {
      this.$patch({
        token: '',
        userInfo: null,
        currentStoreId: 0,
        needsOnboarding: false,
        needsStoreSelection: false
      })
      for (const key of Object.values(STORAGE_KEYS)) {
        storage.remove(key)
      }
    },

    /** 兜底：没有 userInfo 时提供一个空壳，避免模板里反复 undefined 检查 */
    ensureUserInfo(): UserInfo {
      if (!this.userInfo) this.userInfo = emptyUser()
      return this.userInfo
    }
  }
})
