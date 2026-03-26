# Somoke Ledger（店铺班次销售记账）

**GitHub：** [https://github.com/reikentoutou/somoke-app](https://github.com/reikentoutou/somoke-app)

微信小程序 + PHP（PDO）+ MySQL，用于按**班次**录入与统计门店销售（微信 / 支付宝 / 现金等），支持微信登录与 Token 鉴权。

## 技术栈

| 端 | 说明 |
|----|------|
| 小程序 | 原生 WXML / WXSS / JS，自定义 TabBar |
| 后端 | PHP 7.x+，PDO，JSON API |
| 数据库 | MySQL 8.x / 5.7（InnoDB，utf8mb4） |

## 仓库结构

```
somoke-app/
├── miniprogram/          # 微信小程序源码（微信开发者工具打开项目根目录）
│   ├── app.js / app.json / app.wxss
│   ├── custom-tab-bar/   # 自定义底部导航
│   ├── pages/            # 登录、概览、录入、报表、设置、班次详情
│   └── utils/            # request、auth、util
├── api/                  # 部署到 Web 主机（如子域名根目录）
│   ├── config/           # database.php / wechat.php（见下方，勿提交密钥）
│   ├── core/             # response.php、auth.php
│   ├── login.php
│   ├── add_record.php
│   ├── get_records.php
│   └── get_shifts.php
├── database/
│   ├── schema.sql        # 全量建表 + 种子数据
│   └── migrations/       # 增量迁移（如已有库补字段）
├── project.config.json   # 小程序工程（含 miniprogramRoot）
└── README.md
```

## 快速开始

### 1. 数据库

1. 在 MySQL 中创建数据库（字符集 `utf8mb4`）。
2. 导入 `database/schema.sql`。
3. 若早期库缺少登录字段，再执行 `database/migrations/001_add_users_session_token.sql`。

### 2. 后端配置（服务器）

1. 将 `api/` 上传到站点目录（例如 `https://你的域名/` 下可直接访问 `login.php`）。
2. 复制示例配置并填写真实值（**不要**把含密码的文件提交到 Git）：

   ```bash
   cp api/config/database.example.php api/config/database.php
   cp api/config/wechat.example.php api/config/wechat.php
   ```

3. 确保 Web 服务器对 `api/config/` 禁止直接 HTTP 访问（项目内已有 `api/config/.htaccess` 示例，依主机环境调整）。

### 3. 小程序配置

1. 用**微信开发者工具**打开本仓库**根目录**（会读取根目录的 `project.config.json`）。
2. 在 `miniprogram/utils/request.js` 中把 `BASE_URL` 改为你的 HTTPS API 根地址（无尾部 `/`），例如：  
   `https://api.example.com`
3. 在微信公众平台 → 开发 → 开发管理 → **服务器域名**，将上述域名加入 **request 合法域名**。
4. 在 `project.config.json` 中配置你的小程序 **AppID**（与公众平台一致）。

### 4. 登录与鉴权说明

- 用户在微信登录页点击「微信一键登录」后，请求 `login.php` 换取业务 `token`。
- 后续接口在 Header 中携带：`Authorization: Bearer <token>`。
- Token 过期或无效时返回 `401`，小程序会跳转登录页。

## API 一览

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/login.php` | `code`（wx.login）换 token |
| GET | `/get_shifts.php` | 当前门店班次配置 |
| POST | `/add_record.php` | 提交班次销售记录 |
| GET | `/get_records.php` | 按 `date` 或 `month` 查询记录与汇总 |

统一响应形如：`{ "code": 200, "msg": "...", "data": ... }`（错误时 `code` 非 200）。

## 安全与隐私

- `api/config/database.php`、`api/config/wechat.php` 已列入 `.gitignore`，请勿提交。
- 上线前建议在 `login.php` 等文件中关闭 `display_errors`，仅记录日志。

## 常见问题

- **合法域名校验**：开发者工具里可临时关闭「不校验合法域名」；**真机与正式版必须配置合法域名**。
- **`Error: timeout` / Canary 基础库**：可尝试将调试基础库改为**稳定版**，并以真机结果为准。
- **`object null is not iterable`**：多为列表数据为 `null`，需保证接口返回数组或 WXML 使用 `wx:for="{{list || []}}"`。

## 开源协议

若需对外发布，请自行补充 `LICENSE`（本仓库默认未附带）。

---

## 上传到 GitHub（新建仓库）

在本地已 `git init` 并完成首次提交后，按下面任选一种方式。

### 方式 A：网页创建仓库

1. 打开 [GitHub](https://github.com/new)，**New repository**，名称自定（如 `somoke-app`），**不要**勾选 “Add a README”（本地已有）。
2. 在终端执行（将 `YOUR_USER` / `somoke-app` 换成你的）：

   ```bash
   cd /path/to/somoke-app
   git remote add origin git@github.com:YOUR_USER/somoke-app.git
   git branch -M main
   git push -u origin main
   ```

   若使用 HTTPS：

   ```bash
   git remote add origin https://github.com/YOUR_USER/somoke-app.git
   git branch -M main
   git push -u origin main
   ```

### 方式 B：GitHub CLI（`gh`）

```bash
cd /path/to/somoke-app
gh repo create somoke-app --private --source=. --remote=origin --push
```

推送前请确认 `git status` 中**不会出现** `database.php` / `wechat.php` 等待提交文件（应被 `.gitignore` 忽略）。
