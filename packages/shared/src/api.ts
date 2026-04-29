import type {
  LedgerEntry,
  Role,
  ShiftConfig,
  ShiftRecord,
  Store,
  StoreBrief,
  StoreMember,
  UserInfo
} from './domain'

/**
 * 云函数 api 的统一响应信封；所有 handler 返回 `{code, msg, data}`。
 * rpc() 成功返回 data，失败 reject 为 Error（见 packages/app/src/api/client.ts）。
 */
export interface CloudEnvelope<T> {
  code: number
  msg?: string
  data?: T
}

/* ----------------------- 公共请求附加字段 ----------------------- */
/** 所有业务 action 都需携带的会话字段，由 rpc 客户端自动注入 */
export interface SessionHeader {
  token?: string
  /** 明确业务 action；客户端在 rpc(action, payload) 中自动写入 */
  action?: string
}

/* ----------------------- 各 action 的 Req/Res ----------------------- */

/** login */
export interface LoginReq extends SessionHeader {
  nickname?: string
  avatar_url?: string
}
export interface LoginRes {
  token: string
  expire_at: string
  needs_onboarding: boolean
  needs_store_selection: boolean
  user_info: UserInfo
}

/** getStores */
export type GetStoresReq = SessionHeader
export interface GetStoresRes {
  stores: StoreBrief[]
  current_store_id: number
}

/** storeCreate */
export interface StoreCreateReq extends SessionHeader {
  name: string
  address?: string
  unit_price?: number
  currency?: string
}
export interface StoreCreateRes {
  store: Store
}

/** storeSwitch */
export interface StoreSwitchReq extends SessionHeader {
  store_id: number
}
export interface StoreSwitchRes {
  current_store_id: number
}

/** storeJoin */
export interface StoreJoinReq extends SessionHeader {
  code: string
}
export interface StoreJoinRes {
  store_id: number
  store_name: string
  role: Role
}

/** storeInviteCreate */
export interface StoreInviteCreateReq extends SessionHeader {
  store_id: number
  max_uses?: number
  expire_days?: number
}
export interface StoreInviteCreateRes {
  invite_id: number
  store_id: number
  /** 明码邀请码只在创建时返回一次 */
  code: string
  expires_at: string
  max_uses: number
  used_count: number
}

/** storeUpdate：仅门店管理员；修改 `stores.name` */
export interface StoreUpdateReq extends SessionHeader {
  store_id: number
  name: string
}
export interface StoreUpdateRes {
  store_id: number
  name: string
}

/** storeDelete：仅门店管理员；软删门店并失效全员 membership */
export interface StoreDeleteReq extends SessionHeader {
  store_id: number
}
export interface StoreDeleteRes {
  store_id: number
}

/** storeDetail
 *
 * 后端返回的是扁平结构（见 cloudfunctions/api/index.js `handleStoreDetail`），
 * 字段直接挂在 res 根上。历史曾用 `{ store, recorder_names }` 的嵌套结构，已对齐去除。
 */
export type StoreDetailReq = SessionHeader
export interface StoreDetailRes {
  id: number
  name: string
  unit_price: number
  current_stock: number
  current_cash: number
  currency: string
  address: string
  recorder_names: string[]
}

/**
 * getShifts wire 视图：云函数在 DB 层已按 is_active=1 过滤，响应里不带
 * 该字段（也不带 store_id / timestamps）。前端不应再按 is_active 二次过滤。
 * 写路径（shiftConfigSave 回传 / settings 页维护）继续用完整的 ShiftConfig。
 */
export type ShiftConfigListItem = Pick<
  ShiftConfig,
  'id' | 'name' | 'start_time' | 'end_time' | 'icon' | 'sort_order'
>

/** getShifts */
export type GetShiftsReq = SessionHeader
export type GetShiftsRes = ShiftConfigListItem[]

