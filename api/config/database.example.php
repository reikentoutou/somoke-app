<?php
/**
 * 数据库连接配置（示例文件）
 * 复制本文件为 database.php 并填入真实凭据
 */

define('DB_HOST',     'localhost');
define('DB_NAME',     'your_database_name');
define('DB_USER',     'your_username');
define('DB_PASSWORD', 'your_password');
define('DB_CHARSET',  'utf8mb4');

/**
 * 获取 PDO 数据库连接实例（单例）
 */
function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = sprintf('mysql:host=%s;dbname=%s;charset=%s', DB_HOST, DB_NAME, DB_CHARSET);
        $pdo = new PDO($dsn, DB_USER, DB_PASSWORD, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    }
    return $pdo;
}
