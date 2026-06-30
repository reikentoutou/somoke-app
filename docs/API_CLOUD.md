# 云函数 `api` 接口约定

小程序通过 `wx.cloud.callFunction({ name: 'api', data: { action, ... } })` 调用。  
[`packages/app/src/api/client.ts`](../packages/app/src/api/client.ts) 与各 `endpoints/*.ts` 将业务方法映射为 `action`（旧版 PHP 路径兼容表见下「兼容路径」列）。

## 统一响应

```json
{ "code": 200, "msg": "...", "data": {} }
```

`code !== 200` 为错误；`401` 时小程序会清会话并跳转登录页。

## action 一览

| action                   | 兼容路径（`request.get/post`）    | 说明                                                                                                                       |
| ------------------------ | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `login`                  | POST `/login.php`                 | 可选 `nickname`、`avatar_url`；身份以云函数 `OPENID` 为准                                                                  |
| `updateProfile`          | POST `/profile_update.php`        | `nickname` 必填，≤64 字；返回 `data.user_info` 供本地合并                                                                  |
| `getStores`              | GET `/get_stores.php`             | `data.stores`、`current_store_id`                                                                                          |
| `storeCreate`            | POST `/store_create.php`          | `name` 必填；`address`、`unit_price`、`currency` 可选                                                                      |
| `storeSwitch`            | POST `/store_switch.php`          | `store_id`                                                                                                                 |
| `storeJoin`              | POST `/store_join.php`            | `code` 邀请码                                                                                                              |
| `storeInviteCreate`      | POST `/store_invite_create.php`   | `store_id`；可选 `max_uses`、`expire_days`                                                                                 |
| `storeUpdate`            | —                                 | 仅管理员；`store_id`、`name`（≤64）；更新门店名称                                                                          |
| `storeDelete`            | —                                 | 仅管理员；`store_id`；软删门店（`stores.is_active=0`）并失效该店全员 `store_members`，用户 `current_store_id` 由服务端校正 |
| `getShifts`              | GET `/get_shifts.php`             | 当前门店 **启用** 班次列表（`is_active: 1`）                                                                               |
| `shiftConfigSave`        | POST `/shift_config_save.php`     | 仅管理员；见下文「班次配置」                                                                                               |
| `shiftConfigDelete`      | POST `/shift_config_delete.php`   | 仅管理员；`id` 班次数字 id，软删                                                                                           |
| `productCatalogList`     | —                                 | 当前门店商品分类与商品列表；若门店无商品，会懒创建「默认分类 / 默认商品」                                                  |
| `productCategorySave`    | —                                 | 仅管理员；新增/编辑商品分类                                                                                                |
| `productCategoryDisable` | —                                 | 仅管理员；停用分类，并停用分类下商品                                                                                       |
| `productCategoryDelete`  | —                                 | 仅管理员；分类下存在非零库存商品则 `400`；库存清零后未引用硬删，已被历史引用软删，不调整库存                               |
| `productSave`            | —                                 | 仅管理员；新增/编辑商品与价格；库存通过 `stockAdjust` / `opsAction` 维护                                                   |
| `productDisable`         | —                                 | 仅管理员；停用商品，新记账不可再选，历史保留                                                                               |
| `productDelete`          | —                                 | 仅管理员；商品非零库存则 `400`；库存清零后未引用硬删，已被历史引用软删，不调整库存                                         |
| `getRecords`             | GET `/get_records.php`            | `date`（YYYY-MM-DD）或 `month`（YYYY-MM）；含汇总与列表                                                                    |
| `getRecord`              | GET `/get_record.php`             | `id` 记录数字 id；`data.record` 单条详情                                                                                   |
| `addRecord`              | POST `/add_record.php`            | 支持 `items[]` 商品行；营业额按商品价格快照汇总；任一商品库存不足则 `400`，不写记录、不扣库存                              |
| `updateRecord`           | POST `/update_record.php`         | `id` 必填；同商品保留原记录商品/分类/价格快照，新商品用当前目录；额外扣减超过当前库存则 `400`，原记录不变                  |
| `storeDetail`            | GET `/store_detail.php`           | `name`、`unit_price`、`current_stock`、`currency`、`recorder_names` 等                                                     |
| `recorderNameAdd`        | POST `/recorder_name_add.php`     | 仅管理员；`name`                                                                                                           |
| `recorderNameDelete`     | POST `/recorder_name_delete.php`  | 仅管理员；`name`                                                                                                           |
| `getStoreMembers`        | GET `/store_members.php`          | `data.members`：`user_id`、`nickname`、`role`、`role_name`                                                                 |
| `storeMemberRemove`      | POST `/store_member_remove.php`   | `user_id`；员工可退自己，管理员可移他人                                                                                    |
| `storeMemberSetRole`     | POST `/store_member_set_role.php` | 仅管理员；`user_id`、`role`（1 管理员 2 员工）                                                                             |
| `storeRestock`           | POST `/store_restock.php`         | `qty` 正整数；仅管理员；返回 `current_stock`                                                                               |
| `withdrawList`           | GET `/withdraw_list.php`          | 门店成员可读；见下「`withdrawList` 返回（P2）」                                                                            |
| `withdrawAdd`            | POST `/withdraw_add.php`          | 仅管理员；`amount_jpy`、`record_date`（YYYY-MM-DD）                                                                        |
| `stockLedgerList`        | GET `/stock_ledger_list.php`      | 当前门店成员可读；可选 `limit`（默认 50，最大 100）；`data.items` 为流水数组                                               |
| `stockAdjust`            | POST `/stock_adjust.php`          | 仅管理员；`product_id`、`target_stock`（该商品实盘件数，0～10000000）；可选 `note`（≤200 字）；写入商品库存流水            |

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

### 商品目录与记账库存（概念）

- **商品结构**：每店 `product_categories` → `products`；商品含 `unit_price` 与 `current_stock`。
- **默认商品**：首次读取商品目录时，若当前门店还没有商品，云函数会用 `stores.unit_price`（为空则 3000）和 `stores.current_stock` 懒创建「默认分类 / 默认商品」。
- **班次记录**：新记录写 `shift_records.items[]`，每行保存商品/分类名称快照、单价快照、上下班数量、赠送、支付渠道件数、收入与库存扣减。编辑历史记录时，已有商品行继续保留原快照；只允许更新数量/现金等数值字段，新加商品行才读取当前商品目录。
- **历史兼容**：旧记录没有 `items` 时，读取时自动包装成默认商品行；旧流水没有 `product_id` 时仍可按总账展示。
- **库存**：商品库存独立扣减/回滚；`stores.current_stock` 保留为所有未删商品库存的兼容聚合值。`addRecord` 会按本次扣减检查每个商品当前库存，`updateRecord` 会按新旧差额检查额外扣减；库存不足时返回 `400`，事务回滚。
- **删除**：商品或分类删除不是库存出库操作；只在目标商品库存均为 0 时允许删除。商品或分类未被记录/流水引用时硬删；已被引用时软删，管理入口隐藏但历史仍显示。

### `addRecord` / `updateRecord` 返回合同

这两个 action 返回 `data` 为扁平结构，不包 `{ record }`：

- `addRecord`：`{ id, store_id, shift_config_id, recorder, record_date, items, qty_opening, qty_closing, qty_gift, qty_sold, sold_wechat, sold_alipay, sold_cash, cash_opening, cash_closing, unit_price, total_revenue, stock_deduct, current_stock, current_cash }`
- `updateRecord`：`{ id, record_date, items, stock_deduct, current_stock, current_cash }`

实现位置：`cloudfunctions/api/index.js`。
