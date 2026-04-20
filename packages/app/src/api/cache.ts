/**
 * 内存 TTL 缓存 + 在飞请求去重。
 * 迁移自旧版 miniprogram/utils/apiCache.js，接口精简后在 TS 中给出明确范型。
 */

interface CacheEntry<T> {
  value: T
  expireAt: number
}

const cache = new Map<string, CacheEntry<unknown>>()
const inflight = new Map<string, Promise<unknown>>()

export function getCached<T>(key: string): T | undefined {
  const entry = cache.get(key)
  if (!entry) return undefined
  if (entry.expireAt <= Date.now()) {
    cache.delete(key)
    return undefined
  }
  return entry.value as T
}

export function setCached<T>(key: string, value: T, ttlMs: number): void {
  cache.set(key, { value, expireAt: Date.now() + ttlMs })
}

export function invalidatePrefix(prefix: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key)
  }
}

export function invalidateAll(): void {
  cache.clear()
}

/**
 * 去重并发：同 key 在飞时复用同一个 Promise。
 */
export function dedupe<T>(key: string, run: () => Promise<T>): Promise<T> {
  const running = inflight.get(key) as Promise<T> | undefined
  if (running) return running
  const p = run().finally(() => inflight.delete(key))
  inflight.set(key, p)
  return p
}
