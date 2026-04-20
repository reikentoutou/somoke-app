/**
 * 通用 TTL 内存缓存（小程序进程内，冷启动即清空）
 * - getOrFetch(key, ttlMs, fetcher)：未命中/过期则调 fetcher，成功后入缓存
 * - 并发去重：同一 key 正在发起时，后续调用共享同一 Promise，避免并发重复请求
 * - invalidate / invalidatePrefix / invalidateAll：写操作后由上层调用清理
 *
 * 注意：不持久化；只能用于「重复请求同一只读接口」的短周期降频，不作为数据源。
 */

var entries = new Map();
var inflight = new Map();

function now() {
  return Date.now();
}

function peek(key) {
  var entry = entries.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now()) {
    entries.delete(key);
    return null;
  }
  return entry;
}

function set(key, value, ttlMs) {
  entries.set(key, { value: value, expiresAt: now() + (ttlMs > 0 ? ttlMs : 0) });
}

function invalidate(key) {
  entries.delete(key);
  inflight.delete(key);
}

function invalidatePrefix(prefix) {
  var toDelete = [];
  entries.forEach(function (_, k) {
    if (typeof k === 'string' && k.indexOf(prefix) === 0) toDelete.push(k);
  });
  toDelete.forEach(function (k) { entries.delete(k); });

  var inflightToDelete = [];
  inflight.forEach(function (_, k) {
    if (typeof k === 'string' && k.indexOf(prefix) === 0) inflightToDelete.push(k);
  });
  inflightToDelete.forEach(function (k) { inflight.delete(k); });
}

function invalidateAll() {
  entries.clear();
  inflight.clear();
}

/**
 * @param {string} key
 * @param {number} ttlMs
 * @param {() => Promise<any>} fetcher
 */
function getOrFetch(key, ttlMs, fetcher) {
  var hit = peek(key);
  if (hit) return Promise.resolve(hit.value);

  var pending = inflight.get(key);
  if (pending) return pending;

  var p = Promise.resolve()
    .then(fetcher)
    .then(function (value) {
      set(key, value, ttlMs);
      inflight.delete(key);
      return value;
    })
    .catch(function (err) {
      inflight.delete(key);
      throw err;
    });

  inflight.set(key, p);
  return p;
}

module.exports = {
  peek: peek,
  set: set,
  invalidate: invalidate,
  invalidatePrefix: invalidatePrefix,
  invalidateAll: invalidateAll,
  getOrFetch: getOrFetch
};
