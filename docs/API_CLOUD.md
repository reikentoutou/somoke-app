# 云函数 `api` 接口约定

小程序通过 `wx.cloud.callFunction({ name: 'api', data: { action, ... } })` 调用。  
`miniprogram/utils/request.js` 将原「PHP 路径」映射为 `action`（见下表）。

## 统一响应

```json
{ "code": 200, "msg": "...", "data": { } }
```

`code !== 200` 为错误；`401` 时小程序会清会话并跳转登录页。

## action 一览

| action | 兼容路径（`request.get/post`） | 说明 |
|--------|-------------------------------|------|
| `login` | POST `/login.php` | 可选 `nickname`、`avatar_url`；身份以云函数 `OPENID` 为准 |
| `updateProfile` | POST `/profile_update.php` | `nickname` 必填，≤64 字；返回 `data.user_info` 供本地合并 |
| `getStores` | GET `/get_stores.php` | `data.stores`、`current_store_id` |
| `storeCreate` | POST `/store_create.php` | `name` 必填；`address`、`unit_price`、`currency` 可选 |
| `storeSwitch` | POST `/store_switch.php` | `store_id` |
| `storeJoin` | POST `/store_join.php` | `code` 邀请码 |
| `storeInviteCreate` | POST `/store_invite_create.php` | `store_id`；可选 `max_uses`、`expire_days` |
| `getShifts` | GET `/get_shifts.php` | 当前门店 **启用** 班次列表（`is_active: 1`） |
| `shiftConfigSave` | POST `/shift_config_save.php` | 仅老板；见下文「班次配置」 |
| `shiftConfigDelete` | POST `/shift_config_delete.php` | 仅老板；`id` 班次数字 id，软删 |
| `getRecords` | GET `/get_records.php` | `date`（YYYY-MM-DD）或 `month`（YYYY-MM）；含汇总与列表 |
| `getRecord` | GET `/get_record.php` | `id` 记录数字 id；`data.record` 单条详情 |
| `addRecord` | POST `/add_record.php` | 字段与旧版一致；**营业额** = 固定单价 ×（`sold_wechat`+`sold_alipay`+`sold_cash`）；扣库存规则见云函数 |
| `updateRecord` | POST `/update_record.php` | `id` 必填，其余与新增类似；仅老板或原记录人；会按扣减差额调整 `current_stock` |
| `storeDetail` | GET `/store_detail.php` | `name`、`unit_price`、`current_stock`、`currency`、`recorder_names` 等 |
| `recorderNameAdd` | POST `/recorder_name_add.php` | 仅老板；`name` |
| `recorderNameDelete` | POST `/recorder_name_delete.php` | 仅老板；`name` |
| `getStoreMembers` | GET `/store_members.php` | `data.members`：`user_id`、`nickname`、`role`、`role_name` |
| `storeMemberRemove` | POST `/store_member_remove.php` | `user_id`；员工可退自己，老板可移他人 |
| `storeMemberSetRole` | POST `/store_member_set_role.php` | 仅老板；`user_id`、`role`（1 老板 2 员工） |
| `storeRestock` | POST `/store_restock.php` | `qty` 正整数；仅老板；返回 `current_stock` |
| `withdrawList` | GET `/withdraw_list.php` | 门店成员可读；`data.records`、`data.total_jpy` |
| `withdrawAdd` | POST `/withdraw_add.php` | 仅老板；`amount_jpy`、`record_date`（YYYY-MM-DD） |

### 班次配置（`shiftConfigSave` / `shiftConfigDelete`）

**`shiftConfigSave`**（仅老板）

- **入参**：`name`（必填，≤32）；`start_time`、`end_time`（必填，支持 `HH:mm` 或 `HH:mm:ss`，服务端规范为带秒）；`id`（可选，属于当前门店则更新，否则新增）；`sort_order`（可选）；`icon`（可选，默认 `schedule`，≤32）。
- **返回**：`data` 为 `{ id, name, start_time, end_time, icon, sort_order }`；启用班次上限见云函数（如 30 条则 `400`）。
- **说明**：新增 `is_active: 1`；更新不自动改 `is_active`。

**`shiftConfigDelete`**（仅老板）

- **入参**：`id`（班次数字 id）。
- **返回**：`data` 为 `{ id }`；`is_active` 置 `0`；已停用或不存在则 `404`。

### 记账与库存（概念）

- **单价**：云函数内与日营业额计算一致（当前常量 **3000 円/件**），与 `stores.unit_price` 展示字段可并存。
- **新增**：`addRecord` 写入 `shift_records` 并按规则减少 `stores.current_stock`（不低于 0）。
- **修改**：`updateRecord` 用旧记录与新表单重算扣减，差额写回 `current_stock`。

实现位置：`cloudfunctions/api/index.js`。
