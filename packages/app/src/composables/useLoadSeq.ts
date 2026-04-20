/**
 * 并发保护：返回 { bump(), isStale(seq) }，替换 16 处手写的 `_loadSeq`。
 *
 * 用法：
 *   const { bump, isStale } = useLoadSeq()
 *   const seq = bump()
 *   const data = await fetchList()
 *   if (isStale(seq)) return   // 已有新请求覆盖，丢弃旧结果
 *   list.value = data
 */
export function useLoadSeq() {
  let seq = 0
  return {
    bump(): number {
      seq += 1
      return seq
    },
    isStale(mySeq: number): boolean {
      return mySeq !== seq
    },
    current(): number {
      return seq
    }
  }
}
