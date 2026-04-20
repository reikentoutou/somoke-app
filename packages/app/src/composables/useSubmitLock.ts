import { ref } from 'vue'

/**
 * 提交锁：防止按钮连点 / 并发提交。替换散落的 `submitting` 布尔 + try/finally 样板。
 *
 * 用法：
 *   const { running, guard } = useSubmitLock()
 *   <wd-button :loading="running" @tap="guard(async () => { await api.save(...) })" />
 */
export function useSubmitLock() {
  const running = ref(false)

  async function guard<T>(task: () => Promise<T>): Promise<T | undefined> {
    if (running.value) return undefined
    running.value = true
    try {
      return await task()
    } finally {
      running.value = false
    }
  }

  return { running, guard }
}
