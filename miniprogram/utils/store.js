/**
 * 门店与会话（与后端约定一致）
 * - 权限真理源：store_members（user_info.stores）；勿依赖 users.store_id / users.role 做权限展示
 * - 当前门店：users.current_store_id，须通过 store_switch.php 更新后服务端才认；勿仅改本地缓存
 */

function normalizeStores(u) {
  if (!u || typeof u !== 'object') return [];
  var raw = u.stores;
  if (!Array.isArray(raw)) return [];
  return raw.map(function (row) {
    return {
      store_id: parseInt(row.store_id, 10),
      name: row.name || '',
      role: parseInt(row.role, 10)
    };
  }).filter(function (s) {
    return !Number.isNaN(s.store_id) && s.store_id > 0;
  });
}

function storeListContains(stores, storeId) {
  var sid = parseInt(storeId, 10);
  if (Number.isNaN(sid) || sid <= 0) return false;
  for (var i = 0; i < stores.length; i++) {
    if (stores[i].store_id === sid) return true;
  }
  return false;
}

function getRoleForStoreId(stores, storeId) {
  var sid = parseInt(storeId, 10);
  if (Number.isNaN(sid) || sid <= 0) return null;
  for (var i = 0; i < stores.length; i++) {
    if (stores[i].store_id === sid) {
      var r = stores[i].role;
      return Number.isNaN(r) ? null : r;
    }
  }
  return null;
}

/**
 * 当前应使用的门店 ID：须在 store_members 中；多店且未选有效店时返回 0
 */
function getStoreIdFromUserInfo(u) {
  if (!u || typeof u !== 'object') return 0;
  var stores = normalizeStores(u);
  if (stores.length === 0) return 0;

  var cur =
    u.current_store_id != null && u.current_store_id !== ''
      ? parseInt(u.current_store_id, 10)
      : 0;
  if (!Number.isNaN(cur) && cur > 0 && storeListContains(stores, cur)) {
    return cur;
  }

  var compat =
    u.store_id != null && u.store_id !== '' ? parseInt(u.store_id, 10) : 0;
  if (!Number.isNaN(compat) && compat > 0 && storeListContains(stores, compat)) {
    return compat;
  }

  if (stores.length === 1) {
    return stores[0].store_id;
  }

  return 0;
}

/**
 * 当前店内角色：1 管理员 2 员工；来自 stores 列表，非 users.role
 */
function getRoleInCurrentStore(u) {
  var sid = getStoreIdFromUserInfo(u);
  if (sid <= 0) return null;
  var role = getRoleForStoreId(normalizeStores(u), sid);
  if (role != null) return role;
  var legacy = u.role != null ? parseInt(u.role, 10) : NaN;
  return Number.isNaN(legacy) ? null : legacy;
}

function isBossInCurrentStore(u) {
  return getRoleInCurrentStore(u) === 1;
}

function loginPayloadNeedsOnboarding(data) {
  if (!data) return true;
  if (data.needs_onboarding === true) return true;
  var stores = normalizeStores(data.user_info || {});
  return stores.length === 0;
}

function loginPayloadNeedsStoreSelection(data) {
  if (!data) return false;
  if (data.needs_store_selection === true) return true;
  var u = data.user_info || {};
  var stores = normalizeStores(u);
  if (stores.length <= 1) return false;
  return getStoreIdFromUserInfo(u) <= 0;
}

function persistSession(app, loginData) {
  var u = loginData.user_info || {};
  app.globalData.token = loginData.token;
  app.globalData.userInfo = u;
  wx.setStorageSync('token', loginData.token);
  wx.setStorageSync('userInfo', u);

  var needOnboard = loginPayloadNeedsOnboarding(loginData);
  var needSelect = loginPayloadNeedsStoreSelection(loginData);
  wx.setStorageSync('needsOnboarding', needOnboard);
  wx.setStorageSync('needsStoreSelection', needSelect);

  if (needOnboard || needSelect) {
    app.globalData.currentStoreId = 0;
    wx.setStorageSync('currentStoreId', 0);
  } else {
    var sid = getStoreIdFromUserInfo(u);
    app.globalData.currentStoreId = sid;
    wx.setStorageSync('currentStoreId', sid);
  }
}

