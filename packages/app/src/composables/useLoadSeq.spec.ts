import { describe, expect, it } from 'vitest'
import { useLoadSeq } from './useLoadSeq'

describe('useLoadSeq', () => {
  it('后发 bump 使先前 seq 变为 stale', () => {
    const { bump, isStale } = useLoadSeq()
    const a = bump()
    const b = bump()
    expect(isStale(a)).toBe(true)
    expect(isStale(b)).toBe(false)
  })

  it('不 bump 时 current 始终为 0', () => {
    const { current } = useLoadSeq()
    expect(current()).toBe(0)
  })
})
