/**
 * 班次记账表单：预估营业额、软校验（与云函数 ITEM_UNIT_PRICE_JPY 一致）
 * 供录入页、班次详情页内联修改共用
 */
var util = require('./util');

var ITEM_UNIT_PRICE_JPY = 3000;

function parseCashInput(str) {
  if (str == null || String(str).trim() === '') {
    return null;
  }
  var n = parseFloat(String(str).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

function buildSoftWarnings(ctx) {
  var qtySold = ctx.qtySold;
  var paymentTotal = ctx.paymentTotal;
  var soldCash = ctx.soldCash;
  var lines = [];

  if (qtySold > 0 || paymentTotal > 0) {
    if (qtySold !== paymentTotal) {
      lines.push(
        '盘点售出 ' +
          qtySold +
          ' 件，支付渠道合计 ' +
          paymentTotal +
          ' 件，二者不一致请核对。'
      );
    }
    if (qtySold > 0 && paymentTotal === 0) {
      lines.push('盘点显示有售出，但微信/支付宝/现金售出件数均为 0，请核对。');
    }
    if (paymentTotal > 0 && qtySold === 0) {
      lines.push('支付渠道有售出件数，但盘点售出为 0（上班−下班−赠送），请核对。');
    }
  }

  var co = parseCashInput(ctx.cashOpening);
  var cc = parseCashInput(ctx.cashClosing);
  if (co !== null && cc !== null) {
    var delta = cc - co;
    if (soldCash > 0 && Math.abs(delta) < 1e-6) {
      lines.push('已填现金售出件数，但上下班现金相同，钱箱是否有变化请核对。');
    }
    if (soldCash === 0 && Math.abs(delta) > 0.005) {
      lines.push('上下班现金有差额，但未登记现金售出件数；若有现金收款请补填。');
    }
  }

  return lines;
}

/**
 * @param {object} d 与录入页 data 相同字段（字符串）
 */
function computeSummary(d) {
  var opening = parseInt(d.qtyOpening, 10) || 0;
  var closing = parseInt(d.qtyClosing, 10) || 0;
  var gift = parseInt(d.qtyGift, 10) || 0;
  var soldInventory = Math.max(0, opening - closing - gift);

  var sw = parseInt(d.soldWechat, 10) || 0;
  var sa = parseInt(d.soldAlipay, 10) || 0;
  var sc = parseInt(d.soldCash, 10) || 0;
  var paymentTotal = Math.max(0, sw + sa + sc);
  var revenue = paymentTotal * ITEM_UNIT_PRICE_JPY;

  var softWarnings = buildSoftWarnings({
    qtySold: soldInventory,
    paymentTotal: paymentTotal,
    soldCash: sc,
    cashOpening: d.cashOpening,
    cashClosing: d.cashClosing
  });

  return {
    qtySold: soldInventory,
    paymentSoldTotal: paymentTotal,
    totalRevenueJpy: util.formatJpy(revenue),
    softWarnings: softWarnings,
    hasSoftWarnings: softWarnings.length > 0
  };
}

function shiftIndexForConfigId(shiftConfigs, shiftConfigId) {
  var list = Array.isArray(shiftConfigs) ? shiftConfigs : [];
  var target =
    shiftConfigId != null && shiftConfigId !== '' ? parseInt(String(shiftConfigId), 10) : NaN;
  if (Number.isNaN(target)) return 0;
  for (var i = 0; i < list.length; i++) {
    var sid = list[i] && list[i].id != null ? parseInt(String(list[i].id), 10) : NaN;
    if (!Number.isNaN(sid) && sid === target) return i;
  }
  return 0;
}

/** 是否能从当前「启用班次」列表中命中记录的 shift_config_id */
function shiftConfigMatched(shiftConfigs, shiftConfigId) {
  var list = Array.isArray(shiftConfigs) ? shiftConfigs : [];
  var ix = shiftIndexForConfigId(list, shiftConfigId);
  var row = list[ix];
  if (!row || row.id == null) return false;
  var a = parseInt(String(row.id), 10);
  var b =
    shiftConfigId != null && shiftConfigId !== '' ? parseInt(String(shiftConfigId), 10) : NaN;
  return !Number.isNaN(a) && !Number.isNaN(b) && a === b;
}

module.exports = {
  ITEM_UNIT_PRICE_JPY: ITEM_UNIT_PRICE_JPY,
  parseCashInput: parseCashInput,
  buildSoftWarnings: buildSoftWarnings,
  computeSummary: computeSummary,
  shiftIndexForConfigId: shiftIndexForConfigId,
  shiftConfigMatched: shiftConfigMatched
};
