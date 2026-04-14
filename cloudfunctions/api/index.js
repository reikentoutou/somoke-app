/**
 * 统一云函数：替代原 PHP API，数据存微信云开发文档数据库。
 * 小程序通过 wx.cloud.callFunction({ name: 'api', data: { action, ... } })
 */
const cloud = require('wx-server-sdk');
const crypto = require('crypto');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const db = cloud.database();
const _ = db.command;

const TOKEN_EXPIRE_SECONDS = 7 * 24 * 3600;

/** 单品标价（円）：各支付方式按件数计，营业额 = 此单价 ×（微信+支付宝+现金）件数；赠送不计入件数 */
const ITEM_UNIT_PRICE_JPY = 3000;

function stockDeductFromQtys(qtyOpening, qtyClosing, qtyGift, soldWechat, soldAlipay, soldCash) {
  var qtySold = (parseInt(qtyOpening, 10) || 0) - (parseInt(qtyClosing, 10) || 0) - (parseInt(qtyGift, 10) || 0);
  if (qtySold < 0) qtySold = 0;
  var paymentQty =
    (parseInt(soldWechat, 10) || 0) + (parseInt(soldAlipay, 10) || 0) + (parseInt(soldCash, 10) || 0);
  if (paymentQty < 0) paymentQty = 0;
  var stockBase = Math.max(qtySold, paymentQty);
  var stockDeduct = stockBase + (parseInt(qtyGift, 10) || 0);
  if (stockDeduct < 0) stockDeduct = 0;
  return stockDeduct;
}

function ok(data, msg) {
  return { code: 200, msg: msg || 'success', data: data != null ? data : null };
}
function fail(code, msg) {
  return { code: code || 400, msg: msg || 'error', data: null };
}

/** 文档不存在时 doc().get() 可能抛错而非返回空 data，需统一按「无文档」处理 */
function isDocNotFoundErr(err) {
  if (!err) return false;
  var msg = String(err.errMsg || err.message || '');
  if (msg.indexOf('does not exist') !== -1) return true;
  if (msg.indexOf('不存在') !== -1) return true;
  return false;
}

/** 解析时间：支持 HH:mm、HH:mm:ss → 统一为 HH:mm:ss */
function normalizeTimeStr(raw) {
  var s = String(raw || '').trim();
  if (!s) return null;
  var m = s.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m) return null;
  var h = parseInt(m[1], 10);
  var min = parseInt(m[2], 10);
  var sec = m[3] !== undefined && m[3] !== '' ? parseInt(m[3], 10) : 0;
  if (Number.isNaN(h) || Number.isNaN(min) || Number.isNaN(sec)) return null;
  if (h < 0 || h > 23 || min < 0 || min > 59 || sec < 0 || sec > 59) return null;
  var pad = function (n) {
    return n < 10 ? '0' + n : '' + n;
  };
  return pad(h) + ':' + pad(min) + ':' + pad(sec);
}

function formatDateTime(d) {
  const pad = function (n) {
    return n < 10 ? '0' + n : '' + n;
  };
  return (
    d.getFullYear() +
    '-' +
    pad(d.getMonth() + 1) +
    '-' +
    pad(d.getDate()) +
    ' ' +
    pad(d.getHours()) +
    ':' +
    pad(d.getMinutes()) +
    ':' +
    pad(d.getSeconds())
  );
}

async function nextSeq(name) {
  return db.runTransaction(async function (transaction) {
    var coll = transaction.collection('counters');
    var dref = coll.doc(name);
    var snap;
    try {
      snap = await dref.get();
    } catch (e) {
      if (!isDocNotFoundErr(e)) throw e;
      snap = { data: null };
    }
    var cur = snap.data && snap.data.seq != null ? snap.data.seq : 0;
    var next = cur + 1;
    if (snap.data) {
      await dref.update({ data: { seq: next } });
    } else {
      await dref.set({ data: { seq: next } });
    }
    return next;
  });
}

async function getUserDoc(openid) {
  if (!openid) return null;
  try {
    var r = await db.collection('users').doc(openid).get();
    return r.data || null;
  } catch (e) {
    if (isDocNotFoundErr(e)) return null;
    throw e;
  }
}

async function requireUser(openid) {
  var u = await getUserDoc(openid);
  if (!u || u.is_active === 0) {
    return null;
  }
  return u;
}

async function fetchUserStores(userId) {
  var r = await db
    .collection('store_members')
    .where({ user_id: userId, is_active: 1 })
    .get();
  var list = [];
  for (var i = 0; i < r.data.length; i++) {
    var sm = r.data[i];
    var s = await db.collection('stores').where({ id: sm.store_id }).limit(1).get();
    var name = s.data[0] ? s.data[0].name : '';
    list.push({ store_id: sm.store_id, name: name, role: sm.role });
  }
  list.sort(function (a, b) {
    return a.store_id - b.store_id;
  });
  return list;
}

async function requireStoreMembership(userId, storeId) {
  var r = await db
    .collection('store_members')
    .where({ user_id: userId, store_id: storeId, is_active: 1 })
    .limit(1)
    .get();
  if (!r.data.length) return null;
  return r.data[0].role;
}

async function requireActiveStoreId(openid, userDoc) {
  var userId = userDoc.userId;
  var stores = await fetchUserStores(userId);
  if (!stores.length) {
    return { err: fail(403, '请先创建或加入门店') };
  }
  var allowed = {};
  for (var i = 0; i < stores.length; i++) {
    allowed[stores[i].store_id] = true;
  }
  var cur =
    userDoc.current_store_id != null && userDoc.current_store_id !== ''
      ? parseInt(userDoc.current_store_id, 10)
      : 0;
  if (cur > 0 && allowed[cur]) {
    return { storeId: cur };
  }
  if (stores.length === 1) {
    var onlyId = stores[0].store_id;
    await db.collection('users').doc(openid).update({
      data: { current_store_id: onlyId, updated_at: db.serverDate() },
    });
    return { storeId: onlyId };
  }
  return { err: fail(403, '请选择当前门店') };
}

async function buildLoginPayload(openid, userDoc, nickname, avatarUrl) {
  var stores = await fetchUserStores(userDoc.userId);
  var storeCount = stores.length;
  var curRaw = userDoc.current_store_id;
  var curId = curRaw != null && curRaw !== '' ? parseInt(curRaw, 10) : 0;
  var curValid = false;
  var roleInStore = null;
  for (var i = 0; i < stores.length; i++) {
    if (stores[i].store_id === curId) {
      curValid = true;
      roleInStore = stores[i].role;
      break;
    }
  }
  var needsOnboarding = storeCount === 0;
  var needsStoreSelection = storeCount > 1 && !curValid;
  var compatStoreId = null;
  if (curValid) {
    compatStoreId = curId;
  } else if (storeCount === 1) {
    compatStoreId = stores[0].store_id;
    roleInStore = stores[0].role;
  }
  var token = crypto.randomBytes(32).toString('hex');
  var expireAt = new Date(Date.now() + TOKEN_EXPIRE_SECONDS * 1000);
  await db
    .collection('users')
    .doc(openid)
    .update({
      data: {
        session_token: token,
        token_expire_at: expireAt,
        updated_at: db.serverDate(),
      },
    });
  var currentStoreOut = curRaw != null && curRaw !== '' ? parseInt(curRaw, 10) : null;
  return ok(
    {
      token: token,
      expire_at: formatDateTime(expireAt),
      needs_onboarding: needsOnboarding,
      needs_store_selection: needsStoreSelection,
      user_info: {
        id: userDoc.userId,
        nickname: userDoc.nickname || '',
        avatar_url: userDoc.avatar_url || '',
        current_store_id: currentStoreOut,
        store_id: compatStoreId,
        role: roleInStore != null ? roleInStore : userDoc.role || 2,
        stores: stores,
        store_count: storeCount,
      },
    },
    '登录成功'
  );
}