function hydrateStoreFromStorage(app) {
  if (wx.getStorageSync('needsStoreSelection') === true || wx.getStorageSync('needsStoreSelection') === 'true') {
    app.globalData.currentStoreId = 0;
    return;
  }
  var u = app.globalData.userInfo || wx.getStorageSync('userInfo');
  var sid = getStoreIdFromUserInfo(u || {});
  app.globalData.currentStoreId = sid;
  if (sid > 0) {
    wx.setStorageSync('currentStoreId', sid);
  }
}

function sessionNeedsOnboarding() {
  if (wx.getStorageSync('needsOnboarding') === true || wx.getStorageSync('needsOnboarding') === 'true') {
    return true;
  }
  var u = wx.getStorageSync('userInfo');
  var app = getApp();
  if (!u && app && app.globalData && app.globalData.userInfo) {
    u = app.globalData.userInfo;
  }
  return normalizeStores(u || {}).length === 0;
}

function sessionNeedsStoreSelection() {
  if (wx.getStorageSync('needsStoreSelection') === true || wx.getStorageSync('needsStoreSelection') === 'true') {
    return true;
  }
  var u = wx.getStorageSync('userInfo');
  var app = getApp();
  if (!u && app && app.globalData && app.globalData.userInfo) {
    u = app.globalData.userInfo;
  }
  u = u || {};
  var stores = normalizeStores(u);
  if (stores.length <= 1) return false;
  return getStoreIdFromUserInfo(u) <= 0;
}

function applyUserInfoPatch(app, userInfo) {
  app.globalData.userInfo = userInfo;
  var sid = getStoreIdFromUserInfo(userInfo);
  var stores = normalizeStores(userInfo);
  app.globalData.currentStoreId = sid;
  wx.setStorageSync('userInfo', userInfo);
  wx.setStorageSync('currentStoreId', sid);
  wx.setStorageSync('needsOnboarding', stores.length === 0);
  wx.setStorageSync('needsStoreSelection', stores.length > 1 && sid <= 0);
}

/**
 * store_create.php 成功：data.store
 */
function applyStoreCreateSuccess(app, data) {
  var st = data && data.store;
  if (!st || st.id == null) return null;
  var id = parseInt(st.id, 10);
  if (Number.isNaN(id) || id <= 0) return null;
  var base = app.globalData.userInfo || wx.getStorageSync('userInfo') || {};
  var stores = normalizeStores(base);
  var found = false;
  for (var i = 0; i < stores.length; i++) {
    if (stores[i].store_id === id) {
      stores[i].name = st.name || stores[i].name;
      stores[i].role = 1;
      found = true;
      break;
    }
  }
  if (!found) {
    stores.push({ store_id: id, name: st.name || '', role: 1 });
  }
  var merged = Object.assign({}, base, {
    current_store_id: id,
    store_id: id,
    role: 1,
    stores: stores,
    store_count: stores.length
  });
  applyUserInfoPatch(app, merged);
  wx.setStorageSync('needsStoreSelection', false);
  return merged;
}

/**
 * store_join.php 成功：store_id, store_name, role
 */
function applyStoreJoinSuccess(app, data) {
  if (!data || data.store_id == null) return null;
  var id = parseInt(data.store_id, 10);
  if (Number.isNaN(id) || id <= 0) return null;
  var role = data.role != null ? parseInt(data.role, 10) : 2;
  var base = app.globalData.userInfo || wx.getStorageSync('userInfo') || {};
  var stores = normalizeStores(base);
  var name = data.store_name || '';
  var exists = false;
  for (var j = 0; j < stores.length; j++) {
    if (stores[j].store_id === id) {
      stores[j].name = name || stores[j].name;
      stores[j].role = role;
      exists = true;
      break;
    }
  }
  if (!exists) {
    stores.push({ store_id: id, name: name, role: role });
  }
  var merged = Object.assign({}, base, {
    current_store_id: id,
    store_id: id,
    role: role,
    stores: stores,
    store_count: stores.length
  });
  applyUserInfoPatch(app, merged);
  wx.setStorageSync('needsStoreSelection', false);
  return merged;
}

/**
 * store_switch.php 成功：current_store_id
 */
/**
 * 用 get_stores 返回的列表刷新本地 userInfo.stores（不改变当前门店，除非列表中已无当前店）
 */
