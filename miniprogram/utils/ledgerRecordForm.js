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

/**
 * 录入/修改提交前：上班下班数量、上班下班现金均为必填
 * @param {object} d 与录入页 data 相同字段（字符串）
 * @returns {{ ok: boolean, message: string }}
 */
function validateRequiredQtyAndCash(d) {
  var qo = String(d.qtyOpening == null ? '' : d.qtyOpening).trim();
  var qc = String(d.qtyClosing == null ? '' : d.qtyClosing).trim();
  if (qo === '') {
    return { ok: false, message: '请填写上班数量' };
  }
  if (qc === '') {
    return { ok: false, message: '请填写下班数量' };
  }
  if (!/^\d+$/.test(qo)) {
    return { ok: false, message: '上班数量须为非负整数' };
  }
  if (!/^\d+$/.test(qc)) {
    return { ok: false, message: '下班数量须为非负整数' };
  }
  var io = parseInt(qo, 10);
  var ic = parseInt(qc, 10);
  if (!Number.isFinite(io) || io < 0) {
    return { ok: false, message: '上班数量须为非负整数' };
  }
  if (!Number.isFinite(ic) || ic < 0) {
    return { ok: false, message: '下班数量须为非负整数' };
  }

  var co = parseCashInput(d.cashOpening);
  var cc = parseCashInput(d.cashClosing);
  if (co === null) {
    return { ok: false, message: '请填写上班现金' };
  }
  if (cc === null) {
    return { ok: false, message: '请填写下班现金' };
  }
  return { ok: true, message: '' };
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
 * 支付渠道件数占比（用于横向堆叠条，百分比之和为 100）
 */
function computePaymentMixPct(sw, sa, sc) {
  var w = parseInt(sw, 10) || 0;
  var a = parseInt(sa, 10) || 0;
  var c = parseInt(sc, 10) || 0;
  var t = w + a + c;
  if (t <= 0) {
    return {
      showPaymentMix: false,
      payMixSw: w,
      payMixSa: a,
      payMixSc: c,
      payPctW: 0,
      payPctA: 0,
      payPctC: 0
    };
  }
  var pw = Math.round((w * 1000) / t) / 10;
  var pa = Math.round((a * 1000) / t) / 10;
  var pc = Math.round((100 - pw - pa) * 10) / 10;
  return {
    showPaymentMix: true,
    payMixSw: w,
    payMixSa: a,
    payMixSc: c,
    payPctW: pw,
    payPctA: pa,
    payPctC: pc
  };
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

  var mix = computePaymentMixPct(sw, sa, sc);

  return {
    qtySold: soldInventory,
    paymentSoldTotal: paymentTotal,
    totalRevenueJpy: util.formatJpy(revenue),
    softWarnings: softWarnings,
    hasSoftWarnings: softWarnings.length > 0,
    showPaymentMix: mix.showPaymentMix,
    payMixSw: mix.payMixSw,
    payMixSa: mix.payMixSa,
    payMixSc: mix.payMixSc,
    payPctW: mix.payPctW,
    payPctA: mix.payPctA,
    payPctC: mix.payPctC
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
  validateRequiredQtyAndCash: validateRequiredQtyAndCash,
  buildSoftWarnings: buildSoftWarnings,
  computePaymentMixPct: computePaymentMixPct,
  computeSummary: computeSummary,
  shiftIndexForConfigId: shiftIndexForConfigId,
  shiftConfigMatched: shiftConfigMatched
};