async function handleLogin(openid, payload) {
  if (!openid) return fail(401, '无法获取微信身份，请从小程序端调用');
  var nickname = payload.nickname ? String(payload.nickname).trim() : '';
  var avatarUrl = payload.avatar_url ? String(payload.avatar_url).trim() : '';
  var ref = db.collection('users').doc(openid);
  var userDoc = await getUserDoc(openid);
  if (!userDoc) {
    var userId = await nextSeq('user');
    await ref.set({
      data: {
        userId: userId,
        nickname: nickname,
        avatar_url: avatarUrl,
        role: 2,
        current_store_id: null,
        is_active: 1,
        session_token: '',
        created_at: db.serverDate(),
        updated_at: db.serverDate(),
      },
    });
    userDoc = (await ref.get()).data;
  } else {
    var patch = {};
    if (nickname) patch.nickname = nickname;
    if (avatarUrl) patch.avatar_url = avatarUrl;
    if (Object.keys(patch).length) {
      patch.updated_at = db.serverDate();
      await ref.update({ data: patch });
      userDoc = (await ref.get()).data;
    }
  }
  return buildLoginPayload(openid, userDoc, nickname, avatarUrl);
}

async function handleGetStores(openid) {
  var u = await requireUser(openid);
  if (!u) return fail(401, '未登录或用户无效');
  var stores = await fetchUserStores(u.userId);
  var curRaw = u.current_store_id;
  var cur = curRaw != null && curRaw !== '' ? parseInt(curRaw, 10) : 0;
  if (Number.isNaN(cur) || cur < 0) cur = 0;
  return ok({ stores: stores, current_store_id: cur }, 'success');
}

async function handleStoreCreate(openid, payload) {
  var u = await requireUser(openid);
  if (!u) return fail(401, '未登录或用户无效');
  var name = payload.name ? String(payload.name).trim() : '';
  if (!name) return fail(400, '请填写门店名称');
  if (name.length > 64) return fail(400, '门店名称过长');
  var address = payload.address ? String(payload.address).trim() : '';
  var unitPrice = payload.unit_price != null ? parseFloat(payload.unit_price) : 0;
  var currency = payload.currency ? String(payload.currency).trim() : 'CNY';
  if (address.length > 256) return fail(400, '地址过长');
  if (unitPrice < 0) return fail(400, '单价不能为负数');
  if (currency.length > 8) return fail(400, '货币代码过长');

  var storeId = await nextSeq('store');
  var initRecorderNames = [];
  if (u.nickname && String(u.nickname).trim()) {
    initRecorderNames.push(String(u.nickname).trim());
  }
  await db.collection('stores').add({
    data: {
      id: storeId,
      name: name,
      address: address,
      unit_price: unitPrice,
      current_stock: 0,
      currency: currency,
      recorder_names: initRecorderNames,
      is_active: 1,
      created_at: db.serverDate(),
      updated_at: db.serverDate(),
    },
  });
  await db
    .collection('store_members')
    .doc('sm_' + storeId + '_' + u.userId)
    .set({
      data: {
        store_id: storeId,
        user_id: u.userId,
        role: 1,
        is_active: 1,
        created_at: db.serverDate(),
      },
    });
  await db.collection('users').doc(openid).update({
    data: { current_store_id: storeId, updated_at: db.serverDate() },
  });

  var defaults = [
    { name: '早班', start: '07:00:00', end: '13:00:00', icon: 'wb_sunny', ord: 1 },
    { name: '白1', start: '13:00:00', end: '18:00:00', icon: 'light_mode', ord: 2 },
    { name: '白2', start: '18:00:00', end: '23:00:00', icon: 'routine', ord: 3 },
    { name: '夜班', start: '23:00:00', end: '07:00:00', icon: 'dark_mode', ord: 4 },
  ];
  for (var d = 0; d < defaults.length; d++) {
    var scId = await nextSeq('shift_config');
    await db.collection('shift_configs').add({
      data: {
        id: scId,
        store_id: storeId,
        name: defaults[d].name,
        start_time: defaults[d].start,
        end_time: defaults[d].end,
        icon: defaults[d].icon,
        sort_order: defaults[d].ord,
        is_active: 1,
        created_at: db.serverDate(),
      },
    });
  }

  var row = {
    id: storeId,
    name: name,
    address: address,
    unit_price: unitPrice,
    current_stock: 0,
    currency: currency,
    is_active: 1,
    created_at: formatDateTime(new Date()),
    updated_at: formatDateTime(new Date()),
  };
  return ok({ store: row }, '门店创建成功');
}

async function handleStoreSwitch(openid, payload) {
  var u = await requireUser(openid);
  if (!u) return fail(401, '未登录或用户无效');
  var storeId = parseInt(payload.store_id, 10);
  if (!storeId || storeId <= 0) return fail(400, '请指定门店 store_id');
  var role = await requireStoreMembership(u.userId, storeId);
  if (role == null) return fail(403, '无权操作该门店');
  await db.collection('users').doc(openid).update({
    data: { current_store_id: storeId, updated_at: db.serverDate() },
  });
  return ok({ current_store_id: storeId }, '已切换当前门店');
}

async function handleStoreJoin(openid, payload) {
  var u = await requireUser(openid);
  if (!u) return fail(401, '未登录或用户无效');
  var code = payload.code ? String(payload.code).trim() : '';
  if (!code) return fail(400, '请填写邀请码');
  var normalized = code.toUpperCase();
  if (normalized.length > 32) return fail(400, '邀请码格式不正确');
  var codeHash = crypto.createHash('sha256').update(normalized).digest('hex');

  var invQ = await db.collection('store_invites').where({ code_hash: codeHash }).limit(1).get();
  if (!invQ.data.length) return fail(400, '邀请码无效');
  var inv = invQ.data[0];
  var inviteDocId = inv._id;
  var storeId = inv.store_id;
  var expires = inv.expires_at;
  var maxUses = inv.max_uses;
  var used = inv.used_count || 0;
  var expMs = expires instanceof Date ? expires.getTime() : new Date(expires).getTime();
  if (expMs < Date.now()) return fail(400, '邀请码已过期');
  if (used >= maxUses) return fail(400, '邀请码已达使用上限');

  var exist = await db
    .collection('store_members')
    .where({ store_id: storeId, user_id: u.userId })
    .limit(1)
    .get();
  if (exist.data.length) return fail(400, '您已是该门店成员');

  await db
    .collection('store_members')
    .doc('sm_' + storeId + '_' + u.userId)
    .set({
      data: {
        store_id: storeId,
        user_id: u.userId,
        role: 2,
        is_active: 1,
        created_at: db.serverDate(),
      },
    });
  var newUsed = used + 1;
  if (newUsed > maxUses) {
    return fail(409, '邀请码已失效，请重新获取');
  }
  await db.collection('store_invites').doc(inviteDocId).update({
    data: { used_count: _.inc(1) },
  });
  await db.collection('users').doc(openid).update({
    data: { current_store_id: storeId, updated_at: db.serverDate() },
  });

  var st = await db.collection('stores').where({ id: storeId }).limit(1).get();
  var storeName = st.data[0] ? st.data[0].name : '';
  return ok({ store_id: storeId, store_name: storeName, role: 2 }, '加入门店成功');
}

