<?php
/**
 * 获取班次销售记录列表 + 月度统计汇总
 *
 * 请求方式：GET（需登录，携带 Token）
 * 请求参数（Query String）：
 *   - month  string 可选  筛选月份（YYYY-MM），默认当月
 *   - date   string 可选  筛选具体日期（YYYY-MM-DD），优先于 month
 *
 * 返回数据：
 *   - summary  object  月度/日期汇总统计
 *   - records  array   班次记录列表（按日期倒序、班次顺序排列）
 */

require_once __DIR__ . '/core/auth.php';

// ========== 1. 鉴权 ==========
requireMethod('GET');
$user = requireAuth();

$storeId = (int) $user['store_id'];
if ($storeId <= 0) {
    jsonError('当前用户未绑定门店', 403);
}

// ========== 2. 解析筛选参数 ==========
$date  = trim($_GET['date'] ?? '');
$month = trim($_GET['month'] ?? '');

$pdo = getDB();

// 按具体日期查询
if ($date && preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
    $whereClause = 'sr.store_id = :store_id AND sr.record_date = :filter_value';
    $filterValue  = $date;
    $summaryWhere = 'store_id = :store_id AND record_date = :filter_value';
}
// 按月份查询（默认当月）
else {
    if (!$month || !preg_match('/^\d{4}-\d{2}$/', $month)) {
        $month = date('Y-m');
    }
    $whereClause  = 'sr.store_id = :store_id AND sr.record_month = :filter_value';
    $filterValue  = $month;
    $summaryWhere = 'store_id = :store_id AND record_month = :filter_value';
}

// ========== 3. 查询汇总统计 ==========
$stmt = $pdo->prepare("
    SELECT
        COALESCE(SUM(total_revenue), 0)  AS total_revenue,
        COALESCE(SUM(qty_sold), 0)       AS total_sold,
        COALESCE(SUM(qty_gift), 0)       AS total_gift,
        COALESCE(SUM(sold_wechat), 0)    AS total_wechat_qty,
        COALESCE(SUM(sold_alipay), 0)    AS total_alipay_qty,
        COALESCE(SUM(sold_cash), 0)      AS total_cash_qty,
        COALESCE(SUM(sold_wechat * unit_price), 0)  AS total_wechat_amount,
        COALESCE(SUM(sold_alipay * unit_price), 0)  AS total_alipay_amount,
        COALESCE(SUM(sold_cash * unit_price), 0)     AS total_cash_amount,
        COUNT(*)                         AS record_count
    FROM shift_records
    WHERE {$summaryWhere}
");
$stmt->execute([':store_id' => $storeId, ':filter_value' => $filterValue]);
$summary = $stmt->fetch();

// 数值格式化
$summary['total_revenue']       = (float) $summary['total_revenue'];
$summary['total_sold']          = (int)   $summary['total_sold'];
$summary['total_gift']          = (int)   $summary['total_gift'];
$summary['total_wechat_qty']    = (int)   $summary['total_wechat_qty'];
$summary['total_alipay_qty']    = (int)   $summary['total_alipay_qty'];
$summary['total_cash_qty']      = (int)   $summary['total_cash_qty'];
$summary['total_wechat_amount'] = (float) $summary['total_wechat_amount'];
$summary['total_alipay_amount'] = (float) $summary['total_alipay_amount'];
$summary['total_cash_amount']   = (float) $summary['total_cash_amount'];
$summary['record_count']        = (int)   $summary['record_count'];

// ========== 4. 查询记录列表（关联班次名称和记录人） ==========
$stmt = $pdo->prepare("
    SELECT
        sr.id,
        sr.record_date,
        sr.shift_config_id,
        sc.name          AS shift_name,
        sc.start_time    AS shift_start,
        sc.end_time      AS shift_end,
        sc.icon          AS shift_icon,
        sr.recorder_id,
        u.nickname       AS recorder_name,
        sr.qty_opening,
        sr.qty_closing,
        sr.qty_gift,
        sr.qty_sold,
        sr.sold_wechat,
        sr.sold_alipay,
        sr.sold_cash,
        sr.cash_opening,
        sr.cash_closing,
        sr.unit_price,
        sr.total_revenue,
        sr.created_at
    FROM shift_records sr
    JOIN shift_configs sc ON sr.shift_config_id = sc.id
    JOIN users u ON sr.recorder_id = u.id
    WHERE {$whereClause}
    ORDER BY sr.record_date DESC, sc.sort_order ASC
");
$stmt->execute([':store_id' => $storeId, ':filter_value' => $filterValue]);
$records = $stmt->fetchAll();

// 格式化数值类型
foreach ($records as &$row) {
    $row['id']              = (int)   $row['id'];
    $row['shift_config_id'] = (int)   $row['shift_config_id'];
    $row['recorder_id']     = (int)   $row['recorder_id'];
    $row['qty_opening']     = (int)   $row['qty_opening'];
    $row['qty_closing']     = (int)   $row['qty_closing'];
    $row['qty_gift']        = (int)   $row['qty_gift'];
    $row['qty_sold']        = (int)   $row['qty_sold'];
    $row['sold_wechat']     = (int)   $row['sold_wechat'];
    $row['sold_alipay']     = (int)   $row['sold_alipay'];
    $row['sold_cash']       = (int)   $row['sold_cash'];
    $row['cash_opening']    = (float) $row['cash_opening'];
    $row['cash_closing']    = (float) $row['cash_closing'];
    $row['unit_price']      = (float) $row['unit_price'];
    $row['total_revenue']   = (float) $row['total_revenue'];
}
unset($row);

// ========== 5. 返回结果 ==========
jsonSuccess([
    'filter'  => $date ? ['type' => 'date', 'value' => $date]
                       : ['type' => 'month', 'value' => $month ?: date('Y-m')],
    'summary' => $summary,
    'records' => $records,
]);
