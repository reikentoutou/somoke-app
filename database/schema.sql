-- ============================================================
-- 店铺班次销售管理系统 - MySQL 数据库表结构
-- 数据库名：tkzdrnxk_somoke_app
-- 字符集：utf8mb4（支持 emoji 等特殊字符）
-- 业务模型：多店铺 → 班次记录 → 销售/库存/现金
-- ============================================================

-- Mixhost 共享主机已预建数据库，无需 CREATE DATABASE
-- 直接在 cPanel 中选择 tkzdrnxk_somoke_app 后导入本文件即可

-- ============================================================
-- 1. 门店表 (stores)
-- 说明：支持多店铺，每个门店有独立的商品单价和库存
-- ============================================================
CREATE TABLE `stores` (
  `id`            INT UNSIGNED    NOT NULL AUTO_INCREMENT COMMENT '门店ID，主键自增',
  `name`          VARCHAR(64)     NOT NULL                COMMENT '门店名称',
  `address`       VARCHAR(256)    NOT NULL DEFAULT ''      COMMENT '门店地址',
  `unit_price`    DECIMAL(10,2)   NOT NULL DEFAULT 0.00   COMMENT '商品单价（元），用于营收计算',
  `current_stock` INT UNSIGNED    NOT NULL DEFAULT 0       COMMENT '当前库存数量（实时更新）',
  `currency`      VARCHAR(8)      NOT NULL DEFAULT 'CNY'  COMMENT '货币单位',
  `is_active`     TINYINT UNSIGNED NOT NULL DEFAULT 1      COMMENT '是否营业中：1=是，0=否',
  `created_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='门店表';

-- ============================================================
-- 2. 用户表 (users)
-- 说明：通过微信 OpenID 绑定，区分管理员和普通员工
-- ============================================================
CREATE TABLE `users` (
  `id`         INT UNSIGNED     NOT NULL AUTO_INCREMENT COMMENT '用户ID，主键自增',
  `openid`     VARCHAR(64)      NOT NULL                COMMENT '微信用户唯一标识 (OpenID)',
  `nickname`   VARCHAR(64)      NOT NULL DEFAULT ''      COMMENT '用户昵称（微信昵称或自定义）',
  `avatar_url` VARCHAR(512)     NOT NULL DEFAULT ''      COMMENT '头像URL',
  `role`       TINYINT UNSIGNED NOT NULL DEFAULT 2       COMMENT '角色：1=管理员（老板），2=普通员工（记录员）',
  `store_id`   INT UNSIGNED     DEFAULT NULL              COMMENT '所属门店ID（关联 stores.id）',
  `is_active`      TINYINT UNSIGNED NOT NULL DEFAULT 1       COMMENT '是否在职：1=在职，0=离职',
  `session_token`  VARCHAR(64)      DEFAULT NULL              COMMENT '登录会话Token（由后端生成）',
  `token_expire_at` DATETIME        DEFAULT NULL              COMMENT 'Token过期时间',
  `created_at`     DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '注册时间',
  `updated_at`     DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_openid` (`openid`),
  UNIQUE KEY `uk_session_token` (`session_token`),
  KEY `idx_store_id` (`store_id`),
  KEY `idx_role` (`role`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户表';

-- ============================================================
-- 3. 班次配置表 (shift_configs)
-- 说明：定义每个门店的班次（早班/中班/晚班等），可自定义
-- ============================================================
CREATE TABLE `shift_configs` (
  `id`         INT UNSIGNED     NOT NULL AUTO_INCREMENT COMMENT '班次配置ID，主键自增',
  `store_id`   INT UNSIGNED     NOT NULL                COMMENT '所属门店ID',
  `name`       VARCHAR(32)      NOT NULL                COMMENT '班次名称（如：早班、中班、晚班）',
  `start_time` TIME             NOT NULL                COMMENT '班次开始时间（如 08:00:00）',
  `end_time`   TIME             NOT NULL                COMMENT '班次结束时间（如 14:00:00）',
  `icon`       VARCHAR(64)      NOT NULL DEFAULT ''      COMMENT '班次图标标识（如 wb_sunny / dark_mode）',
  `sort_order` INT UNSIGNED     NOT NULL DEFAULT 0       COMMENT '排序权重，值越小越靠前',
  `is_active`  TINYINT UNSIGNED NOT NULL DEFAULT 1       COMMENT '是否启用：1=启用，0=停用',
  `created_at` DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_store_active` (`store_id`, `is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='班次配置表';

-- ============================================================
-- 4. 班次销售记录表 (shift_records) — 核心业务表
-- 说明：每天每个班次一条记录，包含库存、销量、支付明细、现金
-- 索引策略：围绕「门店+日期」「门店+月份」「记录人」高频查询场景
-- ============================================================
CREATE TABLE `shift_records` (
  `id`              BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT COMMENT '记录ID，主键自增',
  `store_id`        INT UNSIGNED     NOT NULL                COMMENT '所属门店ID',
  `shift_config_id` INT UNSIGNED     NOT NULL                COMMENT '班次配置ID（关联 shift_configs.id）',
  `recorder_id`     INT UNSIGNED     NOT NULL                COMMENT '记录人用户ID（关联 users.id）',
  `record_date`     DATE             NOT NULL                COMMENT '记录日期（班次所在日期）',
  `record_month`    CHAR(7)          NOT NULL                COMMENT '记录月份（冗余字段，YYYY-MM，加速按月统计）',

  -- 库存相关
  `qty_opening`     INT UNSIGNED     NOT NULL DEFAULT 0      COMMENT '上班数量（开班库存）',
  `qty_closing`     INT UNSIGNED     NOT NULL DEFAULT 0      COMMENT '下班数量（收班库存）',
  `qty_gift`        INT UNSIGNED     NOT NULL DEFAULT 0      COMMENT '赠送数量（不计入营收）',

  -- 各支付方式卖出数量
  `sold_wechat`     INT UNSIGNED     NOT NULL DEFAULT 0      COMMENT '微信卖出数量',
  `sold_alipay`     INT UNSIGNED     NOT NULL DEFAULT 0      COMMENT '支付宝卖出数量',
  `sold_cash`       INT UNSIGNED     NOT NULL DEFAULT 0      COMMENT '现金卖出数量',

  -- 现金清算
  `cash_opening`    DECIMAL(12,2)    NOT NULL DEFAULT 0.00   COMMENT '上班现金（现金底金，交班时收银台现金）',
  `cash_closing`    DECIMAL(12,2)    NOT NULL DEFAULT 0.00   COMMENT '下班现金（收班时收银台现金总额）',

  -- 冗余汇总（写入时计算，加速读取）
  `qty_sold`        INT UNSIGNED     NOT NULL DEFAULT 0      COMMENT '总卖出数量（= qty_opening - qty_closing - qty_gift）',
  `total_revenue`   DECIMAL(12,2)    NOT NULL DEFAULT 0.00   COMMENT '总营收（= qty_sold × unit_price，赠送不计入）',
  `unit_price`      DECIMAL(10,2)    NOT NULL DEFAULT 0.00   COMMENT '记录时的商品单价（快照，防止调价影响历史）',

  `created_at`      DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at`      DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_store_shift_date` (`store_id`, `shift_config_id`, `record_date`),
  KEY `idx_store_date` (`store_id`, `record_date`),
  KEY `idx_store_month` (`store_id`, `record_month`),
  KEY `idx_recorder_date` (`recorder_id`, `record_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='班次销售记录表（核心业务表）';

-- ============================================================
-- 5. 取现记录表 (cash_withdrawals)
-- 说明：管理员从收银台取走现金的记录，影响下班现金核算
-- ============================================================
CREATE TABLE `cash_withdrawals` (
  `id`              BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT COMMENT '取现记录ID，主键自增',
  `store_id`        INT UNSIGNED     NOT NULL                COMMENT '所属门店ID',
  `operator_id`     INT UNSIGNED     NOT NULL                COMMENT '操作人用户ID（通常为管理员）',
  `shift_record_id` BIGINT UNSIGNED  DEFAULT NULL             COMMENT '关联的班次记录ID（可选，标记在哪个班次期间取现）',
  `amount`          DECIMAL(12,2)    NOT NULL                COMMENT '取现金额（元）',
  `withdraw_date`   DATE             NOT NULL                COMMENT '取现日期',
  `remark`          VARCHAR(256)     NOT NULL DEFAULT ''      COMMENT '备注',
  `created_at`      DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_store_date` (`store_id`, `withdraw_date`),
  KEY `idx_operator` (`operator_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='取现记录表';

-- ============================================================
-- 6. 库存变动日志表 (inventory_logs)
-- 说明：记录每次补货/调整的详情，提供库存审计追踪
-- ============================================================
CREATE TABLE `inventory_logs` (
  `id`            BIGINT UNSIGNED  NOT NULL AUTO_INCREMENT COMMENT '日志ID，主键自增',
  `store_id`      INT UNSIGNED     NOT NULL                COMMENT '所属门店ID',
  `operator_id`   INT UNSIGNED     NOT NULL                COMMENT '操作人用户ID',
  `change_type`   TINYINT UNSIGNED NOT NULL DEFAULT 1      COMMENT '变动类型：1=补货入库，2=损耗报废，3=手动调整',
  `quantity`      INT              NOT NULL                COMMENT '变动数量（正数=增加，负数=减少）',
  `stock_before`  INT UNSIGNED     NOT NULL                COMMENT '变动前库存数量',
  `stock_after`   INT UNSIGNED     NOT NULL                COMMENT '变动后库存数量',
  `remark`        VARCHAR(256)     NOT NULL DEFAULT ''      COMMENT '备注（如：供应商名称、调整原因）',
  `created_at`    DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_store_time` (`store_id`, `created_at`),
  KEY `idx_operator` (`operator_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='库存变动日志表';

-- ============================================================
-- 7. 预设初始数据
-- ============================================================

-- 示例门店
INSERT INTO `stores` (`name`, `address`, `unit_price`, `current_stock`, `currency`) VALUES
('总店', '', 27.00, 128, 'CNY');

-- 默认班次配置（门店ID=1）
INSERT INTO `shift_configs` (`store_id`, `name`, `start_time`, `end_time`, `icon`, `sort_order`) VALUES
(1, '早班', '07:00:00', '13:00:00', 'wb_sunny',    1),
(1, '白1', '13:00:00', '18:00:00', 'light_mode',   2),
(1, '白2', '18:00:00', '23:00:00', 'routine',      3),
(1, '夜班', '23:00:00', '07:00:00', 'dark_mode',   4);