async function handleStoreInviteCreate(openid, payload) {
  var u = await requireUser(openid);
  if (!u) return fail(401, '未登录或用户无效');
  var storeId = parseInt(payload.store_id, 10);
  if (!storeId || storeId <= 0) return fail(400, '请指定门店 store_id');
  var role = await requireStoreMembership(u.userId, storeId);
  if (role == null) return fail(403, '无权操作该门店');
  if (role !== 1) return fail(403, '仅门店老板可执行此操作');
  var maxUses = payload.max_uses != null ? parseInt(payload.max_uses, 10) : 1;
  if (maxUses < 1) return fail(400, 'max_uses 至少为 1');
  var expireDays = payload.expire_days != null ? parseInt(payload.expire_days, 10) : 7;
  if (expireDays < 1 || expireDays > 365) return fail(400, 'expire_days 须在 1～365 之间');

  var charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  var expiresAt = new Date(Date.now() + expireDays * 86400000);
  var plainCode = null;
  var inviteId = null;
  for (var attempt = 0; attempt < 8; attempt++) {
    var c = '';
    for (var i = 0; i < 8; i++) {
      c += charset[Math.floor(Math.random() * charset.length)];
    }
    var hash = crypto.createHash('sha256').update(c).digest('hex');
    var dup = await db.collection('store_invites').where({ code_hash: hash }).limit(1).get();
    if (dup.data.length) continue;
    inviteId = await nextSeq('invite');
    await db.collection('store_invites').add({
      data: {
        id: inviteId,
        store_id: storeId,
        code_hash: hash,
        expires_at: expiresAt,
        max_uses: maxUses,
        used_count: 0,
        created_by_user_id: u.userId,
        created_at: db.serverDate(),
      },
    });
    plainCode = c;
    break;
  }
  if (!plainCode) return fail(500, '生成邀请码失败，请重试');
  return ok(
    {
      invite_id: inviteId,
      store_id: storeId,
      code: plainCode,
      expires_at: formatDateTime(expiresAt),
      max_uses: maxUses,
      used_count: 0,
    },
    '邀请码已生成（请妥善保管，仅显示一次）'
  );
}

async function handleGetShifts(openid) {
  var u = await requireUser(openid);
  if (!u) return fail(401, '未登录或用户无效');
  var ctx = await requireActiveStoreId(openid, u);
  if (ctx.err) return ctx.err;
  var storeId = ctx.storeId;
  var r = await db
    .collection('shift_configs')
    .where({ store_id: storeId, is_active: 1 })
    .get();
  var rows = r.data.slice().sort(function (a, b) {
    return (a.sort_order || 0) - (b.sort_order || 0);
  });
  var out = rows.map(function (row) {
    return {
      id: row.id,
      name: row.name,
      start_time: row.start_time,
      end_time: row.end_time,
      icon: row.icon,
      sort_order: row.sort_order,
    };
  });
  return ok(out, 'success');
}

async function handleShiftConfigSave(openid, payload) {
  var u = await requireUser(openid);
  if (!u) return fail(401, '未登录或用户无效');
  var ctx = await requireActiveStoreId(openid, u);
  if (ctx.err) return ctx.err;
  var storeId = ctx.storeId;
  var role = await requireStoreMembership(u.userId, storeId);
  if (role !== 1) return fail(403, '仅门店老板可管理班次');

  var name = payload.name != null ? String(payload.name).trim() : '';
  if (!name) return fail(400, '请填写班次名称');
  if (name.length > 32) return fail(400, '班次名称不能超过 32 个字');

  var startTime = normalizeTimeStr(payload.start_time);
  var endTime = normalizeTimeStr(payload.end_time);
  if (!startTime || !endTime) {
    return fail(400, '请填写合法的上班、下班时间（如 07:00 或 07:00:00）');
  }

  var icon = payload.icon != null ? String(payload.icon).trim() : 'schedule';
  if (!icon || icon.length > 32) icon = 'schedule';
  var sortOrder = parseInt(payload.sort_order, 10);
  if (Number.isNaN(sortOrder) || sortOrder < 0) sortOrder = 99;

  var existingId = payload.id != null ? parseInt(payload.id, 10) : 0;

  if (existingId > 0) {
    var q = await db
      .collection('shift_configs')
      .where({ id: existingId, store_id: storeId })
      .limit(1)
      .get();
    if (!q.data.length) return fail(404, '班次不存在');
    var docId = q.data[0]._id;
    await db.collection('shift_configs').doc(docId).update({
      data: {
        name: name,
        start_time: startTime,
        end_time: endTime,
        icon: icon,
        sort_order: sortOrder,
        updated_at: db.serverDate(),
      },
    });
    return ok(
      {
        id: existingId,
        name: name,
        start_time: startTime,
        end_time: endTime,
        icon: icon,
        sort_order: sortOrder,
      },
      '已更新'
    );
  }

  var activeList = await db
    .collection('shift_configs')
    .where({ store_id: storeId, is_active: 1 })
    .get();
  if (activeList.data.length >= 30) {
    return fail(400, '启用中的班次已达上限（30），请先停用或删除后再加');
  }

  var newId = await nextSeq('shift_config');
  await db.collection('shift_configs').add({
    data: {
      id: newId,
      store_id: storeId,
      name: name,
      start_time: startTime,
      end_time: endTime,
      icon: icon,
      sort_order: sortOrder,
      is_active: 1,
      created_at: db.serverDate(),
      updated_at: db.serverDate(),
    },
  });
  return ok(
    {
      id: newId,
      name: name,
      start_time: startTime,
      end_time: endTime,
      icon: icon,
      sort_order: sortOrder,
    },
    '已添加'
  );
}

