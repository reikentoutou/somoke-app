# Somoke Ledger（店铺班次销售记账）

**GitHub：** [https://github.com/reikentoutou/somoke-app](https://github.com/reikentoutou/somoke-app)

微信小程序（原生）+ **微信云开发**：云函数 `api` + 云文档数据库。按**班次**录入与统计门店销售（微信 / 支付宝 / 现金等）。

## 技术栈

| 部分   | 说明                                                                  |
| ------ | --------------------------------------------------------------------- |
| 小程序 | `miniprogram/` — WXML / WXSS / JS，自定义 TabBar                      |
| 后端   | `cloudfunctions/api/` — Node.js + `wx-server-sdk`                     |
| 数据   | 云开发文档数据库（集合见 [docs/CLOUD_SETUP.md](docs/CLOUD_SETUP.md)） |

## 仓库结构

```
somoke-app/
├── miniprogram/           # 小程序（微信开发者工具打开本仓库根目录）
│   ├── app.* / pages/ / custom-tab-bar/ / utils/
│   │   └── utils/ledgerRecordForm.js   # 录入与详情「改账」共用的营业额/软校验逻辑
│   └── project.private.config.json   # 本地设置（可不入库）
├── cloudfunctions/
│   └── api/               # 业务云函数（上传部署）
├── database/
│   └── import/            # 如 counters 初始文档（见 CLOUD_SETUP）
├── docs/
│   ├── CLOUD_SETUP.md     # 云开发部署、集合、权限与索引
│   ├── API_CLOUD.md       # 云函数 action 与响应约定
│   └── AGENT_PROMPTS.md   # 多会话开局 Prompt
├── project.config.json    # 工程：miniprogramRoot、cloudfunctionRoot、appid
└── README.md
```

## 功能要点（与文档同步）

- **登录 / 多门店**：`needs_onboarding`、`needs_store_selection` 与 `utils/store.js` 会话逻辑一致。
- **录入与改账**：Tab「录入」支持新增与修改；**班次详情页**内可「修改本条记录」并调用 `updateRecord`（无需再跳 Tab 录入）。
- **库存**：`stores.current_stock`；记账提交按规则扣减；**修改记录**时服务端按旧/新扣减差额回算；管理员在设置中 **补货**（`storeRestock`）。**库存流水**（全员在设置中查看）与**库存校准**（管理员将系统库存对齐实盘）见设置 → 运营控制 → 库存管理区域。
- **营业额**：与云函数内单价常量一致（当前为 **3000 円/件** × 微信+支付宝+现金件数）；详见 [docs/API_CLOUD.md](docs/API_CLOUD.md)。

## 快速开始

1. 用微信开发者工具打开**仓库根目录**（读取根目录 `project.config.json`）。
2. `miniprogram/app.js` 中 `wx.cloud.init` 使用 `**wx.cloud.DYNAMIC_CURRENT_ENV`\*\*，与工具当前所选云环境一致；切换环境时在开发者工具里改云环境即可。
3. 右键 `**cloudfunctions/api` → Upload and Deploy: Cloud install dependencies\*\*（上传并部署：云端安装依赖）。
4. 按 [docs/CLOUD_SETUP.md](docs/CLOUD_SETUP.md) **创建全部集合**并配置权限与建议索引。

接口说明：[docs/API_CLOUD.md](docs/API_CLOUD.md)。

## 多会话协作（Cursor）

- 开局 Prompt：[docs/AGENT_PROMPTS.md](docs/AGENT_PROMPTS.md)
- 规则文件：`.cursor/rules/somoke-cloud.mdc`、`somoke-api.mdc`、`somoke-miniprogram.mdc`

## 常见问题

- **合法域名**：业务走 `callFunction`，一般**不必**再配自建 API 的 request 合法域名。
- **Canary 基础库**：调试异常时可换**稳定版**基础库并对照真机。
- **列表渲染**：`wx:for` 绑定数组，使用 `{{list || []}}`，避免 `null` 报错。
- **仅改小程序**：若未改 `cloudfunctions/api/`，一般**无需**重新上传云函数。

## 开源协议

若对外发布，请自行补充 `LICENSE`。

---

## 上传到 GitHub

```bash
git remote add origin git@github.com:YOUR_USER/somoke-app.git
git branch -M main
git push -u origin main
```

或使用 `gh repo create somoke-app --private --source=. --remote=origin --push`。
