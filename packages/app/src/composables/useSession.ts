import { useAuthStore } from '@/stores/auth'

/**
 * 会话守卫：对应旧版 `auth.js` 的三连 redirectToXxxIfNeeded。
 * 使用约定：所有需要登录的页面在 onShow 开头写：
 *
 *   if (!useSession().ensureReady()) return
 *
 * 返回 false 表示已触发 redirect / reLaunch，调用方应立即 return。
 */
export function useSession() {
  const auth = useAuthStore()

  function redirectOnce(url: string): false {
    uni.redirectTo({ url, fail: () => uni.reLaunch({ url }) })
    return false
  }

  function redirectToLoginIfNeeded(): boolean {
    if (auth.token) return true
    return redirectOnce('/pages/login/index')
  }

  function redirectToOnboardingIfNeeded(): boolean {
    if (!auth.needsOnboarding) return true
    return redirectOnce('/pages/onboarding/index')
  }

  function redirectToStoreSelectIfNeeded(): boolean {
    if (!auth.needsStoreSelection) return true
    return redirectOnce('/pages/store-select/index')
  }

  /** 三连检查合成一个入口，省掉各页面重复样板 */
  function ensureReady(): boolean {
    if (!redirectToLoginIfNeeded()) return false
    if (!redirectToOnboardingIfNeeded()) return false
    if (!redirectToStoreSelectIfNeeded()) return false
    return true
  }

  return {
    auth,
    ensureReady,
    redirectToLoginIfNeeded,
    redirectToOnboardingIfNeeded,
    redirectToStoreSelectIfNeeded
  }
}