async function handleShiftConfigDelete(openid, payload) {
  var u = await requireUser(openid);
  if (!u) return fail(401, '未登录或用户无效');
  var ctx = await requireActiveStoreId(openid, u);
  if (ctx.err) return ctx.err;
  var storeId = ctx.storeId;
  var role = await requireStoreMembership(u.userId, storeId);
  if (role !== 1) return fail(403, '仅门店老板可管理班次');

  var sid = parseInt(payload.id, 10);
  if (!sid || sid <= 0) return fail(400, '请指定班次 id');

  var q = await db
    .collection('shift_configs')
    .where({ id: sid, store_id: storeId, is_active: 1 })
    .limit(1)
    .get();
  if (!q.data.length) return fail(404, '班次不存在或已停用');

  await db.collection('shift_configs').doc(q.data[0]._id).update({
    data: { is_active: 0, updated_at: db.serverDate() },
  });
  return ok({ id: sid }, '已停用该班次');
}

function monthFromDateStr(recordDate) {
  return recordDate.length >= 7 ? recordDate.substring(0, 7) : '';
}

async function handleGetRecords(openid, payload) {
  var u = await requireUser(openid);
  if (!u) return fail(401, '未登录或用户无效');
  var ctx = await requireActiveStoreId(openid, u);
  if (ctx.err) return ctx.err;
  var storeId = ctx.storeId;
  var date = payload.date ? String(payload.date).trim() : '';
  var month = payload.month ? String(payload.month).trim() : '';
  var filterType;
  var filterValue;
  var whereBase = { store_id: storeId };
  if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
    filterType = 'date';
    filterValue = date;
    whereBase.record_date = date;
  } else {
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      var now = new Date();
      month =
        now.getFullYear() +
        '-' +
        (now.getMonth() + 1 < 10 ? '0' : '') +
        (now.getMonth() + 1);
    }
    filterType = 'month';
    filterValue = month;
    whereBase.record_month = month;
  }

  var recSnap = await db.collection('shift_records').where(whereBase).limit(500).get();
  var recordsRaw = recSnap.data;

  var summary = {
    total_revenue: 0,
    total_sold: 0,
    total_gift: 0,
    total_wechat_qty: 0,
    total_alipay_qty: 0,
    total_cash_qty: 0,
    total_wechat_amount: 0,
    total_alipay_amount: 0,
    total_cash_amount: 0,
    record_count: recordsRaw.length,
  };
  for (var i = 0; i < recordsRaw.length; i++) {
    var sr = recordsRaw[i];
    summary.total_revenue += parseFloat(sr.total_revenue) || 0;
    summary.total_sold += parseInt(sr.qty_sold, 10) || 0;
    summary.total_gift += parseInt(sr.qty_gift, 10) || 0;
    summary.total_wechat_qty += parseInt(sr.sold_wechat, 10) || 0;
    summary.total_alipay_qty += parseInt(sr.sold_alipay, 10) || 0;
    summary.total_cash_qty += parseInt(sr.sold_cash, 10) || 0;
    var up = parseFloat(sr.unit_price) || 0;
    summary.total_wechat_amount += (parseInt(sr.sold_wechat, 10) || 0) * up;
    summary.total_alipay_amount += (parseInt(sr.sold_alipay, 10) || 0) * up;
    summary.total_cash_amount += (parseInt(sr.sold_cash, 10) || 0) * up;
  }

  var cfgSnap = await db
    .collection('shift_configs')
    .where({ store_id: storeId })
    .get();
  var cfgMap = {};
  for (var c = 0; c < cfgSnap.data.length; c++) {
    var g = cfgSnap.data[c];
    cfgMap[g.id] = g;
  }

  var ridSet = {};
  for (var r0 = 0; r0 < recordsRaw.length; r0++) {
    ridSet[recordsRaw[r0].recorder_id] = true;
  }
  var ridList = Object.keys(ridSet).map(function (x) {
    return parseInt(x, 10);
  });
  var nickMap = {};
  for (var ch = 0; ch < ridList.length; ch += 10) {
    var chunk = ridList.slice(ch, ch + 10);
    if (!chunk.length) break;
    var uu = await db.collection('users').where({ userId: _.in(chunk) }).get();
    for (var ui = 0; ui < uu.data.length; ui++) {
      var ud = uu.data[ui];
      nickMap[ud.userId] = ud.nickname || '';
    }
  }

  var records = [];
  for (var j = 0; j < recordsRaw.length; j++) {
    var row = recordsRaw[j];
    var sc = cfgMap[row.shift_config_id] || {};
    var nick = nickMap[row.recorder_id] || '';
    var disp = row.recorder_name != null && String(row.recorder_name).trim() ? String(row.recorder_name).trim() : nick;
    records.push({
      id: row.id,
      record_date: row.record_date,
      shift_config_id: row.shift_config_id,
      shift_name: sc.name || '',
      shift_start: sc.start_time || '',
      shift_end: sc.end_time || '',
      shift_icon: sc.icon || '',
      recorder_id: row.recorder_id,
      recorder_name: disp || '—',
      qty_opening: row.qty_opening,
      qty_closing: row.qty_closing,
      qty_gift: row.qty_gift,
      qty_sold: row.qty_sold,
      sold_wechat: row.sold_wechat,
      sold_alipay: row.sold_alipay,
      sold_cash: row.sold_cash,
      cash_opening: row.cash_opening,
      cash_closing: row.cash_closing,
      unit_price: row.unit_price,
      total_revenue: row.total_revenue,
      created_at: row.created_at,
    });
  }

  records.sort(function (a, b) {
    if (a.record_date !== b.record_date) return b.record_date.localeCompare(a.record_date);
    var oa = cfgMap[a.shift_config_id] ? cfgMap[a.shift_config_id].sort_order || 0 : 0;
    var ob = cfgMap[b.shift_config_id] ? cfgMap[b.shift_config_id].sort_order || 0 : 0;
    return oa - ob;
  });

  return ok(
    {
      filter: { type: filterType, value: filterValue },
      summary: summary,
      records: records,
    },
    'success'
  );
}

