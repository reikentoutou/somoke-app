# 腾讯云开发（微信云开发）部署说明

业务由 **云函数 `api`** + **云文档数据库** 承载。接口 `action` 列表见 [API_CLOUD.md](./API_CLOUD.md)。

## 1. 上传云函数

1. 微信开发者工具打开本项目根目录。  
2. 展开 **`cloudfunctions/api`**。  
3. 右键 **`api` → Upload and Deploy: Cloud install dependencies**（上传并部署：云端安装依赖）。  
4. 在 **Cloud Base Console → Cloud Function** 中确认函数 **`api`** 状态为 **Deployed**。  
5. **超时**：本仓库 `cloudfunctions/api/config.json` 已设 `timeout: 60`（秒）。云函数默认仅约 **3 秒**，冷启动 + 数据库稍慢即会在小程序端报 **`Error: timeout`**；改完后须**重新上传部署** `api` 才会生效。控制台亦可打开该函数 **配置 → 超时时间** 核对是否为 60s。

## 2. 创建数据库集合（必做，否则登录报 -502005）

云文档库**不会**在首次 `get` 时自动建好集合。若未建 **`users`**，登录时云函数会报错：

`database collection not exists` / **-502005** / `Db or Table not exist: users`。

**操作**：微信开发者工具 → **云开发** → **数据库** → **添加集合**，名称需与下表**完全一致**（建议一次性建好）：

| 集合名 | 用途 |
|--------|------|
| `users` | 文档 ID = 微信 `openid`（**登录最先用到**） |
| `stores` | 门店（含 `current_stock`、`recorder_names` 等） |
| `store_members` | 店员与角色 |
| `store_invites` | 邀请码 |
| `shift_configs` | 班次配置 |
| `shift_records` | 班次销售记录 |
| `store_withdrawals` | 门店取现登记（円） |
| `store_stock_ledger` | 库存流水（补货、校准、记账导致的库存变动） |
| `counters` | 自增序号（见下文文档 ID） |

建好后**无需**手动加全量字段；云函数在登录、建店、记账等流程里会写入文档。若要从旧 MySQL 迁数据，需单独写迁移脚本（本仓库未包含）。

**导入 `counters` 初始文档**：须为 **JSON Lines**（每行一条 JSON，**不要** `[]` 数组）。开发者工具导入框一般只接受 **`.csv` / `.json`**，请选 **`database/import/counters.json`**（扩展名为 `.json`，内容仍是逐行 JSON）。若使用 **`.jsonl`** 也可，以你当前工具是否允许选择为准。

**`counters` 文档 ID（与云函数 `nextSeq` 一致）**：`user`、`store`、`shift_config`、`shift_record`、`invite`、`store_withdrawal`、`stock_ledger` 等；缺哪条，对应业务在首次分配 id 时可能自动 `set`，但建议按导入文件预先建好，避免并发边界问题。

## 3. 云数据库权限（重要）

云函数使用服务端 SDK，**不受客户端权限规则限制**；但仍建议在控制台为各集合设置 **禁止客户端读写**，避免误用 `wx.cloud.database()` 暴露数据：

在 **Database → Permissions / 权限** 中，对 `users`、`stores`、`store_members`、`store_invites`、`shift_configs`、`shift_records`、`store_withdrawals`、`store_stock_ledger`、`counters` 等使用仅云函数可写或 **read/write: false**（以当前控制台界面为准）。

## 4. 集合与字段说明（参考）

| 集合 | 用途 |
|------|------|
| `counters` | 各实体数字 id 自增 |
| `users` | 文档 ID = `openid`；`userId`、`nickname`、`session_token`、`current_store_id` 等 |
| `stores` | 数字 `id`、`name`、`current_stock`、`recorder_names` 等 |
| `store_members` | 文档 ID 形如 `sm_{storeId}_{userId}` |
| `store_invites` | 邀请码哈希与使用次数 |
| `shift_configs` | 每店班次；`is_active` 软删 |
| `shift_records` | 每店每条班次日记账 |
| `store_withdrawals` | 取现流水 |
| `store_stock_ledger` | 库存流水：`event_type`（`restock` / `adjust` / `record_add` / `record_update`）、`delta`、`balance_after`、`ref_record_id`、`note`、`created_at` |

**索引**：`store_stock_ledger` 若控制台提示需索引，可建 **`store_id` + `id`（降序）** 复合索引，供流水列表查询。未建索引时，云函数 `stockLedgerList` 会降级为单次拉取最多 500 条再在内存中排序（数据量大时仍建议建索引）。

## 5. 小程序端

- `miniprogram/utils/request.js` 使用 **`wx.cloud.callFunction`**，单次超时 **60000 ms**；超时类失败会**自动重试 1 次**。  
- `app.js` 使用 **`wx.cloud.DYNAMIC_CURRENT_ENV`**，与开发者工具当前云环境一致。  
- **鉴权**：云函数以 `cloud.getWXContext().OPENID` 为准；小程序本地 `token` 用于请求头兼容，401 时清缓存并回登录页。

## 6. 排错：小程序 `timeout` 与云函数日志不一致

- **以云函数日志为准**：若日志里是 **`collection not exists` / -502005**，根因是**未建集合**（见第 2 节）；修好数据库后重试即可。  
- 若日志显示**执行时间很长**或**无返回**，再查：云函数超时（第 1 节）、`env` 是否一致、是否已「云端安装依赖」。

## 7. 索引（若控制台提示查询需建索引）

在 **Database** 中按报错提示添加复合索引，常见包括：

- `shift_records`：`store_id` + `record_date` 或 `store_id` + `record_month`  
- `users`：`userId`（若 `where userId in` 报错）  
- `stores`：`id`  
- `store_members`：`store_id` + `user_id`（按实际查询字段）
- `store_stock_ledger`：`store_id` + `id`（列表按 id 降序）

## 8. 计费

在云开发控制台查看 **用量与套餐**，避免超出免费额度。
