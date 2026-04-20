# 云函数 `api` 接口约定

小程序通过 `wx.cloud.callFunction({ name: 'api', data: { action, ... } })` 调用。  
[`packages/app/src/api/client.ts`](../packages/app/src/api/client.ts) 与各 `endpoints/*.ts` 将业务方法映射为 `action`（旧版 PHP 路径兼容表见下「兼容路径」列）。

## 统一响应

```json
{ "code": 200, "msg": "...", "data": {} }
```

`code !== 200` 为错误；`401` 时小程序会清会话并跳转登录页。

## action 一览

| action               | 兼容路径（`request.get/post`）    | 说明                                                                                                                           |
| -------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `login`              | POST `/login.php`                 | 可选 `nickname`、`avatar_url`；身份以云函数 `OPENID` 为准                                                                      |
| `updateProfile`      | POST `/profile_update.php`        | `nickname` 必填，≤64 字；返回 `data.user_info` 供本地合并                                                                      |
| `getStores`          | GET `/get_stores.php`             | `data.stores`、`current_store_id`                                                                                              |
| `storeCreate`        | POST `/store_create.php`          | `name` 必填；`address`、`unit_price`、`currency` 可选                                                                          |
| `storeSwitch`        | POST `/store_switch.php`          | `store_id`                                                                                                                     |
| `storeJoin`          | POST `/store_join.php`            | `code` 邀请码                                                                                                                  |
| `storeInviteCreate`  | POST `/store_invite_create.php`   | `store_id`；可选 `max_uses`、`expire_days`                                                                                     |
| `getShifts`          | GET `/get_shifts.php`             | 当前门店 **启用** 班次列表（`is_active: 1`）                                                                                   |
| `shiftConfigSave`    | POST `/shift_config_save.php`     | 仅管理员；见下文「班次配置」                                                                                                   |
| `shiftConfigDelete`  | POST `/shift_config_delete.php`   | 仅管理员；`id` 班次数字 id，软删                                                                                               |
| `getRecords`         | GET `/get_records.php`            | `date`（YYYY-MM-DD）或 `month`（YYYY-MM）；含汇总与列表                                                                        |
| `getRecord`          | GET `/get_record.php`             | `id` 记录数字 id；`data.record` 单条详情                                                                                       |
| `addRecord`          | POST `/add_record.php`            | 字段与旧版一致；**营业额** = 固定单价 ×（`sold_wechat`+`sold_alipay`+`sold_cash`）；扣库存规则见云函数                         |
| `updateRecord`       | POST `/update_record.php`         | `id` 必填，其余与新增类似；仅管理员或原记录人可改；会按扣减差额调整 `current_stock`                                            |
| `storeDetail`        | GET `/store_detail.php`           | `name`、`unit_price`、`current_stock`、`currency`、`recorder_names` 等                                                         |
| `recorderNameAdd`    | POST `/recorder_name_add.php`     | 仅管理员；`name`                                                                                                               |
| `recorderNameDelete` | POST `/recorder_name_delete.php`  | 仅管理员；`name`                                                                                                               |
| `getStoreMembers`    | GET `/store_members.php`          | `data.members`：`user_id`、`nickname`、`role`、`role_name`                                                                     |
| `storeMemberRemove`  | POST `/store_member_remove.php`   | `user_id`；员工可退自己，管理员可移他人                                                                                        |
| `storeMemberSetRole` | POST `/store_member_set_role.php` | 仅管理员；`user_id`、`role`（1 管理员 2 员工）                                                                                 |
| `storeRestock`       | POST `/store_restock.php`         | `qty` 正整数；仅管理员；返回 `current_stock`                                                                                   |
| `withdrawList`       | GET `/withdraw_list.php`          | 门店成员可读；见下「`withdrawList` 返回（P2）」                                                                                |
| `withdrawAdd`        | POST `/withdraw_add.php`          | 仅管理员；`amount_jpy`、`record_date`（YYYY-MM-DD）                                                                            |
| `stockLedgerList`    | GET `/stock_ledger_list.php`      | 当前门店成员可读；可选 `limit`（默认 50，最大 100）；`data.items` 为流水数组                                                   |
| `stockAdjust`        | POST `/stock_adjust.php`          | 仅管理员；`target_stock`（实盘总件数，0～10000000）；可选 `note`（≤200 字）；写入 `store_stock_ledger`（`event_type: adjust`） |

### `withdrawList` 返回（P2）

除 `records`（最多 100 条，含 `id`、`record_date`、`amount_jpy`）与 `total_jpy`（当前门店已拉取条目的円合计，最多 200 条参与汇总）外，还提供与「最近一条班次记账」对账用的字段：

| 字段                            | 说明                                                                                                                                                |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `latest_shift_record_id`        | 最近一条 `shift_records` 的数字 id；无记录时为 `null`                                                                                               |
| `latest_shift_record_date`      | 该条 `record_date`（YYYY-MM-DD）                                                                                                                    |
| `latest_cash_closing`           | 该条登记的下班现金（数字或 `null`）                                                                                                                 |
| `anchor_time_display`           | 对账时间锚点展示串：由该条 `updated_at` / `created_at` 格式化，或回退为日期                                                                         |
| `withdraw_sum_after_anchor_jpy` | 无班次锚点时为 `null`；否则为「取现事件时间」**严格晚于**锚点的取现金额合计（円）。取现事件时间优先 `created_at`，否则为该条 `record_date` 当日中午 |
| `reconcile_hint`                | 面向用户的对账说明文案（中文）                                                                                                                      |

### 班次配置（`shiftConfigSave` / `shiftConfigDelete`）

**`shiftConfigSave`**（仅管理员）

- **入参**：`name`（必填，≤32）；`start_time`、`end_time`（必填，支持 `HH:mm` 或 `HH:mm:ss`，服务端规范为带秒）；`id`（可选，属于当前门店则更新，否则新增）；`sort_order`（可选）；`icon`（可选，默认 `schedule`，≤32）。
- **返回**：`data` 为 `{ id, name, start_time, end_time, icon, sort_order }`；启用班次上限见云函数（如 30 条则 `400`）。
- **说明**：新增 `is_active: 1`；更新不自动改 `is_active`。

**`shiftConfigDelete`**（仅管理员）

- **入参**：`id`（班次数字 id）。
- **返回**：`data` 为 `{ id }`；`is_active` 置 `0`；已停用或不存在则 `404`。

### 记账与库存（概念）

- **单价**：云函数内与日营业额计算一致（当前常量 **3000 円/件**），与 `stores.unit_price` 展示字段可并存。
- **新增**：`addRecord` 写入 `shift_records` 并按规则减少 `stores.current_stock`（不低于 0）。
- **修改**：`updateRecord` 用旧记录与新表单重算扣减，差额写回 `current_stock`。
- **流水**：自本功能起，`record_add`、`record_update`、`restock`、`adjust` 会在 `store_stock_ledger` 记一条；历史数据无回溯流水。

实现位置：`cloudfunctions/api/index.js`。
