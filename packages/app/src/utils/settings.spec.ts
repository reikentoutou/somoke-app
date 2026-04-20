import { describe, expect, it } from 'vitest'
import type { ShiftConfigListItem, StoreMember, UserInfo } from '@somoke/shared'
import {
  avatarLetter,
  countBosses,
  currentStoreLine,
  formForNewShift,
  formFromShift,
  memberPermissions,
  nextSortOrder,
  roleLabel,
  roleText,
  timeToPickerValue,
  validateShiftForm
} from './settings'

const shift = (over: Partial<ShiftConfigListItem> = {}): ShiftConfigListItem => ({
  id: 1,
  name: '早班',
  start_time: '07:00:00',
  end_time: '13:00:00',
  icon: 'wb_sunny',
  sort_order: 2,
  ...over
})

const member = (over: Partial<StoreMember> = {}): StoreMember => ({
  user_id: 10,
  store_id: 1,
  nickname: 'A',
  avatar_url: '',
  role: 2,
  is_active: 1,
  ...over
})

describe('settings utils', () => {
  it('avatarLetter: 英文大写 / 中文原样 / 空 => ?', () => {
    expect(avatarLetter('alice')).toBe('A')
    expect(avatarLetter('张三')).toBe('张')
    expect(avatarLetter('')).toBe('?')
    expect(avatarLetter('   ')).toBe('?')
    expect(avatarLetter(null)).toBe('?')
  })

  it('roleText: 1→管理员 2→员工 其他→—', () => {
    expect(roleText(1)).toBe('管理员')
    expect(roleText(2)).toBe('员工')
    expect(roleText(null)).toBe('—')
  })

  it('currentStoreLine: 命中门店时带角色，否则回落到 #id 或 —', () => {
    const u: UserInfo = {
      id: 1,
      nickname: 'x',
      avatar_url: '',
      current_store_id: 11,
      store_id: 11,
      role: 1,
      stores: [
        { store_id: 11, name: '店A', role: 1 },
        { store_id: 22, name: '店B', role: 2 }
      ],
      store_count: 2
    }
    expect(currentStoreLine(u)).toBe('店A · 管理员')
    expect(currentStoreLine({ ...u, current_store_id: 33, store_id: 33 })).toBe('门店 #33')
    expect(currentStoreLine(null)).toBe('—')
  })

  it('timeToPickerValue: 归一到 HH:mm，异常 => 09:00', () => {
    expect(timeToPickerValue('07:00:00')).toBe('07:00')
    expect(timeToPickerValue('9:5')).toBe('09:05')
    expect(timeToPickerValue('')).toBe('09:00')
    expect(timeToPickerValue(null)).toBe('09:00')
    expect(timeToPickerValue('23:59')).toBe('23:59')
  })

  it('nextSortOrder: 最大值 + 1；空数组 => 1', () => {
    expect(nextSortOrder([])).toBe(1)
    expect(nextSortOrder([shift({ sort_order: 2 }), shift({ id: 2, sort_order: 5 })])).toBe(6)
  })

  it('formFromShift / formForNewShift', () => {
    expect(formFromShift(shift())).toEqual({
      id: 1,
      name: '早班',
      start: '07:00',
      end: '13:00',
      sort: '2',
      iconSnapshot: 'wb_sunny'
    })
    expect(formForNewShift([shift({ sort_order: 3 })])).toMatchObject({
      id: 0,
      name: '',
      start: '09:00',
      end: '18:00',
      sort: '4',
      iconSnapshot: ''
    })
  })

  it('validateShiftForm: name 必填；新增 icon=schedule；编辑沿用 snapshot', () => {
    const base = {
      id: 0,
      name: ' ',
      start: '07:00',
      end: '13:00',
      sort: '3',
      iconSnapshot: 'wb_sunny'
    }
    expect(validateShiftForm(base, true).ok).toBe(false)

    const addRes = validateShiftForm({ ...base, name: '早班' }, true)
    expect(addRes.ok).toBe(true)
    if (addRes.ok) {
      expect(addRes.payload).toEqual({
        name: '早班',
        start_time: '07:00',
        end_time: '13:00',
        sort_order: 3,
        icon: 'schedule'
      })
    }

    const editRes = validateShiftForm({ ...base, id: 9, name: '早班' }, false)
    expect(editRes.ok).toBe(true)
    if (editRes.ok) {
      expect(editRes.payload).toEqual({
        id: 9,
        name: '早班',
        start_time: '07:00',
        end_time: '13:00',
        sort_order: 3,
        icon: 'wb_sunny'
      })
    }

    const noIcon = validateShiftForm({ ...base, id: 9, name: '早班', iconSnapshot: '' }, false)
    expect(noIcon.ok).toBe(true)
    if (noIcon.ok) expect(noIcon.payload.icon).toBe('schedule')
  })

  it('countBosses / memberPermissions: 店长视角与员工视角分别正确', () => {
    const me = member({ user_id: 1, role: 1 })
    const boss2 = member({ user_id: 2, role: 1 })
    const staff3 = member({ user_id: 3, role: 2 })
    expect(countBosses([me, boss2, staff3])).toBe(2)

    // 店长视角
    const pBoss2 = memberPermissions(boss2, 1, true, 2)
    expect(pBoss2).toEqual({
      canRemove: true,
      canPromote: false,
      canDemote: true,
      canLeave: false
    })
    const pStaff3 = memberPermissions(staff3, 1, true, 2)
    expect(pStaff3).toEqual({
      canRemove: true,
      canPromote: true,
      canDemote: false,
      canLeave: false
    })
    // 店长自己：bossCount>1 可退出
    expect(memberPermissions(me, 1, true, 2).canLeave).toBe(true)
    // 店长自己：bossCount=1 不可退出
    expect(memberPermissions(me, 1, true, 1).canLeave).toBe(false)

    // 员工视角：只能看到自己那行的退出
    const pSelfStaff = memberPermissions(staff3, 3, false, 2)
    expect(pSelfStaff).toEqual({
      canRemove: false,
      canPromote: false,
      canDemote: false,
      canLeave: true
    })
    expect(memberPermissions(boss2, 3, false, 2).canLeave).toBe(false)
  })

  it('roleLabel', () => {
    expect(roleLabel(1)).toBe('管理员')
    expect(roleLabel(2)).toBe('员工')
  })
})
