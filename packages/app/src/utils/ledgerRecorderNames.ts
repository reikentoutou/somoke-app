import type { StoreDetailRes, UserInfo } from '@somoke/shared'
import { getStoreIdFromUserInfo } from '@/stores/user'

/**
 * 记账员姓名工具：解析 store_detail 中的可选姓名、管理本地选中记忆、计算 picker 下标。
 * 所有函数都是纯函数，便于单测。本地存储操作在 composable 里做。
 */

/** 门店维度的 storage key，用于记忆"上次选的记账人"。 */
export function recorderStorageKey(userInfo: UserInfo | null | undefined): string {
  const sid = getStoreIdFromUserInfo(userInfo)
  return sid ? `ledger_recorder_${sid}` : 'ledger_recorder'
}

export function defaultNickname(userInfo: UserInfo | null | undefined): string {
  const nick = (userInfo?.nickname ?? '').toString().trim()
  return nick || '员工'
}

export function namesFromDetail(
  detail: Pick<StoreDetailRes, 'recorder_names'> | null | undefined
): string[] {
  const raw = detail?.recorder_names
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const one of raw) {
    if (one === null || one === undefined) continue
    const t = String(one).trim()
    if (t) out.push(t)
  }
  return out
}

export interface BuildRecorderListOptions {
  detail?: Pick<StoreDetailRes, 'recorder_names'> | null
  userInfo?: UserInfo | null
  /** 编辑态：必须保证当前记录上的 recorder_name 出现在列表里（置顶） */
  ensureName?: string | null
}

export interface BuiltRecorderList {
  list: string[]
  savedKey: string
}

export function buildRecorderNameList(opts: BuildRecorderListOptions = {}): BuiltRecorderList {
  const base = namesFromDetail(opts.detail)
  const ensureRaw = opts.ensureName == null ? '' : String(opts.ensureName).trim()
  let list = base.slice()
  if (ensureRaw && !list.includes(ensureRaw)) {
    list = [ensureRaw, ...list]
  }
  if (list.length === 0) {
    list = [defaultNickname(opts.userInfo)]
  }
  return { list, savedKey: recorderStorageKey(opts.userInfo) }
}

export interface PickedRecorder {
  index: number
  display: string
}

/**
 * 选中规则：preferredName（如记录上的记账人） > saved（本地记忆） > 首项。
 */
export function pickRecorderIndex(
  list: string[],
  saved: string | null | undefined,
  preferredName?: string | null
): PickedRecorder {
  let idx = 0
  const savedTrim = saved == null ? '' : String(saved).trim()
  if (savedTrim) {
    const hit = list.indexOf(savedTrim)
    if (hit >= 0) idx = hit
  }
  if (preferredName) {
    const pref = String(preferredName).trim()
    if (pref) {
      const hit = list.indexOf(pref)
      if (hit >= 0) idx = hit
    }
  }
  const display = list[idx] ?? list[0] ?? ''
  return { index: idx, display }
}
