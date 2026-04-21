import type { ActionName, CloudEnvelope, ReqOf, ResOf } from '@somoke/shared'
import { dedupe, getCached, invalidatePrefix, setCached } from './cache'

/**
 * 类型化 RPC 客户端：统一走微信云函数 `api`。
 * - 401 自动清会话 + reLaunch 登录页
 * - 超时重试 1 次
 * - 写操作成功后按 action → 前缀失效缓存
 */

const CLOUD_FUNCTION_NAME = 'api'

const TOKEN_KEY = 'token'
const USER_INFO_KEY = 'userInfo'
const CURRENT_STORE_KEY = 'currentStoreId'

const REQUEST_TIMEOUT_MS = 15_000

/** 写操作成功后要失效的前缀（迁自 miniprogram/utils/request.js 的 CACHE_INVALIDATE_BY_ACTION） */
const INVALIDATE_ON_SUCCESS: Partial<Record<ActionName, readonly string[]>> = {
  shiftConfigSave: ['shifts:'],
  shiftConfigDelete: ['shifts:'],
  recorderNameAdd: ['storeDetail:'],
  recorderNameDelete: ['storeDetail:'],
  storeSwitch: ['shifts:', 'storeDetail:'],
  storeCreate: ['shifts:', 'storeDetail:'],
  storeUpdate: ['storeDetail:'],
  storeDelete: ['shifts:', 'storeDetail:'],
  storeJoin: ['shifts:', 'storeDetail:'],
  addRecord: ['storeDetail:'],
  updateRecord: ['storeDetail:'],
  stockAdjust: ['storeDetail:'],
  opsAction: ['storeDetail:']
}

let reloggingInFlight = false

function readToken(): string {
  // 未登录时 getStorageSync 返回 ''，不抛；无需再套 try/catch。
  return (uni.getStorageSync(TOKEN_KEY) as string | undefined) ?? ''
}

function clearSessionLocal(): void {
  uni.removeStorageSync(TOKEN_KEY)
  uni.removeStorageSync(USER_INFO_KEY)
  uni.removeStorageSync(CURRENT_STORE_KEY)
}

function redirectToLogin(): void {
  if (reloggingInFlight) return
  reloggingInFlight = true
  uni.reLaunch({
    url: '/pages/login/index',
    complete: () => {
      reloggingInFlight = false
    }
  })
}

function isTimeoutError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const msg = String(
    (err as { errMsg?: string; message?: string }).errMsg ?? (err as Error).message ?? ''
  )
  return msg.includes('timeout') || msg.includes('Timed out')
}

interface WxCloudLike {
  callFunction(opts: {
    name: string
    data: Record<string, unknown>
    timeout?: number
  }): Promise<{ result: CloudEnvelope<unknown> }>
}

function getCloud(): WxCloudLike {
  const w = typeof wx !== 'undefined' ? (wx as unknown as { cloud?: WxCloudLike }) : undefined
  if (!w?.cloud) {
    throw new Error('wx.cloud 未初始化')
  }
  return w.cloud
}

async function callCloudOnce<K extends ActionName>(
  action: K,
  payload: ReqOf<K>
): Promise<ResOf<K>> {
  const token = readToken()
  const data: Record<string, unknown> = {
    ...(payload as Record<string, unknown>),
    action,
    token
  }

  const cloud = getCloud()
  let envelope: CloudEnvelope<unknown>
  try {
    const res = await cloud.callFunction({
      name: CLOUD_FUNCTION_NAME,
      data,
      timeout: REQUEST_TIMEOUT_MS
    })
    envelope = res.result
  } catch (err) {
    if (isTimeoutError(err)) throw new Error('请求超时，请稍后重试')
    throw new Error('网络异常，请稍后重试')
  }

  if (!envelope || typeof envelope !== 'object') {
    throw new Error('服务响应异常，请稍后重试')
  }
  if (envelope.code === 200) {
    return (envelope.data ?? {}) as ResOf<K>
  }
  if (envelope.code === 401) {
    clearSessionLocal()
    redirectToLogin()
    throw new Error(envelope.msg || '登录已过期，请重新登录')
  }
  throw new Error(envelope.msg || '请求失败')
}

/**
 * 调用云函数 action。失败抛 Error（含用户可读文案）。
 * 写操作成功后自动按前缀失效缓存。
 */
export async function rpc<K extends ActionName>(action: K, payload: ReqOf<K>): Promise<ResOf<K>> {
  let res: ResOf<K>
  try {
    res = await callCloudOnce(action, payload)
  } catch (err) {
    if (err instanceof Error && err.message.includes('请求超时')) {
      res = await callCloudOnce(action, payload)
    } else {
      throw err
    }
  }
  const prefixes = INVALIDATE_ON_SUCCESS[action]
  if (prefixes) {
    for (const p of prefixes) invalidatePrefix(p)
  }
  return res
}

/**
 * 可缓存的读取（仅对读取语义安全的 action 使用）。
 * key 约定：`${prefix}:${hash(payload)}`。
 */
export async function rpcCached<K extends ActionName>(
  action: K,
  payload: ReqOf<K>,
  opts: { key: string; ttlMs: number }
): Promise<ResOf<K>> {
  const hit = getCached<ResOf<K>>(opts.key)
  if (hit !== undefined) return hit
  return dedupe(opts.key, async () => {
    const res = await rpc(action, payload)
    setCached(opts.key, res, opts.ttlMs)
    return res
  })
}
