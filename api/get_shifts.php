<?php
/**
 * 获取班次配置列表接口
 *
 * 请求方式：GET（需登录，携带 Token）
 * 返回数据：当前门店的所有启用班次配置
 */

require_once __DIR__ . '/core/auth.php';

requireMethod('GET');
$user = requireAuth();

$storeId = (int) $user['store_id'];
if ($storeId <= 0) {
    jsonError('当前用户未绑定门店', 403);
}

$pdo = getDB();
$stmt = $pdo->prepare(
    'SELECT id, name, start_time, end_time, icon, sort_order
     FROM shift_configs
     WHERE store_id = :store_id AND is_active = 1
     ORDER BY sort_order ASC'
);
$stmt->execute([':store_id' => $storeId]);
$shifts = $stmt->fetchAll();

foreach ($shifts as &$row) {
    $row['id'] = (int) $row['id'];
    $row['sort_order'] = (int) $row['sort_order'];
}
unset($row);

jsonSuccess($shifts);
