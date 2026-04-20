import { describe, expect, it } from 'vitest'
import type { LoginRes, UserInfo } from '@somoke/shared'
import {
  getRoleInCurrentStore,
  getStoreIdFromUserInfo,
  loginPayloadNeedsOnboarding,
  loginPayloadNeedsStoreSelection,
  normalizeStores
} from './user'

const baseUser = (over: Partial<UserInfo> = {}): UserInfo => ({
  id: 1,
  nickname: '',
  avatar_url: '',
  current_store_id: null,
  store_id: null,
  role: 2,
  stores: [],
  store_count: 0,
  ...over
})

describe('normalizeStores', () => {
  it('过滤无效 store_id，角色收敛为 1/2', () => {
    const u = baseUser({
      stores: [
        { store_id: 3, name: 'A', role: 1 },
        { store_id: 0, name: 'bad', role: 1 },
        // @ts-expect-error 模拟后端异常字段
        { store_id: '5', name: 'B', role: '3' }
      ]
    })
    const out = normalizeStores(u)
    expect(out).toEqual([
      { store_id: 3, name: 'A', role: 1 },
      { store_id: 5, name: 'B', role: 2 }
    ])
  })
})

describe('getStoreIdFromUserInfo', () => {
  it('优先返回有效的 current_store_id', () => {
    expect(
      getStoreIdFromUserInfo(
        baseUser({
          current_store_id: 3,
          stores: [
            { store_id: 3, name: 'A', role: 1 },
            { store_id: 5, name: 'B', role: 2 }
          ],
          store_count: 2
        })
      )
    ).toBe(3)
  })

  it('仅单店时直接落到该店', () => {
    expect(
      getStoreIdFromUserInfo(
        baseUser({
          stores: [{ store_id: 7, name: 'C', role: 2 }],
          store_count: 1
        })
      )
    ).toBe(7)
  })

  it('多店但未选中时返回 0', () => {
    expect(
      getStoreIdFromUserInfo(
        baseUser({
          stores: [
            { store_id: 3, name: 'A', role: 1 },
            { store_id: 5, name: 'B', role: 2 }
          ],
          store_count: 2
        })
      )
    ).toBe(0)
  })
})

describe('getRoleInCurrentStore', () => {
  it('使用 stores 表中的角色，而非兼容字段 role', () => {
    const u = baseUser({
      role: 1,
      current_store_id: 3,
      stores: [{ store_id: 3, name: 'A', role: 2 }],
      store_count: 1
    })
    expect(getRoleInCurrentStore(u)).toBe(2)
  })
})

describe('login 引导判定', () => {
  const mkRes = (u: Partial<UserInfo>): LoginRes => ({
    token: 't',
    expire_at: '',
    needs_onboarding: false,
    needs_store_selection: false,
    user_info: baseUser(u)
  })

  it('无任何门店时需 onboarding', () => {
    expect(loginPayloadNeedsOnboarding(mkRes({ stores: [] }))).toBe(true)
  })

  it('多门店且未选中时需 store-select', () => {
    expect(
      loginPayloadNeedsStoreSelection(
        mkRes({
          stores: [
            { store_id: 3, name: 'A', role: 1 },
            { store_id: 5, name: 'B', role: 2 }
          ],
          store_count: 2
        })
      )
    ).toBe(true)
  })
})
