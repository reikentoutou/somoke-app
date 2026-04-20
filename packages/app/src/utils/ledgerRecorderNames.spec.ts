import { describe, expect, it } from 'vitest'
import type { UserInfo } from '@somoke/shared'
import {
  buildRecorderNameList,
  defaultNickname,
  namesFromDetail,
  pickRecorderIndex,
  recorderStorageKey
} from './ledgerRecorderNames'

const user: UserInfo = {
  id: 1,
  nickname: '老王',
  avatar_url: '',
  current_store_id: 7,
  store_id: 7,
  role: 1,
  stores: [{ store_id: 7, name: '朝日店', role: 1 }],
  store_count: 1
}

describe('recorderStorageKey', () => {
  it('带当前 store_id 时拼接 sid', () => {
    expect(recorderStorageKey(user)).toBe('ledger_recorder_7')
  })
  it('无 store_id 时退回默认 key', () => {
    expect(recorderStorageKey(null)).toBe('ledger_recorder')
  })
})

describe('namesFromDetail', () => {
  it('空/非数组返回空数组', () => {
    expect(namesFromDetail(null)).toEqual([])
    expect(namesFromDetail({ recorder_names: null as unknown as string[] })).toEqual([])
  })
  it('过滤空白', () => {
    expect(namesFromDetail({ recorder_names: ['  A', '', '   ', 'B '] })).toEqual(['A', 'B'])
  })
})

describe('buildRecorderNameList', () => {
  it('空列表回退为用户昵称', () => {
    const { list } = buildRecorderNameList({ detail: { recorder_names: [] }, userInfo: user })
    expect(list).toEqual(['老王'])
  })
  it('ensureName 置顶且去重', () => {
    const { list } = buildRecorderNameList({
      detail: { recorder_names: ['A', 'B'] },
      userInfo: user,
      ensureName: 'B'
    })
    expect(list).toEqual(['A', 'B'])
  })
  it('ensureName 不在已有列表则置首位', () => {
    const { list } = buildRecorderNameList({
      detail: { recorder_names: ['A', 'B'] },
      userInfo: user,
      ensureName: 'C'
    })
    expect(list).toEqual(['C', 'A', 'B'])
  })
})

describe('pickRecorderIndex', () => {
  const list = ['张三', '李四', '王五']
  it('无 saved 和 preferred 时返回首项', () => {
    const r = pickRecorderIndex(list, '')
    expect(r.index).toBe(0)
    expect(r.display).toBe('张三')
  })
  it('preferredName 优先于 saved', () => {
    const r = pickRecorderIndex(list, '张三', '王五')
    expect(r.index).toBe(2)
    expect(r.display).toBe('王五')
  })
  it('preferred 不存在时回退到 saved', () => {
    const r = pickRecorderIndex(list, '李四', '不存在')
    expect(r.index).toBe(1)
  })
})

describe('defaultNickname', () => {
  it('无用户返回默认员工', () => {
    expect(defaultNickname(null)).toBe('员工')
  })
  it('去掉前后空白', () => {
    expect(defaultNickname({ ...user, nickname: '  Tom ' })).toBe('Tom')
  })
})