function applyStoresListRefreshed(app, apiStores, currentStoreIdOpt) {
  var base = app.globalData.userInfo || wx.getStorageSync('userInfo') || {};
  var stores = (apiStores || [])
    .map(function (s) {
      var rid = parseInt(s.role, 10);
      return {
        store_id: parseInt(s.store_id, 10),
        name: (s && s.name) || '',
        role: Number.isNaN(rid) ? 2 : rid
      };
    })
    .filter(function (s) {
      return !Number.isNaN(s.store_id) && s.store_id > 0;
    });
  var merged = Object.assign({}, base, { stores: stores, store_count: stores.length });
  if (currentStoreIdOpt !== undefined && currentStoreIdOpt !== null) {
    var cs = parseInt(currentStoreIdOpt, 10);
    if (!Number.isNaN(cs) && cs > 0) {
      merged.current_store_id = cs;
      merged.store_id = cs;
    } else {
      merged.current_store_id = null;
      merged.store_id = null;
    }
  }
  applyUserInfoPatch(app, merged);
  return merged;
}

function applyStoreSwitchSuccess(app, data) {
  if (!data || data.current_store_id == null) return null;
  var sid = parseInt(data.current_store_id, 10);
  if (Number.isNaN(sid) || sid <= 0) return null;
  var base = app.globalData.userInfo || wx.getStorageSync('userInfo') || {};
  var stores = normalizeStores(base);
  var role = getRoleForStoreId(stores, sid);
  if (role == null) {
    role = base.role != null ? parseInt(base.role, 10) : 2;
  }
  var merged = Object.assign({}, base, {
    current_store_id: sid,
    store_id: sid,
    role: role
  });
  applyUserInfoPatch(app, merged);
  wx.setStorageSync('needsStoreSelection', false);
  return merged;
}

function mergeUserInfoFromApiResponse(app, data) {
  var base = app.globalData.userInfo || wx.getStorageSync('userInfo') || {};
  var patch = data && data.user_info ? data.user_info : data;
  if (!patch || typeof patch !== 'object') return null;
  var merged = Object.assign({}, base, patch);
  if (data && data.store_id != null && merged.current_store_id == null) {
    merged.current_store_id = data.store_id;
  }
  if (merged.stores == null && Array.isArray(base.stores)) {
    merged.stores = base.stores;
  }
  if (merged.store_count == null && merged.stores) {
    merged.store_count = merged.stores.length;
  }
  if (merged.store_id == null && merged.current_store_id != null) {
    merged.store_id = merged.current_store_id;
  }
  applyUserInfoPatch(app, merged);
  return merged;
}

function clearStoreSession() {
  wx.removeStorageSync('currentStoreId');
  wx.removeStorageSync('needsOnboarding');
  wx.removeStorageSync('needsStoreSelection');
  var app = getApp();
  if (app && app.globalData) {
    app.globalData.currentStoreId = 0;
  }
}

function currentStoreDisplayName(u) {
  var sid = getStoreIdFromUserInfo(u || {});
  if (sid <= 0) return '';
  var stores = normalizeStores(u || {});
  for (var i = 0; i < stores.length; i++) {
    if (stores[i].store_id === sid) return stores[i].name || ('门店 #' + sid);
  }
  return '';
}

module.exports = {
  normalizeStores: normalizeStores,
  getStoreIdFromUserInfo: getStoreIdFromUserInfo,
  getRoleInCurrentStore: getRoleInCurrentStore,
  isBossInCurrentStore: isBossInCurrentStore,
  loginPayloadNeedsOnboarding: loginPayloadNeedsOnboarding,
  loginPayloadNeedsStoreSelection: loginPayloadNeedsStoreSelection,
  persistSession: persistSession,
  hydrateStoreFromStorage: hydrateStoreFromStorage,
  sessionNeedsOnboarding: sessionNeedsOnboarding,
  sessionNeedsStoreSelection: sessionNeedsStoreSelection,
  applyUserInfoPatch: applyUserInfoPatch,
  applyStoreCreateSuccess: applyStoreCreateSuccess,
  applyStoreJoinSuccess: applyStoreJoinSuccess,
  applyStoresListRefreshed: applyStoresListRefreshed,
  applyStoreSwitchSuccess: applyStoreSwitchSuccess,
  mergeUserInfoFromApiResponse: mergeUserInfoFromApiResponse,
  clearStoreSession: clearStoreSession,
  currentStoreDisplayName: currentStoreDisplayName
};
