/**
 * 只读接口的短时缓存封装（按当前门店范围 key）
 * 写操作由 request.js 自动调用 invalidate*，页面不必感知缓存
 */
var request = require('./request');
var apiCache = require('./apiCache');
var auth = require('./auth');
var storeUtil = require('./store');

var TTL_SHIFTS_MS = 120 * 1000;
var TTL_STORE_DETAIL_MS = 120 * 1000;

var PREFIX_SHIFTS = 'shifts';
var PREFIX_STORE_DETAIL = 'storeDetail';

function scopedKey(prefix) {
  var sid = storeUtil.getStoreIdFromUserInfo(auth.getCurrentUserInfo());
  return prefix + ':' + (sid > 0 ? sid : 'anon');
}

/**
 * 获取班次配置列表（2 分钟内命中内存缓存；变更会被 request.js 自动失效）
 * @param {{ force?: boolean }} [options]
 * @returns {Promise<object[]>}
 */
function getShifts(options) {
  var key = scopedKey(PREFIX_SHIFTS);
  if (options && options.force) apiCache.invalidate(key);
  return apiCache.getOrFetch(key, TTL_SHIFTS_MS, function () {
    return request.get('/get_shifts.php', {});
  });
}

/**
 * 获取门店详情（含 recorder_names 等）；同上
 * @param {{ force?: boolean }} [options]
 * @returns {Promise<object>}
 */
function getStoreDetail(options) {
  var key = scopedKey(PREFIX_STORE_DETAIL);
  if (options && options.force) apiCache.invalidate(key);
  return apiCache.getOrFetch(key, TTL_STORE_DETAIL_MS, function () {
    return request.get('/store_detail.php', {});
  });
}

function invalidateShifts() {
  apiCache.invalidatePrefix(PREFIX_SHIFTS + ':');
}

function invalidateStoreDetail() {
  apiCache.invalidatePrefix(PREFIX_STORE_DETAIL + ':');
}

function invalidateAll() {
  apiCache.invalidateAll();
}

module.exports = {
  getShifts: getShifts,
  getStoreDetail: getStoreDetail,
  invalidateShifts: invalidateShifts,
  invalidateStoreDetail: invalidateStoreDetail,
  invalidateAll: invalidateAll,
  TTL_SHIFTS_MS: TTL_SHIFTS_MS,
  TTL_STORE_DETAIL_MS: TTL_STORE_DETAIL_MS
};
