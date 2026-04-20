/**
 * 前后端共享的业务常量
 * 变更需同时检查云函数 cloudfunctions/api/index.js 内的同名常量。
 */

/** 单次录入件数上限（与云函数 MAX_QTY 保持一致） */
export const MAX_QTY = 1_000_000

/** 单次录入金额上限（与云函数 MAX_CASH 保持一致） */
export const MAX_CASH = 1_000_000_000

/** 登录态过期时间（秒） */
export const TOKEN_EXPIRE_SECONDS = 7 * 24 * 60 * 60

/** 列表默认分页大小 */
export const DEFAULT_PAGE_SIZE = 20

/** 班次启用上限 */
export const MAX_ACTIVE_SHIFTS = 30

/** 门店角色：1=管理员 / 2=普通成员 */
export const ROLE_BOSS = 1 as const
export const ROLE_MEMBER = 2 as const

export type Role = typeof ROLE_BOSS | typeof ROLE_MEMBER
