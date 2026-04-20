/**
 * 本地存储键位。
 * 与旧 miniprogram 保持一致，迁移期间两套代码读写同一组 key，数据无需另行迁移。
 */
export const STORAGE_KEYS = {
  token: 'token',
  userInfo: 'userInfo',
  currentStoreId: 'currentStoreId',
  needsOnboarding: 'needsOnboarding',
  needsStoreSelection: 'needsStoreSelection'
} as const

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]

/**
 * mp-weixin 对不存在的 key 返回 ''，不会抛；对 quota / 平台异常才抛。
 * 这里的 try/catch 只是把极端场景（如 setStorageSync 空间不足）降级成 warn，
 * 避免整个应用崩溃；同时保留 console.warn，真机 vConsole / 本地日志可见，
 * 方便定位"token 写入静默丢失"这种难复现的 bug。
 */
function safeGet<T>(key: string): T | undefined {
  try {
    const v = uni.getStorageSync(key) as unknown
    return v === '' || v === undefined || v === null ? undefined : (v as T)
  } catch (err) {
    console.warn('[storage.get] failed', key, err)
    return undefined
  }
}

function safeSet(key: string, value: unknown): void {
  try {
    uni.setStorageSync(key, value)
  } catch (err) {
    console.warn('[storage.set] failed', key, err)
  }
}

function safeRemove(key: string): void {
  try {
    uni.removeStorageSync(key)
  } catch (err) {
    console.warn('[storage.remove] failed', key, err)
  }
}

export const storage = { get: safeGet, set: safeSet, remove: safeRemove }
