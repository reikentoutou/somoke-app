import { ref, computed } from 'vue'
import { useLoadSeq } from './useLoadSeq'
import { errorMessage } from '@/utils/errors'

/**
 * 通用分页：对齐后端 `{entries, has_more, next_cursor}` 的契约。
 *
 * 典型用法（stock-ledger）：
 *   const pager = usePagination<LedgerEntry>(cursor =>
 *     ledgerApi.listLedger({ cursor, page_size: 20 }).then(r => ({
 *       items: r.entries, has_more: r.has_more, next_cursor: r.next_cursor
 *     }))
 *   )
 *   await pager.refresh()
 *   // onReachBottom -> pager.loadMore()
 */
export interface PagedResult<T> {
  items: T[]
  has_more: boolean
  next_cursor: number | null
}

export type PageFetcher<T> = (cursor: number | null) => Promise<PagedResult<T>>

export function usePagination<T>(fetcher: PageFetcher<T>) {
  const items = ref<T[]>([]) as { value: T[] }
  const loading = ref(false)
  const loadingMore = ref(false)
  const hasMore = ref(true)
  const error = ref('')
  let nextCursor: number | null = null

  const loadSeq = useLoadSeq()

  const isEmpty = computed(() => !loading.value && items.value.length === 0)

  async function refresh(): Promise<void> {
    const seq = loadSeq.bump()
    loading.value = true
    loadingMore.value = false
    error.value = ''
    nextCursor = null
    hasMore.value = true
    try {
      const r = await fetcher(null)
      if (loadSeq.isStale(seq)) return
      items.value = r.items
      nextCursor = r.next_cursor
      hasMore.value = r.has_more
    } catch (err) {
      if (loadSeq.isStale(seq)) return
      error.value = errorMessage(err, '加载失败')
    } finally {
      if (!loadSeq.isStale(seq)) loading.value = false
    }
  }

  async function loadMore(): Promise<void> {
    if (loading.value || loadingMore.value || !hasMore.value) return
    const seq = loadSeq.current()
    loadingMore.value = true
    try {
      const r = await fetcher(nextCursor)
      if (loadSeq.isStale(seq)) return
      items.value = items.value.concat(r.items)
      nextCursor = r.next_cursor
      hasMore.value = r.has_more
    } catch (err) {
      if (loadSeq.isStale(seq)) return
      error.value = errorMessage(err, '加载失败')
    } finally {
      if (!loadSeq.isStale(seq)) loadingMore.value = false
    }
  }

  function reset(): void {
    loadSeq.bump()
    items.value = []
    loading.value = false
    loadingMore.value = false
    hasMore.value = true
    error.value = ''
    nextCursor = null
  }

  return { items, loading, loadingMore, hasMore, error, isEmpty, refresh, loadMore, reset }
}
