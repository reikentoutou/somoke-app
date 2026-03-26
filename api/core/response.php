<?php
/**
 * 标准化 JSON 响应工具
 * 所有接口统一使用此函数返回数据
 * 兼容 PHP 7.0+
 */

/**
 * 输出成功响应并终止脚本
 */
function jsonSuccess($data = null, $msg = 'success') {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'code' => 200,
        'msg'  => $msg,
        'data' => $data,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * 输出失败响应并终止脚本
 */
function jsonError($msg, $code = 400) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'code' => $code,
        'msg'  => $msg,
        'data' => null,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * 校验请求方法，不匹配则直接返回 405
 */
function requireMethod($method) {
    if ($_SERVER['REQUEST_METHOD'] !== strtoupper($method)) {
        jsonError('请求方法不允许，需要 ' . strtoupper($method), 405);
    }
}

/**
 * 从 POST body 解析 JSON，返回关联数组
 */
function getJsonBody() {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        jsonError('请求体必须为合法的 JSON 格式', 400);
    }
    return $data;
}