async function handleAddRecord(openid, payload) {
  var u = await requireUser(openid);
  if (!u) return fail(401, '未登录或用户无效');
  var ctx = await requireActiveStoreId(openid, u);
  if (ctx.err) return ctx.err;
  var storeId = ctx.storeId;

  var recordDate = payload.record_date ? String(payload.record_date).trim() : '';
  var shiftConfigId = parseInt(payload.shift_config_id, 10);
  var qtyOpening = parseInt(payload.qty_opening, 10) || 0;
  var qtyClosing = parseInt(payload.qty_closing, 10) || 0;
  var qtyGift = parseInt(payload.qty_gift, 10) || 0;
  var soldWechat = parseInt(payload.sold_wechat, 10) || 0;
  var soldAlipay = parseInt(payload.sold_alipay, 10) || 0;
  var soldCash = parseInt(payload.sold_cash, 10) || 0;
  var cashOpening = parseFloat(payload.cash_opening) || 0;
  var cashClosing = parseFloat(payload.cash_closing) || 0;

  if (!recordDate || !/^\d{4}-\d{2}-\d{2}$/.test(recordDate)) {
    return fail(400, 'record_date 格式不正确，需要 YYYY-MM-DD');
  }
  if (!shiftConfigId || shiftConfigId <= 0) return fail(400, '请选择有效的班次');
  if (qtyOpening < 0 || qtyClosing < 0) return fail(400, '上班数量和下班数量不能为负数');

  var cfgQ = await db
    .collection('shift_configs')
    .where({ id: shiftConfigId, store_id: storeId, is_active: 1 })
    .limit(1)
    .get();
  if (!cfgQ.data.length) return fail(400, '所选班次不存在或已停用');

  var stQ = await db.collection('stores').where({ id: storeId }).limit(1).get();
  if (!stQ.data.length) return fail(500, '门店信息不存在');

  var qtySold = qtyOpening - qtyClosing - qtyGift;
  if (qtySold < 0) qtySold = 0;
  var paymentQty = soldWechat + soldAlipay + soldCash;
  if (paymentQty < 0) paymentQty = 0;
  var unitPrice = ITEM_UNIT_PRICE_JPY;
  var totalRevenue = Math.round(unitPrice * paymentQty * 100) / 100;
  var recordMonth = monthFromDateStr(recordDate);

  var dup = await db
    .collection('shift_records')
    .where({
      store_id: storeId,
      shift_config_id: shiftConfigId,
      record_date: recordDate,
    })
    .limit(1)
    .get();
  if (dup.data.length) return fail(400, '该日期该班次已有记录，不能重复录入');

  var recName = payload.recorder_name != null ? String(payload.recorder_name).trim() : '';
  if (!recName || recName.length > 32) {
    return fail(400, '请选择或填写记账姓名（1～32 字）');
  }
  var whitelist = Array.isArray(stQ.data[0].recorder_names) ? stQ.data[0].recorder_names : [];
  if (whitelist.length > 0 && whitelist.indexOf(recName) < 0) {
    return fail(400, '记账姓名不在本店名单中，请在录入页重新选择或联系老板维护名单');
  }

  /**
   * 与库存管理 current_stock 对齐：
   * - 支付渠道售出 + 赠送；若未填支付但填了盘点，则用 max(盘点售出, 支付合计)+赠送，避免只填上班/下班时不扣库。
   */
  var stockBase = Math.max(qtySold, paymentQty);
  var stockDeduct = stockBase + qtyGift;
  if (stockDeduct < 0) stockDeduct = 0;

  var storeDoc = stQ.data[0];
  var storeDbId = storeDoc._id;
  var curStock = storeDoc.current_stock != null ? storeDoc.current_stock : 0;
  var nextStock = curStock - stockDeduct;
  if (nextStock < 0) nextStock = 0;

  var recordId = await nextSeq('shift_record');
  await db.collection('shift_records').add({
    data: {
      id: recordId,
      store_id: storeId,
      shift_config_id: shiftConfigId,
      recorder_id: u.userId,
      recorder_name: recName,
      record_date: recordDate,
      record_month: recordMonth,
      qty_opening: qtyOpening,
      qty_closing: qtyClosing,
      qty_gift: qtyGift,
      sold_wechat: soldWechat,
      sold_alipay: soldAlipay,
      sold_cash: soldCash,
      cash_opening: cashOpening,
      cash_closing: cashClosing,
      qty_sold: qtySold,
      total_revenue: totalRevenue,
      unit_price: unitPrice,
      stock_deduct: stockDeduct,
      created_at: db.serverDate(),
      updated_at: db.serverDate(),
    },
  });

  if (stockDeduct > 0) {
    await db.collection('stores').doc(storeDbId).update({
      data: { current_stock: nextStock, updated_at: db.serverDate() },
    });
  }

  return ok(
    {
      id: recordId,
      store_id: storeId,
      shift_config_id: shiftConfigId,
      recorder: recName,
      record_date: recordDate,
      qty_opening: qtyOpening,
      qty_closing: qtyClosing,
      qty_gift: qtyGift,
      qty_sold: qtySold,
      sold_wechat: soldWechat,
      sold_alipay: soldAlipay,
      sold_cash: soldCash,
      cash_opening: cashOpening,
      cash_closing: cashClosing,
      unit_price: unitPrice,
      total_revenue: totalRevenue,
      stock_deduct: stockDeduct,
      current_stock: stockDeduct > 0 ? nextStock : curStock,
    },
    '记录提交成功'
  );
}

async function handleRecorderNameAdd(openid, payload) {
  var u = await requireUser(openid);
  if (!u) return fail(401, '未登录或用户无效');
  var ctx = await requireActiveStoreId(openid, u);
  if (ctx.err) return ctx.err;
  var storeId = ctx.storeId;
  var role = await requireStoreMembership(u.userId, storeId);
  if (role !== 1) return fail(403, '仅门店老板可维护记账姓名');

  var nm = payload.name != null ? String(payload.name).trim() : '';
  if (!nm || nm.length > 32) return fail(400, '姓名须为 1～32 个字');
  var stQ = await db.collection('stores').where({ id: storeId }).limit(1).get();
  if (!stQ.data.length) return fail(404, '门店不存在');
  var doc = stQ.data[0];
  var names = Array.isArray(doc.recorder_names) ? doc.recorder_names.slice() : [];
  if (names.indexOf(nm) >= 0) return fail(400, '该姓名已在列表中');
  if (names.length >= 50) return fail(400, '最多添加 50 个记账姓名');
  names.push(nm);
  await db.collection('stores').doc(doc._id).update({
    data: { recorder_names: names, updated_at: db.serverDate() },
  });
  return ok({ recorder_names: names }, '已添加');
}

async function handleRecorderNameDelete(openid, payload) {
  var u = await requireUser(openid);
  if (!u) return fail(401, '未登录或用户无效');
  var ctx = await requireActiveStoreId(openid, u);
  if (ctx.err) return ctx.err;
  var storeId = ctx.storeId;
  var role = await requireStoreMembership(u.userId, storeId);
  if (role !== 1) return fail(403, '仅门店老板可维护记账姓名');

  var nm = payload.name != null ? String(payload.name).trim() : '';
  if (!nm) return fail(400, '请指定要删除的姓名');
  var stQ = await db.collection('stores').where({ id: storeId }).limit(1).get();
  if (!stQ.data.length) return fail(404, '门店不存在');
  var doc = stQ.data[0];
  var names = Array.isArray(doc.recorder_names) ? doc.recorder_names.slice() : [];
  var idx = names.indexOf(nm);
  if (idx < 0) return fail(404, '列表中无此姓名');
  names.splice(idx, 1);
  await db.collection('stores').doc(doc._id).update({
    data: { recorder_names: names, updated_at: db.serverDate() },
  });
  return ok({ recorder_names: names }, '已删除');
}

async function handleStoreDetail(openid) {
  var u = await requireUser(openid);
  if (!u) return fail(401, '未登录或用户无效');
  var ctx = await requireActiveStoreId(openid, u);
  if (ctx.err) return ctx.err;
  var storeId = ctx.storeId;
  var stQ = await db.collection('stores').where({ id: storeId }).limit(1).get();
  if (!stQ.data.length) return fail(404, '门店不存在');
  var s = stQ.data[0];
  var rnames = Array.isArray(s.recorder_names) ? s.recorder_names : [];
  return ok({
    id: s.id,
    name: s.name,
    unit_price: s.unit_price,
    current_stock: s.current_stock != null ? s.current_stock : 0,
    currency: s.currency || 'CNY',
    address: s.address || '',
    recorder_names: rnames,
  });
}