/** shiftConfigSave */
export interface ShiftConfigSaveReq extends SessionHeader {
  /** 缺省或 0 代表新增 */
  id?: number
  name: string
  start_time: string
  end_time: string
  icon?: string
  is_active?: 0 | 1
  sort_order?: number
}
export interface ShiftConfigSaveRes {
  shift: ShiftConfig
}

/** shiftConfigDelete */
export interface ShiftConfigDeleteReq extends SessionHeader {
  id: number
}
export interface ShiftConfigDeleteRes {
  id: number
}

/** getRecords */
export interface GetRecordsReq extends SessionHeader {
  /** YYYY-MM，缺省为当月 */
  month?: string
  /** 可选按日过滤 */
  date?: string
}

export interface RecordsSummary {
  total_revenue: number
  total_sold: number
  total_gift: number
  total_wechat_qty: number
  total_alipay_qty: number
  total_cash_qty: number
  total_wechat_amount: number
  total_alipay_amount: number
  total_cash_amount: number
  record_count: number
}

export interface GetRecordsRes {
  filter: { type: 'date' | 'month' | 'none'; value: string }
  summary: RecordsSummary
  records: ShiftRecord[]
}

/** getRecord */
export interface GetRecordReq extends SessionHeader {
  id: number
}
export interface GetRecordRes {
  record: ShiftRecord
}

/** addRecord */
export interface AddRecordReq extends SessionHeader {
  record_date: string
  shift_config_id: number
  recorder_name: string
  qty_opening: number
  qty_closing: number
  qty_gift?: number
  sold_wechat?: number
  sold_alipay?: number
  sold_cash?: number
  cash_opening: number
  cash_closing: number
  note?: string
}
export interface AddRecordRes {
  record: ShiftRecord
  current_stock: number
  current_cash: number
  /** 与 current_stock 对应：本次实际扣减的库存 */
  stock_deduct?: number
}

/** updateRecord */
/**
 * 修改记账。
 * 后端 `handleUpdateRecord` 对 record_date / shift_config_id / recorder_name
 * 以及 8 个数值字段都做硬校验——这里保持必填契约，缺一即 400。
 */
export interface UpdateRecordReq extends SessionHeader {
  id: number
  record_date: string
  shift_config_id: number
  recorder_name: string
  qty_opening: number
  qty_closing: number
  qty_gift: number
  sold_wechat: number
  sold_alipay: number
  sold_cash: number
  cash_opening: number
  cash_closing: number
  note?: string
}
export interface UpdateRecordRes {
  record: ShiftRecord
  current_stock: number
  current_cash: number
}

/** deleteRecord：仅管理员可删除；删除后会回滚库存/现金并记流水 */
export interface DeleteRecordReq extends SessionHeader {
  id: number
}
export interface DeleteRecordRes {
  id: number
  current_stock: number
  current_cash: number
}

/** recorderNameAdd */
export interface RecorderNameAddReq extends SessionHeader {
  name: string
}
export interface RecorderNameAddRes {
  recorder_names: string[]
}

/** recorderNameDelete */
export interface RecorderNameDeleteReq extends SessionHeader {
  name: string
}
export interface RecorderNameDeleteRes {
  recorder_names: string[]
}

/** getStoreMembers */
export type GetStoreMembersReq = SessionHeader
export interface GetStoreMembersRes {
  members: StoreMember[]
  my_role: Role
}

/** storeMemberRemove */
export interface StoreMemberRemoveReq extends SessionHeader {
  user_id: number
}
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type StoreMemberRemoveRes = Record<string, never>

/** storeMemberSetRole */
export interface StoreMemberSetRoleReq extends SessionHeader {
  user_id: number
  role: Role
}
export interface StoreMemberSetRoleRes {
  user_id: number
  role: Role
}

/** updateProfile */
export interface UpdateProfileReq extends SessionHeader {
  nickname?: string
  avatar_url?: string
}
/** 云函数可能只返回部分字段（如仅 nickname），前端须与本地会话合并 */
export interface UpdateProfileRes {
  user_info: Partial<UserInfo>
}

