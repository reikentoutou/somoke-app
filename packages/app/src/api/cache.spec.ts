import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { dedupe, getCached, invalidateAll, invalidatePrefix, setCached } from './cache'

describe('TTL cache', () => {
  beforeEach(() => {
    invalidateAll()
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('命中未过期的值，过期后返回 undefined', () => {
    setCached('storeDetail:abc', { foo: 1 }, 1000)
    expect(getCached('storeDetail:abc')).toEqual({ foo: 1 })
    vi.advanceTimersByTime(1001)
    expect(getCached('storeDetail:abc')).toBeUndefined()
  })

  it('按前缀失效命中项', () => {
    setCached('storeDetail:a', 1, 10_000)
    setCached('shifts:a', 2, 10_000)
    invalidatePrefix('storeDetail:')
    expect(getCached('storeDetail:a')).toBeUndefined()
    expect(getCached('shifts:a')).toBe(2)
  })
})

describe('inflight dedupe', () => {
  it('同 key 并发调用只触发一次执行', async () => {
    let count = 0
    const run = () =>
      new Promise<number>(resolve => {
        count += 1
        queueMicrotask(() => resolve(count))
      })
    const [a, b, c] = await Promise.all([dedupe('k', run), dedupe('k', run), dedupe('k', run)])
    expect(count).toBe(1)
    expect(a).toBe(1)
    expect(b).toBe(1)
    expect(c).toBe(1)
  })
})