async function handleGetStoreMembers(openid) {
  var u = await requireUser(openid);
  if (!u) return fail(401, '未登录或用户无效');
  var ctx = await requireActiveStoreId(openid, u);
  if (ctx.err) return ctx.err;
  var storeId = ctx.storeId;
  var mem = await db
    .collection('store_members')
    .where({ store_id: storeId, is_active: 1 })
    .get();
  var userIds = [];
  for (var m = 0; m < mem.data.length; m++) {
    userIds.push(mem.data[m].user_id);
  }
  if (!userIds.length) {
    return ok({ members: [] });
  }
  var nickMap = {};
  for (var ch = 0; ch < userIds.length; ch += 20) {
    var chunk = userIds.slice(ch, ch + 20);
    var uu = await db.collection('users').where({ userId: _.in(chunk) }).get();
    for (var i = 0; i < uu.data.length; i++) {
      var ud = uu.data[i];
      nickMap[ud.userId] = ud.nickname || '';
    }
  }
  var members = mem.data.map(function (row) {
    return {
      user_id: row.user_id,
      nickname: nickMap[row.user_id] || '用户 ' + row.user_id,
      role: row.role,
      role_name: row.role === 1 ? '老板' : row.role === 2 ? '员工' : '成员',
    };
  });
  members.sort(function (a, b) {
    if (a.role !== b.role) return a.role - b.role;
    return a.user_id - b.user_id;
  });
  return ok({ members: members });
}

async function handleStoreRestock(openid, payload) {
  var u = await requireUser(openid);
  if (!u) return fail(401, '未登录或用户无效');
  var ctx = await requireActiveStoreId(openid, u);
  if (ctx.err) return ctx.err;
  var storeId = ctx.storeId;
  var role = await requireStoreMembership(u.userId, storeId);
  if (role !== 1) return fail(403, '仅门店老板可补货');
  var qty = parseInt(payload.qty, 10);
  if (!qty || qty <= 0 || qty > 100000) return fail(400, '补货数量须在 1～100000 之间');
  var stQ = await db.collection('stores').where({ id: storeId }).limit(1).get();
  if (!stQ.data.length) return fail(404, '门店不存在');
  var doc = stQ.data[0];
  var cur = doc.current_stock != null ? doc.current_stock : 0;
  var nextStock = cur + qty;
  await db
    .collection('stores')
    .doc(doc._id)
    .update({
      data: { current_stock: nextStock, updated_at: db.serverDate() },
    });
  return ok({ current_stock: nextStock, added: qty });
}

async function handleWithdrawList(openid) {
  var u = await requireUser(openid);
  if (!u) return fail(401, '未登录或用户无效');
  var ctx = await requireActiveStoreId(openid, u);
  if (ctx.err) return ctx.err;
  var storeId = ctx.storeId;
  var role = await requireStoreMembership(u.userId, storeId);
  if (role == null) return fail(403, '无权查看该门店');

  var r = await db
    .collection('store_withdrawals')
    .where({ store_id: storeId })
    .limit(200)
    .get();
  var rows = r.data.slice().sort(function (a, b) {
    var da = a.record_date || '';
    var db = b.record_date || '';
    if (da !== db) return db.localeCompare(da);
    return (b.id || 0) - (a.id || 0);
  });
  var total = 0;
  for (var i = 0; i < rows.length; i++) {
    var aj = rows[i].amount_jpy != null ? parseInt(rows[i].amount_jpy, 10) : 0;
    if (!Number.isNaN(aj) && aj > 0) total += aj;
  }
  var out = rows.slice(0, 100).map(function (row) {
    return {
      id: row.id,
      record_date: row.record_date || '',
      amount_jpy: row.amount_jpy != null ? row.amount_jpy : 0,
    };
  });
  return ok({ records: out, total_jpy: total }, 'success');
}

async function handleWithdrawAdd(openid, payload) {
  var u = await requireUser(openid);
  if (!u) return fail(401, '未登录或用户无效');
  var ctx = await requireActiveStoreId(openid, u);
  if (ctx.err) return ctx.err;
  var storeId = ctx.storeId;
  var role = await requireStoreMembership(u.userId, storeId);
  if (role !== 1) return fail(403, '仅门店老板可登记取现');

  var amt =
    payload.amount_jpy != null
      ? parseInt(payload.amount_jpy, 10)
      : parseInt(payload.amount, 10);
  if (Number.isNaN(amt) || amt <= 0) return fail(400, '请输入大于 0 的取现金额（円）');
  if (amt > 999999999) return fail(400, '金额过大');

  var recordDate = payload.record_date != null ? String(payload.record_date).trim() : '';
  if (!recordDate || !/^\d{4}-\d{2}-\d{2}$/.test(recordDate)) {
    return fail(400, 'record_date 须为 YYYY-MM-DD');
  }

  var wid = await nextSeq('store_withdrawal');
  await db.collection('store_withdrawals').add({
    data: {
      id: wid,
      store_id: storeId,
      amount_jpy: amt,
      record_date: recordDate,
      operator_id: u.userId,
      created_at: db.serverDate(),
    },
  });
  return ok(
    {
      id: wid,
      record_date: recordDate,
      amount_jpy: amt,
    },
    '已记录取现'
  );
}

async function handleUpdateProfile(openid, payload) {
  var u = await requireUser(openid);
  if (!u) return fail(401, '未登录或用户无效');
  var nickname = payload.nickname != null ? String(payload.nickname).trim() : '';
  if (!nickname) return fail(400, '请填写昵称');
  if (nickname.length > 64) return fail(400, '昵称不能超过 64 个字');
  await db.collection('users').doc(openid).update({
    data: { nickname: nickname, updated_at: db.serverDate() },
  });
  return ok({ user_info: { nickname: nickname } }, '已保存');
}

async function countActiveBossesInStore(storeId) {
  var r = await db
    .collection('store_members')
    .where({ store_id: storeId, role: 1, is_active: 1 })
    .get();
  return r.data.length;
}

async function refreshUserCurrentStoreAfterMembershipChange(targetUserId) {
  var rem = await db
    .collection('store_members')
    .where({ user_id: targetUserId, is_active: 1 })
    .get();
  var storeIds = [];
  for (var i = 0; i < rem.data.length; i++) {
    storeIds.push(rem.data[i].store_id);
  }
  var uq = await db.collection('users').where({ userId: targetUserId }).limit(1).get();
  if (!uq.data.length) return;
  var tdoc = uq.data[0];
  var openid = tdoc._id;
  var cur = tdoc.current_store_id != null ? parseInt(tdoc.current_store_id, 10) : 0;
  var nextStore = 0;
  if (cur > 0 && storeIds.indexOf(cur) >= 0) {
    nextStore = cur;
  } else if (storeIds.length) {
    nextStore = storeIds[0];
  }
  var patch = { updated_at: db.serverDate() };
  patch.current_store_id = nextStore > 0 ? nextStore : null;
  await db.collection('users').doc(openid).update({ data: patch });
}

