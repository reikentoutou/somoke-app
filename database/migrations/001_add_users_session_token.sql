-- ============================================================
-- 为已存在的 users 表补充登录 Token 字段（与 schema.sql 一致）
-- 若 login.php 报错：Unknown column 'session_token' in 'SET'
-- 请在 phpMyAdmin 中选择数据库 tkzdrnxk_somoke_app 后执行本脚本
-- ============================================================

ALTER TABLE `users`
  ADD COLUMN `session_token` VARCHAR(64) DEFAULT NULL COMMENT '登录会话Token（由后端生成）',
  ADD COLUMN `token_expire_at` DATETIME DEFAULT NULL COMMENT 'Token过期时间';

ALTER TABLE `users`
  ADD UNIQUE KEY `uk_session_token` (`session_token`);
