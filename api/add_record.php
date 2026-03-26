<?php
/**
 * 录入班次销售记录接口
 *
 * 请求方式：POST（需登录，携带 Token）
 * 请求参数（JSON Body）：
 *   - record_date      string 必填  记录日期（YYYY-MM-DD）
 *   - shift_config_id  int    必填  班次配置ID
 *   - qty_opening      int    必填  上班数量（开班库存）
 *   - qty_closing       int    必填  下班数量（收班库存）
 *   - qty_gift         int    可选  赠送数量（默认0）
 *   - sold_wechat      int    可选  微信卖出数量（默认0）
 *   - sold_alipay      int    可选  支付宝卖出数量（默认0）
 *   - sold_cash        int    可选  现金卖出数量（默认0）
 *   - cash_opening     float  可选  上班现金/底金（默认0）
 *   - cash_closing     float  可选  下班现金（默认0）
 *
 * 返回数据：新创建的记录详情
 *
 * 业务逻辑：
 *   - qty_sold = qty_opening - qty_closing - qty_gift
 *   - total_revenue = qty_sold × 门店当前单价
 *   - unit_price 从 stores 表快照写入（防调价影响历史）
 *   - 同一门店同一班次同一天不能重复录入（唯一约束）
 */

require_once __DIR__ . '/core/auth.php';

// ========== 1. 鉴权 ==========
requireMethod('POST');
$user = requireAuth();

// ========== 2. 解析并校验参数 ==========
$input = getJsonBody();

$recordDate    = trim($input['record_date'] ?? '');
$shiftConfigId = (int) ($input['shift_config_id'] ?? 0);
$qtyOpening    = (int) ($input['qty_opening'] ?? 0);
$qtyClosing    = (int) ($input['qty_closing'] ?? 0);
$qtyGift       = (int) ($input['qty_gift'] ?? 0);
$soldWechat    = (int) ($input['sold_wechat'] ?? 0);
$soldAlipay    = (int) ($input['sold_alipay'] ?? 0);
$soldCash      = (int) ($input['sold_cash'] ?? 0);
$cashOpening   = (float) ($input['cash_opening'] ?? 0);
$cashClosing   = (float) ($input['cash_closing'] ?? 0);

// 日期格式校验
if (!$recordDate || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $recordDate)) {
    jsonError('record_date 格式不正确，需要 YYYY-MM-DD');
}
if ($shiftConfigId <= 0) {
    jsonError('请选择有效的班次');
}
if ($qtyOpening < 0 || $qtyClosing < 0) {
    jsonError('上班数量和下班数量不能为负数');
}

$storeId = (int) $user['store_id'];
if ($storeId <= 0) {
    jsonError('当前用户未绑定门店，无法录入', 403);
}

// ========== 3. 校验班次配置是否存在 ==========
$pdo = getDB();

$stmt = $pdo->prepare(
    'SELECT id FROM shift_configs WHERE id = :id AND store_id = :store_id AND is_active = 1'
);
$stmt->execute([':id' => $shiftConfigId, ':store_id' => $storeId]);
if (!$stmt->fetch()) {
    jsonError('所选班次不存在或已停用');
}

// ========== 4. 获取门店当前单价（快照） ==========
$stmt = $pdo->prepare('SELECT unit_price FROM stores WHERE id = :store_id');
$stmt->execute([':store_id' => $storeId]);
$store = $stmt->fetch();
if (!$store) {
    jsonError('门店信息不存在', 500);
}
$unitPrice = (float) $store['unit_price'];

// ========== 5. 计算汇总字段 ==========
$qtySold = $qtyOpening - $qtyClosing - $qtyGift;
if ($qtySold < 0) {
    $qtySold = 0; // 防止异常数据导致负数营收
}
$totalRevenue = round($qtySold * $unitPrice, 2);
$recordMonth  = substr($recordDate, 0, 7); // YYYY-MM

// ========== 6. 插入记录 ==========
try {
    $stmt = $pdo->prepare(
        'INSERT INTO shift_records (
            store_id, shift_config_id, recorder_id, record_date, record_month,
            qty_opening, qty_closing, qty_gift,
            sold_wechat, sold_alipay, sold_cash,
            cash_opening, cash_closing,
            qty_sold, total_revenue, unit_price
        ) VALUES (
            :store_id, :shift_config_id, :recorder_id, :record_date, :record_month,
            :qty_opening, :qty_closing, :qty_gift,
            :sold_wechat, :sold_alipay, :sold_cash,
            :cash_opening, :cash_closing,
            :qty_sold, :total_revenue, :unit_price
        )'
    );
    $stmt->execute([
        ':store_id'        => $storeId,
        ':shift_config_id' => $shiftConfigId,
        ':recorder_id'     => $user['id'],
        ':record_date'     => $recordDate,
        ':record_month'    => $recordMonth,
        ':qty_opening'     => $qtyOpening,
        ':qty_closing'     => $qtyClosing,
        ':qty_gift'        => $qtyGift,
        ':sold_wechat'     => $soldWechat,
        ':sold_alipay'     => $soldAlipay,
        ':sold_cash'       => $soldCash,
        ':cash_opening'    => $cashOpening,
        ':cash_closing'    => $cashClosing,
        ':qty_sold'        => $qtySold,
        ':total_revenue'   => $totalRevenue,
        ':unit_price'      => $unitPrice,
    ]);
} catch (PDOException $e) {
    // 唯一约束冲突：同一门店同一班次同一天已有记录
    if ($e->getCode() == 23000) {
        jsonError('该日期该班次已有记录，不能重复录入');
    }
    jsonError('数据保存失败：' . $e->getMessage(), 500);
}

$recordId = (int) $pdo->lastInsertId();

// ========== 7. 返回新创建的记录 ==========
jsonSuccess([
    'id'            => $recordId,
    'store_id'      => $storeId,
    'shift_config_id' => $shiftConfigId,
    'recorder'      => $user['nickname'],
    'record_date'   => $recordDate,
    'qty_opening'   => $qtyOpening,
    'qty_closing'   => $qtyClosing,
    'qty_gift'      => $qtyGift,
    'qty_sold'      => $qtySold,
    'sold_wechat'   => $soldWechat,
    'sold_alipay'   => $soldAlipay,
    'sold_cash'     => $soldCash,
    'cash_opening'  => $cashOpening,
    'cash_closing'  => $cashClosing,
    'unit_price'    => $unitPrice,
    'total_revenue' => $totalRevenue,
], '记录提交成功');
