<?php
/**
 * 微信小程序登录接口
 *
 * 请求方式：POST
 * 请求参数（JSON Body）：
 *   - code       string 必填  微信 wx.login() 获取的临时登录凭证
 *   - nickname   string 可选  用户昵称
 *   - avatar_url string 可选  用户头像URL
 *
 * 返回数据：
 *   - token      string  自定义登录凭证（后续请求需携带）
 *   - expire_at  string  Token 过期时间
 *   - user_info  object  用户基本信息
 */

// ========== 调试模式：上线后请注释掉这两行 ==========
ini_set('display_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/config/database.php';
require_once __DIR__ . '/config/wechat.php';
require_once __DIR__ . '/core/response.php';

// ========== 1. 校验请求 ==========
requireMethod('POST');
$input = getJsonBody();

$code = isset($input['code']) ? trim($input['code']) : '';
if (empty($code)) {
    jsonError('缺少必填参数 code');
}

// ========== 2. 用 cURL 调用微信接口换取 openid ==========
$wxUrl = sprintf(
    'https://api.weixin.qq.com/sns/jscode2session?appid=%s&secret=%s&js_code=%s&grant_type=authorization_code',
    WX_APPID,
    WX_SECRET,
    urlencode($code)
);

$ch = curl_init();
if ($ch === false) {
    jsonError('服务器不支持 cURL 扩展，无法请求微信接口', 500);
}

curl_setopt_array($ch, [
    CURLOPT_URL            => $wxUrl,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 10,
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2,
]);

$wxResponse = curl_exec($ch);
$curlErrno  = curl_errno($ch);
$curlError  = curl_error($ch);
$httpCode   = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($curlErrno !== 0) {
    jsonError('请求微信服务器失败 (cURL #' . $curlErrno . '): ' . $curlError, 502);
}

if ($httpCode !== 200) {
    jsonError('微信服务器返回异常 HTTP ' . $httpCode, 502);
}

$wxData = json_decode($wxResponse, true);
if (!is_array($wxData)) {
    jsonError('微信服务器返回数据解析失败: ' . substr($wxResponse, 0, 200), 502);
}

if (empty($wxData['openid'])) {
    $errCode = isset($wxData['errcode']) ? $wxData['errcode'] : '未知';
    $errMsg  = isset($wxData['errmsg'])  ? $wxData['errmsg']  : '未知错误';
    jsonError('微信登录失败 (' . $errCode . '): ' . $errMsg, 401);
}

$openid = $wxData['openid'];

// ========== 3～5. 数据库：查/建用户、写 Token、返回 JSON（统一 try-catch，避免 HTML 致命错误）==========
try {
    $pdo = getDB();

    $stmt = $pdo->prepare('SELECT id, nickname, avatar_url, role, store_id FROM users WHERE openid = :openid');
    $stmt->execute([':openid' => $openid]);
    $user = $stmt->fetch();

    $nickname  = isset($input['nickname'])   ? trim($input['nickname'])   : '';
    $avatarUrl = isset($input['avatar_url']) ? trim($input['avatar_url']) : '';

    if (!$user) {
        $stmt = $pdo->prepare(
            'INSERT INTO users (openid, nickname, avatar_url, role, store_id)
             VALUES (:openid, :nickname, :avatar_url, 2, 1)'
        );
        $stmt->execute([
            ':openid'     => $openid,
            ':nickname'   => $nickname,
            ':avatar_url' => $avatarUrl,
        ]);
        $userId = (int) $pdo->lastInsertId();
        $user = [
            'id'         => $userId,
            'nickname'   => $nickname,
            'avatar_url' => $avatarUrl,
            'role'       => 2,
            'store_id'   => 1,
        ];
    } else {
        $userId = (int) $user['id'];
        if ($nickname || $avatarUrl) {
            $updates = [];
            $params  = [':id' => $userId];
            if ($nickname) {
                $updates[] = 'nickname = :nickname';
                $params[':nickname'] = $nickname;
            }
            if ($avatarUrl) {
                $updates[] = 'avatar_url = :avatar_url';
                $params[':avatar_url'] = $avatarUrl;
            }
            if ($updates) {
                $sql = 'UPDATE users SET ' . implode(', ', $updates) . ' WHERE id = :id';
                $pdo->prepare($sql)->execute($params);
            }
        }
    }

    $token    = bin2hex(random_bytes(32));
    $expireAt = date('Y-m-d H:i:s', time() + TOKEN_EXPIRE_SECONDS);

    $stmt = $pdo->prepare(
        'UPDATE users SET session_token = :token, token_expire_at = :expire_at WHERE id = :id'
    );
    $stmt->execute([
        ':token'     => $token,
        ':expire_at' => $expireAt,
        ':id'        => $userId,
    ]);

    jsonSuccess([
        'token'     => $token,
        'expire_at' => $expireAt,
        'user_info' => [
            'id'         => $userId,
            'nickname'   => $user['nickname'],
            'avatar_url' => $user['avatar_url'],
            'role'       => (int) $user['role'],
            'store_id'   => (int) $user['store_id'],
        ],
    ], '登录成功');
} catch (PDOException $e) {
    $raw = $e->getMessage();
    if (strpos($raw, 'session_token') !== false && strpos($raw, 'Unknown column') !== false) {
        jsonError('数据库 users 表缺少 session_token / token_expire_at 字段，请在 phpMyAdmin 执行 database/migrations/001_add_users_session_token.sql', 500);
    }
    jsonError('数据库错误，请稍后重试', 500);
}
