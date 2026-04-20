import type { Role, ShiftConfigListItem, StoreMember, UserInfo } from '@somoke/shared'
import { normalizeStores } from '@/stores/user'

/**
 * settings 相关的纯函数域：
 * - 头像首字母 / 显示名称等展示衍生；
 * - 班次表单初始化 / 校验；
 * - 成员角色标签 / 可用操作推导。
 *
 * 这些逻辑来自旧 miniprogram/pages/settings*，在此收敛一次，页面/组件只做 render。
 */

/** 昵称首字母：英文 → 大写；中文 / 其他 → 原样；空串 → `?`。 */
export function avatarLetter(name: string | null | undefined): string {
  const s = (name ?? '').trim()
  if (!s) return '?'
  const ch = s.charAt(0)
  return /[a-z]/i.test(ch) ? ch.toUpperCase() : ch
}

/** 角色中文标签，非法值返回 `—`。 */
export function roleText(role: Role | null | undefined): string {
  if (role === 1) return '管理员'
  if (role === 2) return '员工'
  return '—'
}

/**
 * 设置首页「当前门店」行的展示：`门店名 · 角色` 或 `门店 #id`。
 * 若 userInfo 中没有任何门店，返回 `—`。
 */
export function currentStoreLine(user: UserInfo | null): string {
  if (!user) return '—'
  const sid = user.current_store_id || user.store_id || 0
  if (!sid) return '—'
  const hit = normalizeStores(user).find(s => s.store_id === sid)
  if (hit) {
    const r = roleText(hit.role)
    return r === '—' ? hit.name : `${hit.name} · ${r}`
  }
  return `门店 #${sid}`
}

/* ------------------------- Shift editor form ------------------------- */

export interface ShiftFormValues {
  id: number
  name: string
  start: string
  end: string
  sort: string
  iconSnapshot: string
}

export const DEFAULT_SHIFT_FORM: Readonly<ShiftFormValues> = Object.freeze({
  id: 0,
  name: '',
  start: '09:00',
  end: '18:00',
  sort: '1',
  iconSnapshot: ''
})

/**
 * 把后端 `HH:mm:ss` 或 `HH:mm` 规整成 picker 所需的 `HH:mm`。
 * 缺失或非法 → 默认 `09:00`，确保 picker 始终有有效值。
 */
export function timeToPickerValue(t: string | null | undefined): string {
  if (!t) return '09:00'
  const parts = String(t).split(':')
  let h = (parts[0] ?? '9').trim()
  let m = (parts[1] ?? '00').trim().replace(/\D/g, '').slice(0, 2) || '00'
  if (h.length === 1) h = `0${h}`
  if (h.length > 2) h = h.slice(-2)
  if (m.length === 1) m = `0${m}`
  return `${h}:${m}`
}

/** 新增班次时的默认 sort_order：取现有最大值 + 1，空列表为 1。 */
export function nextSortOrder(shifts: readonly ShiftConfigListItem[]): number {
  if (!shifts.length) return 1
  let max = 0
  for (const s of shifts) {
    const n = Number(s.sort_order) || 0
    if (n > max) max = n
  }
  return max + 1
}

export function formFromShift(shift: ShiftConfigListItem): ShiftFormValues {
  return {
    id: Number(shift.id) || 0,
    name: shift.name || '',
    start: timeToPickerValue(shift.start_time),
    end: timeToPickerValue(shift.end_time),
    sort: String(shift.sort_order ?? 1),
    iconSnapshot: shift.icon || 'schedule'
  }
}

export function formForNewShift(shifts: readonly ShiftConfigListItem[]): ShiftFormValues {
  return {
    ...DEFAULT_SHIFT_FORM,
    sort: String(nextSortOrder(shifts))
  }
}

export interface ShiftSavePayload {
  id?: number
  name: string
  start_time: string
  end_time: string
  sort_order: number
  icon: string
}

/**
 * 表单校验 + 转 payload：
 * - name 必填（trim 后非空）；
 * - sort_order 允许 0，非法默认为 0；
 * - icon：新增默认 `schedule`，编辑沿用快照（也回退到 `schedule`）。
 */
export function validateShiftForm(
  form: ShiftFormValues,
  isAdd: boolean
): { ok: true; payload: ShiftSavePayload } | { ok: false; message: string } {
  const name = form.name.trim()
  if (!name) return { ok: false, message: '请填写班次名称' }
  const sort = Number.parseInt(form.sort, 10)
  const payload: ShiftSavePayload = {
    name,
    start_time: form.start || '09:00',
    end_time: form.end || '18:00',
    sort_order: Number.isFinite(sort) && sort >= 0 ? sort : 0,
    icon: isAdd ? 'schedule' : form.iconSnapshot.trim() || 'schedule'
  }
  if (!isAdd && form.id > 0) payload.id = form.id
  return { ok: true, payload }
}

/* ------------------------- Team members ------------------------- */

export function countBosses(members: readonly StoreMember[]): number {
  let c = 0
  for (const m of members) if (m.role === 1) c += 1
  return c
}

export interface MemberPermissions {
  canRemove: boolean
  canPromote: boolean
  canDemote: boolean
  canLeave: boolean
}

/**
 * 根据当前用户（myUserId/isBoss）与成员行，推导这一行可以展示的操作按钮。
 * - 店长：可以移除其他人；可以把员工 → 店长；多个店长时可以把别的店长 → 员工；
 *        多个店长时自己也可以退出；
 * - 员工：只能在自己身上看到「退出门店」。
 */
export function memberPermissions(
  member: StoreMember,
  myUserId: number,
  isBoss: boolean,
  bossCount: number
): MemberPermissions {
  const isSelf = member.user_id === myUserId
  if (isBoss) {
    const demote = !isSelf && member.role === 1 && bossCount > 1
    const promote = member.role === 2
    return {
      canRemove: !isSelf,
      canPromote: promote,
      canDemote: demote,
      canLeave: isSelf && bossCount > 1
    }
  }
  return {
    canRemove: false,
    canPromote: false,
    canDemote: false,
    canLeave: isSelf && member.role === 2
  }
}

export function roleLabel(role: Role): string {
  return role === 1 ? '管理员' : '员工'
}
