import { describe, expect, it } from 'vitest'
import { usePagination, type PageFetcher } from './usePagination'

function makeFetcher(): PageFetcher<number> {
  let batch = 0
  return async cursor => {
    batch += 1
    if (cursor === null) {
      return { items: [1, 2, 3], has_more: true, next_cursor: 3 }
    }
    if (cursor === 3) {
      return { items: [4, 5], has_more: false, next_cursor: null }
    }
    return { items: [], has_more: false, next_cursor: null }
  }
}

describe('usePagination', () => {
  it('refresh 重置 + loadMore 追加', async () => {
    const pager = usePagination<number>(makeFetcher())
    await pager.refresh()
    expect(pager.items.value).toEqual([1, 2, 3])
    expect(pager.hasMore.value).toBe(true)

    await pager.loadMore()
    expect(pager.items.value).toEqual([1, 2, 3, 4, 5])
    expect(pager.hasMore.value).toBe(false)
  })

  it('hasMore=false 时 loadMore 不再触发 fetcher', async () => {
    let calls = 0
    const pager = usePagination<number>(async () => {
      calls += 1
      return { items: [], has_more: false, next_cursor: null }
    })
    await pager.refresh()
    expect(calls).toBe(1)
    await pager.loadMore()
    expect(calls).toBe(1)
  })
})
