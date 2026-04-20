import { computed } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { normalizeStores } from '@/stores/user'

/**
 * 当前门店派生态：store_id / 角色 / 名称，避免每个页面重复 getStoreIdFromUserInfo。
 */
export function useCurrentStore() {
  const auth = useAuthStore()

  const storeId = computed(() => auth.currentStoreId)
  const role = computed(() => auth.roleInCurrentStore)
  const isBoss = computed(() => auth.isBoss)
  const displayName = computed(() => {
    const sid = auth.currentStoreId
    if (!sid) return ''
    const hit = normalizeStores(auth.userInfo).find(s => s.store_id === sid)
    return hit?.name || `门店 #${sid}`
  })

  return { storeId, role, isBoss, displayName }
}