async function mapShiftRecordRow(row, storeId) {
  var cfgSnap = await db
    .collection('shift_configs')
    .where({ store_id: storeId })
    .get();
  var cfgMap = {};
  for (var c = 0; c < cfgSnap.data.length; c++) {
    var g = cfgSnap.data[c];
    cfgMap[g.id] = g;
  }
  var nick = '';
  if (row.recorder_id != null) {
    var uu = await db.collection('users').where({ userId: row.recorder_id }).limit(1).get();
    if (uu.data.length) nick = uu.data[0].nickname || '';
  }
  var sc = cfgMap[row.shift_config_id] || {};
  var disp =
    row.recorder_name != null && String(row.recorder_name).trim()
      ? String(row.recorder_name).trim()
      : nick;
  return {
    id: row.id,
    record_date: row.record_date,
    shift_config_id: row.shift_config_id,
    shift_name: sc.name || '',
    shift_start: sc.start_time || '',
    shift_end: sc.end_time || '',
    shift_icon: sc.icon || '',
    recorder_id: row.recorder_id,
    recorder_name: disp || '—',
    qty_opening: row.qty_opening,
    qty_closing: row.qty_closing,
    qty_gift: row.qty_gift,
    qty_sold: row.qty_sold,
    sold_wechat: row.sold_wechat,
    sold_alipay: row.sold_alipay,
    sold_cash: row.sold_cash,
    cash_opening: row.cash_opening,
    cash_closing: row.cash_closing,
    unit_price: row.unit_price,
    total_revenue: row.total_revenue,
    created_at: row.created_at,
  };
}

async function handleGetRecord(openid, payload) {
  var u = await requireUser(openid);
  if (!u) return fail(401, '未登录或用户无效');
  var ctx = await requireActiveStoreId(openid, u);
  if (ctx.err) return ctx.err;
  var storeId = ctx.storeId;
  var mem = await requireStoreMembership(u.userId, storeId);
  if (mem == null) return fail(403, '无权查看');
  var rid = parseInt(payload.id, 10);
  if (!rid || rid <= 0) return fail(400, '缺少记录 id');
  var recSnap = await db.collection('shift_records').where({ store_id: storeId, id: rid }).limit(1).get();
  if (!recSnap.data.length) return fail(404, '记录不存在');
  var mapped = await mapShiftRecordRow(recSnap.data[0], storeId);
  return ok({ record: mapped }, 'success');
}

async function handleUpdateRecord(openid, payload) {
  var u = await requireUser(openid);
  if (!u) return fail(401, '未登录或用户无效');
  var ctx = await requireActiveStoreId(openid, u);
  if (ctx.err) return ctx.err;
  var storeId = ctx.storeId;
  var role = await requireStoreMembership(u.userId, storeId);
  if (role == null) return fail(403, '无权操作');

  var recordId = parseInt(payload.id, 10);
  if (!recordId || recordId <= 0) return fail(400, '缺少记录 id');

  var recSnap = await db.collection('shift_records').where({ store_id: storeId, id: recordId }).limit(1).get();
  if (!recSnap.data.length) return fail(404, '记录不存在');
  var oldRow = recSnap.data[0];
  var oldDocId = oldRow._id;

  if (role !== 1 && oldRow.recorder_id !== u.userId) {
    return fail(403, '仅记录人或老板可修改');
  }

  var recordDate = payload.record_date ? String(payload.record_date).trim() : '';
  var shiftConfigId = parseInt(payload.shift_config_id, 10);
  var qtyOpening = parseInt(payload.qty_opening, 10) || 0;
  var qtyClosing = parseInt(payload.qty_closing, 10) || 0;
  var qtyGift = parseInt(payload.qty_gift, 10) || 0;
  var soldWechat = parseInt(payload.sold_wechat, 10) || 0;
  var soldAlipay = parseInt(payload.sold_alipay, 10) || 0;
  var soldCash = parseInt(payload.sold_cash, 10) || 0;
  var cashOpening = parseFloat(payload.cash_opening) || 0;
  var cashClosing = parseFloat(payload.cash_closing) || 0;

  if (!recordDate || !/^\d{4}-\d{2}-\d{2}$/.test(recordDate)) {
    return fail(400, 'record_date 格式不正确');
  }
  if (!shiftConfigId || shiftConfigId <= 0) return fail(400, '请选择有效的班次');
  if (qtyOpening < 0 || qtyClosing < 0) return fail(400, '上班数量和下班数量不能为负数');

  var cfgQ = await db
    .collection('shift_configs')
    .where({ id: shiftConfigId, store_id: storeId, is_active: 1 })
    .limit(1)
    .get();
  if (!cfgQ.data.length) return fail(400, '所选班次不存在或已停用');

  var stQ = await db.collection('stores').where({ id: storeId }).limit(1).get();
  if (!stQ.data.length) return fail(500, '门店信息不存在');

  var dupQ = await db
    .collection('shift_records')
    .where({
      store_id: storeId,
      record_date: recordDate,
      shift_config_id: shiftConfigId,
      id: _.neq(recordId),
    })
    .limit(1)
    .get();
  if (dupQ.data.length) {
    return fail(400, '该日期该班次已有其他记录，不能改为此组合');
  }

  var recName = payload.recorder_name != null ? String(payload.recorder_name).trim() : '';
  if (!recName || recName.length > 32) {
    return fail(400, '请选择或填写记账姓名（1～32 字）');
  }
  var whitelist = Array.isArray(stQ.data[0].recorder_names) ? stQ.data[0].recorder_names : [];
  if (whitelist.length > 0 && whitelist.indexOf(recName) < 0) {
    return fail(400, '记账姓名不在本店名单中');
  }

  var qtySold = qtyOpening - qtyClosing - qtyGift;
  if (qtySold < 0) qtySold = 0;
  var paymentQty = soldWechat + soldAlipay + soldCash;
  if (paymentQty < 0) paymentQty = 0;
  var unitPrice = ITEM_UNIT_PRICE_JPY;
  var totalRevenue = Math.round(unitPrice * paymentQty * 100) / 100;
  var recordMonth = monthFromDateStr(recordDate);

  var oldDeduct = stockDeductFromQtys(
    oldRow.qty_opening,
    oldRow.qty_closing,
    oldRow.qty_gift,
    oldRow.sold_wechat,
    oldRow.sold_alipay,
    oldRow.sold_cash
  );
  var newDeduct = stockDeductFromQtys(
    qtyOpening,
    qtyClosing,
    qtyGift,
    soldWechat,
    soldAlipay,
    soldCash
  );

  var storeDoc = stQ.data[0];
  var storeDbId = storeDoc._id;
  var curStock = storeDoc.current_stock != null ? storeDoc.current_stock : 0;
  var nextStock = curStock + oldDeduct - newDeduct;
  if (nextStock < 0) nextStock = 0;

  await db.collection('shift_records').doc(oldDocId).update({
    data: {
      shift_config_id: shiftConfigId,
      recorder_name: recName,
      record_date: recordDate,
      record_month: recordMonth,
      qty_opening: qtyOpening,
      qty_closing: qtyClosing,
      qty_gift: qtyGift,
      sold_wechat: soldWechat,
      sold_alipay: soldAlipay,
      sold_cash: soldCash,
      cash_opening: cashOpening,
      cash_closing: cashClosing,
      qty_sold: qtySold,
      total_revenue: totalRevenue,
      unit_price: unitPrice,
      stock_deduct: newDeduct,
      updated_at: db.serverDate(),
    },
  });

  if (oldDeduct !== newDeduct) {
    await db.collection('stores').doc(storeDbId).update({
      data: { current_stock: nextStock, updated_at: db.serverDate() },
    });
  }

  return ok(
    {
      id: recordId,
      record_date: recordDate,
      stock_deduct: newDeduct,
      current_stock: oldDeduct !== newDeduct ? nextStock : curStock,
    },
    '已保存修改'
  );
}