/** stockLedgerList */
export interface StockLedgerListReq extends SessionHeader {
  /** 首次传空；翻页时传上一页 next_cursor（按 id 降序游标） */
  cursor?: number | null
  /** 默认 50，最大 100 */
  limit?: number
}
export interface StockLedgerListRes {
  items: LedgerEntry[]
  has_more: boolean
  next_cursor: number | null
}

/** stockAdjust：仅校准库存（现金校准走 opsAction adjust_cash） */
export interface StockAdjustReq extends SessionHeader {
  /** 调整后的最终库存值（非差值） */
  target_stock: number
  note?: string
}
export interface StockAdjustRes {
  current_stock: number
  skipped?: boolean
}

/** opsAction：补货 / 取现 / 库存校准 / 现金校准 统一入口 */
export type OpsActionType = 'restock' | 'withdraw' | 'adjust_stock' | 'adjust_cash'

export interface OpsActionReq extends SessionHeader {
  action_type: OpsActionType
  /** restock: 新增件数；adjust_stock: 目标库存件数；其余忽略 */
  val_stock?: number | string
  /** withdraw: 取现金额；adjust_cash: 目标现金值；其余忽略 */
  val_cash?: number | string
  note?: string
}
export interface OpsActionRes {
  current_stock: number
  current_cash: number
  skipped?: boolean
}

/* ----------------------- Contract 映射 ----------------------- */

/**
 * 所有支持的 action 契约表。
 * rpc<K extends ActionName>(action: K, req: Contract[K]['req']): Promise<Contract[K]['res']>
 */
export interface Contract {
  login: { req: LoginReq; res: LoginRes }
  getStores: { req: GetStoresReq; res: GetStoresRes }
  storeCreate: { req: StoreCreateReq; res: StoreCreateRes }
  storeSwitch: { req: StoreSwitchReq; res: StoreSwitchRes }
  storeJoin: { req: StoreJoinReq; res: StoreJoinRes }
  storeInviteCreate: { req: StoreInviteCreateReq; res: StoreInviteCreateRes }
  storeUpdate: { req: StoreUpdateReq; res: StoreUpdateRes }
  storeDelete: { req: StoreDeleteReq; res: StoreDeleteRes }
  storeDetail: { req: StoreDetailReq; res: StoreDetailRes }
  getShifts: { req: GetShiftsReq; res: GetShiftsRes }
  shiftConfigSave: { req: ShiftConfigSaveReq; res: ShiftConfigSaveRes }
  shiftConfigDelete: { req: ShiftConfigDeleteReq; res: ShiftConfigDeleteRes }
  getRecords: { req: GetRecordsReq; res: GetRecordsRes }
  getRecord: { req: GetRecordReq; res: GetRecordRes }
  addRecord: { req: AddRecordReq; res: AddRecordRes }
  updateRecord: { req: UpdateRecordReq; res: UpdateRecordRes }
  deleteRecord: { req: DeleteRecordReq; res: DeleteRecordRes }
  recorderNameAdd: { req: RecorderNameAddReq; res: RecorderNameAddRes }
  recorderNameDelete: { req: RecorderNameDeleteReq; res: RecorderNameDeleteRes }
  getStoreMembers: { req: GetStoreMembersReq; res: GetStoreMembersRes }
  storeMemberRemove: { req: StoreMemberRemoveReq; res: StoreMemberRemoveRes }
  storeMemberSetRole: { req: StoreMemberSetRoleReq; res: StoreMemberSetRoleRes }
  updateProfile: { req: UpdateProfileReq; res: UpdateProfileRes }
  stockLedgerList: { req: StockLedgerListReq; res: StockLedgerListRes }
  stockAdjust: { req: StockAdjustReq; res: StockAdjustRes }
  opsAction: { req: OpsActionReq; res: OpsActionRes }
}

export type ActionName = keyof Contract
export type ReqOf<K extends ActionName> = Contract[K]['req']
export type ResOf<K extends ActionName> = Contract[K]['res']
