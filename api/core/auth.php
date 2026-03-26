<?php
/**
 * Token 鉴权工具
 * 从请求头中提取 Token 并验证用户身份
 */

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/response.php';

/**
 * 验证 Token 并返回当前用户信息
 * 如果 Token 无效或过期，直接返回 401 错误并终止
 *
 * @return array 用户信息（id, openid, nickname, role, store_id 等）
 */
function requireAuth() {
    // 从 Authorization 请求头提取 Token
    // 格式：Authorization: Bearer <token>
    $header = isset($_SERVER['HTTP_AUTHORIZATION']) ? $_SERVER['HTTP_AUTHORIZATION']
            : (isset($_SERVER['HTTP_X_TOKEN']) ? $_SERVER['HTTP_X_TOKEN'] : '');
    $token = '';

    if (substr($header, 0, 7) === 'Bearer ') {
        $token = substr($header, 7);
    } else {
        $token = $header;
    }

    if (empty($token)) {
        jsonError('未提供登录凭证，请先登录', 401);
    }

    $pdo = getDB();
    $stmt = $pdo->prepare(
        'SELECT id, openid, nickname, avatar_url, role, store_id
         FROM users
         WHERE session_token = :token AND token_expire_at > NOW() AND is_active = 1'
    );
    $stmt->execute([':token' => $token]);
    $user = $stmt->fetch();

    if (!$user) {
        jsonError('登录已过期或无效，请重新登录', 401);
    }

    return $user;
}
