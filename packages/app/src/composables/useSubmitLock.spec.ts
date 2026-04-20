import { describe, expect, it, vi } from 'vitest'
import { useSubmitLock } from './useSubmitLock'

describe('useSubmitLock', () => {
  it('第二次并发调用被吞，首次完成后 running=false', async () => {
    const { running, guard } = useSubmitLock()
    const spy = vi.fn(async () => {
      await new Promise<void>(resolve => {
        queueMicrotask(() => resolve())
      })
      return 'ok'
    })

    const first = guard(spy)
    const second = guard(spy)

    expect(running.value).toBe(true)

    const [a, b] = await Promise.all([first, second])
    expect(a).toBe('ok')
    expect(b).toBeUndefined()
    expect(spy).toHaveBeenCalledTimes(1)
    expect(running.value).toBe(false)
  })

  it('抛错也会释放锁', async () => {
    const { running, guard } = useSubmitLock()
    await expect(
      guard(async () => {
        throw new Error('boom')
      })
    ).rejects.toThrow('boom')
    expect(running.value).toBe(false)
  })
})
