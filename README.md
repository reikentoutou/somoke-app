# Somoke Ledger（店铺班次销售记账）

**GitHub：** [https://github.com/reikentoutou/somoke-app](https://github.com/reikentoutou/somoke-app)

微信小程序（**uni-app + Vue 3 + TypeScript**）+ **微信云开发**：云函数 `api` + 云文档数据库。按**班次**录入与统计门店销售（微信 / 支付宝 / 现金等）。

## 技术栈

| 部分     | 说明                                                                                                               |
| -------- | ------------------------------------------------------------------------------------------------------------------ |
| 小程序   | [`packages/app/`](packages/app/) — uni-app、Vue 3 `<script setup>`、Pinia、自定义 tabBar（原生 `custom-tab-bar/`） |
| 类型契约 | [`packages/shared/`](packages/shared/) — 与云函数对齐的 TS 类型与常量                                              |
| 后端     | [`cloudfunctions/api/`](cloudfunctions/api/) — Node.js + `wx-server-sdk`                                           |
| 数据     | 云开发文档数据库（集合见 [docs/CLOUD_SETUP.md](docs/CLOUD_SETUP.md)）                                              |

## 仓库结构

```
somoke-app/
├── packages/
│   ├── app/                 # 小程序源码与构建配置（Vite + @dcloudio/vite-plugin-uni）
│   │   ├── src/             # 页面、组件、composables、stores、api
│   │   └── dist/
│   │       ├── dev/mp-weixin/    # 开发构建（pnpm dev）
│   │       └── build/mp-weixin/  # 生产构建（pnpm build），用于上传体验版/正式版
│   └── shared/              # 前后端共享类型
├── cloudfunctions/
│   └── api/                 # 业务云函数（上传部署）
├── database/
│   └── import/              # 如 counters 初始文档（见 CLOUD_SETUP）
├── docs/
│   ├── CLOUD_SETUP.md       # 云开发部署、集合、权限与索引
│   ├── API_CLOUD.md         # 云函数 action 与响应约定
│   └── AGENT_PROMPTS.md     # 多会话开局 Prompt
├── package.json             # workspace 根：pnpm scripts、husky、lint-staged
├── pnpm-workspace.yaml
└── README.md
```

## 功能要点（与文档同步）

- **登录 / 多门店**：`needs_onboarding`、`needs_store_selection`；会话见 `packages/app/src/stores/auth.ts`。
- **录入与改账**：Tab「录入」与班次详情内改账共用 `LedgerRecordForm`；更新走 `updateRecord` 全量必填字段。
- **库存**：`stores.current_stock`；记账扣减、改账差额回算；**库存流水**与**库存校准**见设置 → 库存相关入口。
- **营业额**：与云函数内单价常量一致（当前为 **3000 円/件** × 微信+支付宝+现金件数）；详见 [docs/API_CLOUD.md](docs/API_CLOUD.md)。

## 快速开始

### 1. 依赖

```bash
pnpm install
```

### 2. 本地开发（微信小程序）

```bash
pnpm dev
```

等价于 `pnpm -C packages/app dev:mp-weixin`。构建完成后，用**微信开发者工具**打开目录：

`packages/app/dist/dev/mp-weixin/`

该目录下的 `project.config.json` 在每次构建结束时会写入 **`cloudfunctionRoot`**（相对路径指向仓库根目录的 `cloudfunctions/`），可在工具里直接右键上传云函数。

### 3. 生产构建与上传

```bash
pnpm build
```

打开 `packages/app/dist/build/mp-weixin/`，在开发者工具中**上传**为体验版或提交审核。

### 4. 云函数部署

1. 按上一步打开 **dev** 或 **build** 产物目录（须含正确 `appid`）。
2. 展开 **`cloudfunctions/api`**（由 `cloudfunctionRoot` 解析到仓库内目录）。
3. 右键 **`api` → Upload and Deploy: Cloud install dependencies**。

亦可使用 [微信云开发控制台](https://console.cloud.tencent.com/tcb) 上传同名函数（以当前团队流程为准）。

### 5. 数据库

按 [docs/CLOUD_SETUP.md](docs/CLOUD_SETUP.md) **创建全部集合**并配置权限与建议索引。

接口说明：[docs/API_CLOUD.md](docs/API_CLOUD.md)。

### 6. 质量检查（可选）

```bash
pnpm typecheck
pnpm test
pnpm lint
```

## 多会话协作（Cursor）

- 开局 Prompt：[docs/AGENT_PROMPTS.md](docs/AGENT_PROMPTS.md)
- 规则文件：`.cursor/rules/somoke-cloud.mdc`、`somoke-api.mdc`、`somoke-miniprogram.mdc`

## 常见问题

- **合法域名**：业务走 `wx.cloud.callFunction`，一般**不必**再配自建 API 的 request 合法域名。
- **Canary 基础库**：调试异常时可换**稳定版**基础库并对照真机。
- **列表渲染**：`v-for` / `wx:for` 绑定须为数组；避免对 `null` 迭代（真机可能报 `object null is not iterable`）。
- **改云函数后**：须重新 **Upload and Deploy**，否则客户端仍是旧逻辑。
- **产物路径**：不要手工改 `packages/app/dist/**/project.config.json` 里的关键字段后指望保留；应改 [packages/app/vite.config.ts](packages/app/vite.config.ts) 中的构建后处理逻辑，再重新 `pnpm dev` / `pnpm build`。

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