async function handleStoreMemberRemove(openid, payload) {
  var u = await requireUser(openid);
  if (!u) return fail(401, '未登录或用户无效');
  var ctx = await requireActiveStoreId(openid, u);
  if (ctx.err) return ctx.err;
  var storeId = ctx.storeId;
  var callerRole = await requireStoreMembership(u.userId, storeId);
  if (callerRole == null) return fail(403, '无权操作');

  var targetUserId = parseInt(payload.user_id, 10);
  if (!targetUserId || targetUserId <= 0) return fail(400, '请指定成员');

  if (callerRole === 2 && targetUserId !== u.userId) {
    return fail(403, '仅老板可移除其他成员');
  }

  var tMem = await db
    .collection('store_members')
    .where({ store_id: storeId, user_id: targetUserId, is_active: 1 })
    .limit(1)
    .get();
  if (!tMem.data.length) return fail(400, '该成员不在本店或已移除');

  var targetRole = tMem.data[0].role;
  if (targetRole === 1) {
    var bossCount = await countActiveBossesInStore(storeId);
    if (bossCount <= 1) {
      return fail(400, '门店至少保留一名老板');
    }
  }

  var docId = 'sm_' + storeId + '_' + targetUserId;
  await db.collection('store_members').doc(docId).update({
    data: { is_active: 0, updated_at: db.serverDate() },
  });

  await refreshUserCurrentStoreAfterMembershipChange(targetUserId);

  return ok({}, '已移除成员');
}

async function handleStoreMemberSetRole(openid, payload) {
  var u = await requireUser(openid);
  if (!u) return fail(401, '未登录或用户无效');
  var ctx = await requireActiveStoreId(openid, u);
  if (ctx.err) return ctx.err;
  var storeId = ctx.storeId;
  var callerRole = await requireStoreMembership(u.userId, storeId);
  if (callerRole !== 1) return fail(403, '仅老板可调整角色');

  var targetUserId = parseInt(payload.user_id, 10);
  var newRole = parseInt(payload.role, 10);
  if (!targetUserId || targetUserId <= 0) return fail(400, '请指定成员');
  if (newRole !== 1 && newRole !== 2) return fail(400, '角色无效');

  var tMem = await db
    .collection('store_members')
    .where({ store_id: storeId, user_id: targetUserId, is_active: 1 })
    .limit(1)
    .get();
  if (!tMem.data.length) return fail(400, '该成员不在本店');

  var prevRole = tMem.data[0].role;
  if (prevRole === 1 && newRole === 2) {
    var bossCount = await countActiveBossesInStore(storeId);
    if (bossCount <= 1) {
      return fail(400, '门店至少保留一名老板');
    }
  }

  var docId = 'sm_' + storeId + '_' + targetUserId;
  await db.collection('store_members').doc(docId).update({
    data: { role: newRole, updated_at: db.serverDate() },
  });

  return ok({ user_id: targetUserId, role: newRole }, '已更新角色');
}

exports.main = async function (event, context) {
  try {
    var wxContext = cloud.getWXContext();
    var OPENID = wxContext.OPENID;
    var action = (event && event.action) ? String(event.action).trim() : '';
    var payload = event || {};
    /** 兼容误传 snake_case 的旧客户端或测试请求 */
    var ACTION_ALIASES = {
      recorder_name_add: 'recorderNameAdd',
      recorder_name_delete: 'recorderNameDelete',
      store_detail: 'storeDetail',
      get_shifts: 'getShifts',
      add_record: 'addRecord',
      get_records: 'getRecords',
      get_record: 'getRecord',
      update_record: 'updateRecord',
      store_member_remove: 'storeMemberRemove',
      store_member_set_role: 'storeMemberSetRole',
      get_record: 'getRecord',
      update_record: 'updateRecord',
    };
    if (ACTION_ALIASES[action]) {
      action = ACTION_ALIASES[action];
    }

    switch (action) {
      case 'login':
        return await handleLogin(OPENID, payload);
      case 'getStores':
        return await handleGetStores(OPENID);
      case 'storeCreate':
        return await handleStoreCreate(OPENID, payload);
      case 'storeSwitch':
        return await handleStoreSwitch(OPENID, payload);
      case 'storeJoin':
        return await handleStoreJoin(OPENID, payload);
      case 'storeInviteCreate':
        return await handleStoreInviteCreate(OPENID, payload);
      case 'getShifts':
        return await handleGetShifts(OPENID);
      case 'shiftConfigSave':
        return await handleShiftConfigSave(OPENID, payload);
      case 'shiftConfigDelete':
        return await handleShiftConfigDelete(OPENID, payload);
      case 'getRecords':
        return await handleGetRecords(OPENID, payload);
      case 'addRecord':
        return await handleAddRecord(OPENID, payload);
      case 'storeDetail':
        return await handleStoreDetail(OPENID);
      case 'recorderNameAdd':
        return await handleRecorderNameAdd(OPENID, payload);
      case 'recorderNameDelete':
        return await handleRecorderNameDelete(OPENID, payload);
      case 'getStoreMembers':
        return await handleGetStoreMembers(OPENID);
      case 'getRecord':
        return await handleGetRecord(OPENID, payload);
      case 'updateRecord':
        return await handleUpdateRecord(OPENID, payload);
      case 'storeMemberRemove':
        return await handleStoreMemberRemove(OPENID, payload);
      case 'storeMemberSetRole':
        return await handleStoreMemberSetRole(OPENID, payload);
      case 'storeRestock':
        return await handleStoreRestock(OPENID, payload);
      case 'withdrawList':
        return await handleWithdrawList(OPENID);
      case 'withdrawAdd':
        return await handleWithdrawAdd(OPENID, payload);
      case 'updateProfile':
        return await handleUpdateProfile(OPENID, payload);
      default:
        return fail(400, '未知 action: ' + action);
    }
  } catch (e) {
    console.error(e);
    return fail(500, e.message || '服务器错误');
  }
};
