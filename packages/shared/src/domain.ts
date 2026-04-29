import type { Role } from './constants'
export type { Role }

/**
 * 领域模型：与数据库集合字段 1:1 对齐，云端 ok(data, ...) 的 data 字段也以此为基础。
 */

export interface Store {
  store_id: number
  name: string
  address: string
  unit_price: number
  currency: string
  current_stock: number
  current_cash: number
  role?: Role
  created_at?: string
  updated_at?: string
}

export interface StoreBrief {
  store_id: number
  name: string
  role: Role
}

export interface UserInfo {
  id: number
  nickname: string
  avatar_url: string
  /** 多店时可能为 null，表示尚未选定当前门店 */
  current_store_id: number | null
  /** 旧版兼容字段：单店时等于 current_store_id */
  store_id: number | null
  role: Role
  stores: StoreBrief[]
  store_count: number
}

export interface ShiftConfig {
  id: number
  store_id: number
  name: string
  start_time: string
  end_time: string
  icon?: string
  is_active: 0 | 1
  sort_order: number
  created_at?: string
  updated_at?: string
}

export interface ShiftRecord {
  id: number
  store_id: number
  shift_config_id: number
  shift_name: string
  shift_start?: string
  shift_end?: string
  shift_icon?: string
  record_date: string
  recorder_id?: number
  recorder_name: string
  qty_opening: number
  qty_closing: number
  qty_gift: number
  qty_sold: number
  sold_wechat: number
  sold_alipay: number
  sold_cash: number
  cash_opening: number
  cash_closing: number
  unit_price: number
  total_revenue: number
  note?: string
  created_at?: string
  updated_at?: string
}

/** 运营流水事件类型（与云函数 store_stock_ledger.event_type 对齐） */
export type LedgerEventType =
  | 'record_add'
  | 'record_update'
  | 'record_delete'
  | 'restock'
  | 'withdraw'
  | 'adjust_stock'
  | 'adjust_cash'

/**
 * 流水条目：服务端 handleStockLedgerList 已 JOIN 了 shift_records / shift_configs / users，
 * 前端直接消费，不再做二次 RPC。
 */
export interface LedgerEntry {
  id: number
  event_type: LedgerEventType
  delta: number
  balance_after: number
  cash_delta: number
  cash_balance_after: number
  ref_record_id?: number | null
  note?: string
  time_display?: string
  shift_date?: string
  shift_name?: string
  recorder_name?: string
  operator_name?: string
}

export interface StoreMember {
  user_id: number
  store_id: number
  nickname: string
  avatar_url: string
  role: Role
  is_active: 0 | 1
  joined_at?: string
}

export interface Invite {
  code: string
  store_id: number
  expire_at: string
  max_uses: number
  used_count: number
}
