/**
 * 把 `unknown` 异常归一化成可展示给用户的文案。
 *
 * 为什么需要：
 * RPC 失败、业务 api 抛异常、uni.* API 抛异常三种来源都是 `unknown`，
 * 调用侧普遍重复 `err instanceof Error && err.message ? err.message : '操作失败'`
 * 这个表达式（全仓 24 处）。收敛到一个函数后，多语言 / 埋点 / 统一降级文案
 * 都能在这里一处改完。
 */
export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback
}
