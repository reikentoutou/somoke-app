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

function formatLedgerEntryTime(v) {
  if (v == null || v === '') return '';
  try {
    if (typeof v === 'string') {
      var s = v.replace('T', ' ');
      return s.length > 19 ? s.slice(0, 19) : s;
    }
    if (typeof v === 'object' && v !== null) {
      if (typeof v.getTime === 'function') return formatDateTime(v);
      if (v._seconds != null) {
        var ms = v._seconds * 1000 + (v._nanoseconds != null ? Math.floor(v._nanoseconds / 1e6) : 0);
        return formatDateTime(new Date(ms));
      }
    }
  } catch (e) {
    /* ignore */
  }
  return '';
}

/** 云数据库日期 / ServerDate 读回 → 毫秒时间戳，便于比较 */
function cloudDateToMs(v) {
  if (v == null || v === '') return null;
  try {
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
    if (typeof v.getTime === 'function') return v.getTime();
    if (v instanceof Date) return v.getTime();
    if (typeof v === 'object' && v._seconds != null) {
      return v._seconds * 1000 + (v._nanoseconds != null ? Math.floor(v._nanoseconds / 1e6) : 0);
    }
    if (typeof v === 'string') {
      var t = Date.parse(v);
      if (!Number.isNaN(t)) return t;
    }
  } catch (e) {
    /* ignore */
  }
  return null;
}

/** 组装流水文档数据（不落库，供事务内外共用） */
function buildStockLedgerDocData(ledgerId, storeId, userId, eventType, delta, balanceAfter, cashDelta, cashBalanceAfter, refRecordId, note) {
  var data = {
    id: ledgerId,
    store_id: storeId,
    event_type: eventType,
    delta: delta,
    balance_after: balanceAfter,
    cash_delta: cashDelta || 0,
    cash_balance_after: cashBalanceAfter || 0,
    note: note != null ? String(note).trim().slice(0, 200) : '',
    created_by: userId,
    created_at: db.serverDate(),
  };
  var rid = refRecordId != null ? parseInt(refRecordId, 10) : NaN;
  if (!Number.isNaN(rid) && rid > 0) {
    data.ref_record_id = rid;
  }
  return data;
}

/**
 * 事务中写流水：_id 用确定性字符串（ssl_<id>），保证重试/回放幂等不会产生重复文档。
 * 需要在外部用 nextSeq('stock_ledger') 预先拿到 ledgerId。
 */
async function insertStockLedgerEntryTx(tx, ledgerId, storeId, userId, eventType, delta, balanceAfter, cashDelta, cashBalanceAfter, refRecordId, note) {
  var docId = 'ssl_' + ledgerId;
  var data = buildStockLedgerDocData(ledgerId, storeId, userId, eventType, delta, balanceAfter, cashDelta, cashBalanceAfter, refRecordId, note);
  await tx.collection('store_stock_ledger').doc(docId).set({ data: data });
}

/**
 * 事务式自增序列号：
 * - 若 counters/<name> 不存在：用 set 初始化为 1（并发时依赖事务冲突检测自动重试其中一方）
 * - 出现 DUPLICATE_KEY / 事务冲突时，外层最多重试 3 次，避免极端首次并发的偶发失败
 */
async function nextSeq(name) {
  var lastErr = null;
  for (var attempt = 0; attempt < 3; attempt++) {
    try {
      return await db.runTransaction(async function (transaction) {
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
    } catch (e) {
      lastErr = e;
      var msg = String((e && (e.errMsg || e.message)) || '');
      var isRetryable =
        msg.indexOf('DUPLICATE') !== -1 ||
        msg.indexOf('conflict') !== -1 ||
        msg.indexOf('TRANSACTION') !== -1;
      if (!isRetryable) break;
      /** 线性退让，避免和重试者再次抢占 */
      await new Promise(function (r) { setTimeout(r, 40 * (attempt + 1)); });
    }
  }
  throw lastErr || new Error('nextSeq failed: ' + name);
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

/**
 * 轻量会话校验：对非 login 请求，若客户端带了 token，则要求与 DB 当前 session_token 匹配且未过期。
 * - 客户端未附带 token 时不阻断（兼容旧版本；OPENID 身份仍然可信，因此该"登录可感知"的控制层并非防伪造）
 * - 作用：多设备登录时让前一台自动掉线、显式退出后其他 tab 不能继续写
 */
async function validateSession(openid, payload, action) {
  if (action === 'login') return null;
  var clientToken = payload && payload.token != null ? String(payload.token).trim() : '';
  if (!clientToken) return null;
  var u = await getUserDoc(openid);
  if (!u || u.is_active === 0) {
    return fail(401, '账号已失效，请重新登录');
  }
  var dbToken = u.session_token ? String(u.session_token) : '';
  if (dbToken && dbToken !== clientToken) {
    return fail(401, '登录已在其他设备更新，请重新登录');
  }
  var expMs = cloudDateToMs(u.token_expire_at);
  if (expMs != null && expMs < Date.now()) {
    return fail(401, '登录已过期，请重新登录');
  }
  return null;
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
    if (!s.data.length) continue;
    var st = s.data[0];
    if (st.is_active === 0) continue;
    var name = st.name ? String(st.name) : '';
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
  if (Number.isNaN(unitPrice) || unitPrice < 0) return fail(400, '单价不能为负数');
  if (currency.length > 8) return fail(400, '货币代码过长');

  /** 门店创建涉及 4 类集合写入，任一步失败都要回滚之前创建的文档，避免产生"半只门店" */
  var storeId = await nextSeq('store');
  var storeDocId = 'store_' + storeId;
  var memberDocId = 'sm_' + storeId + '_' + u.userId;
  var initRecorderNames = [];
  if (u.nickname && String(u.nickname).trim()) {
    initRecorderNames.push(String(u.nickname).trim());
  }

  var createdStore = false;
  var createdMember = false;
  var updatedUser = false;
  var createdShiftDocIds = [];

  async function rollback() {
    if (createdShiftDocIds.length) {
      for (var ci = 0; ci < createdShiftDocIds.length; ci++) {
        try {
          await db.collection('shift_configs').doc(createdShiftDocIds[ci]).remove();
        } catch (e) { /* ignore */ }
      }
    }
    if (updatedUser) {
      try {
        await db.collection('users').doc(openid).update({
          data: { current_store_id: u.current_store_id != null ? u.current_store_id : null },
        });
      } catch (e) { /* ignore */ }
    }
    if (createdMember) {
      try { await db.collection('store_members').doc(memberDocId).remove(); } catch (e) { /* ignore */ }
    }
    if (createdStore) {
      try { await db.collection('stores').doc(storeDocId).remove(); } catch (e) { /* ignore */ }
    }
  }

  try {
    await db.collection('stores').doc(storeDocId).set({
      data: {
        id: storeId,
        name: name,
        address: address,
        unit_price: unitPrice,
        current_stock: 0,
        current_cash: 0,
        currency: currency,
        recorder_names: initRecorderNames,
        is_active: 1,
        created_at: db.serverDate(),
        updated_at: db.serverDate(),
      },
    });
    createdStore = true;

    await db.collection('store_members').doc(memberDocId).set({
      data: {
        store_id: storeId,
        user_id: u.userId,
        role: 1,
        is_active: 1,
        created_at: db.serverDate(),
      },
    });
    createdMember = true;

    await db.collection('users').doc(openid).update({
      data: { current_store_id: storeId, updated_at: db.serverDate() },
    });
    updatedUser = true;

    var defaults = [
      { name: '早班', start: '07:00:00', end: '13:00:00', icon: 'wb_sunny', ord: 1 },
      { name: '白1', start: '13:00:00', end: '18:00:00', icon: 'light_mode', ord: 2 },
      { name: '白2', start: '18:00:00', end: '23:00:00', icon: 'routine', ord: 3 },
      { name: '夜班', start: '23:00:00', end: '07:00:00', icon: 'dark_mode', ord: 4 },
    ];
    for (var d = 0; d < defaults.length; d++) {
      var scId = await nextSeq('shift_config');
      var scDocId = 'sc_' + scId;
      await db.collection('shift_configs').doc(scDocId).set({
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
      createdShiftDocIds.push(scDocId);
    }
  } catch (err) {
    console.error('[storeCreate] create failed, rolling back', err);
    await rollback();
    return fail(500, '门店创建失败，请稍后重试');
  }

  /** 读回真实的 DB 时间，避免客户端显示与 DB 之间的时区/秒级偏差 */
  var createdAtStr = formatDateTime(new Date());
  var updatedAtStr = createdAtStr;
  try {
    var dbDoc = await db.collection('stores').doc(storeDocId).get();
    if (dbDoc && dbDoc.data) {
      createdAtStr = formatLedgerEntryTime(dbDoc.data.created_at) || createdAtStr;
      updatedAtStr = formatLedgerEntryTime(dbDoc.data.updated_at) || updatedAtStr;
    }
  } catch (e) { /* ignore */ }

  var row = {
    id: storeId,
    name: name,
    address: address,
    unit_price: unitPrice,
    current_stock: 0,
    current_cash: 0,
    currency: currency,
    is_active: 1,
    created_at: createdAtStr,
    updated_at: updatedAtStr,
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

  /** 先按 code_hash 找到邀请与门店（事务内需要通过 _id 访问） */
  var invQ = await db.collection('store_invites').where({ code_hash: codeHash }).limit(1).get();
  if (!invQ.data.length) return fail(400, '邀请码无效');
  var inviteDocId = invQ.data[0]._id;
  var storeId = invQ.data[0].store_id;

  var memberDocId = 'sm_' + storeId + '_' + u.userId;

  try {
    await db.runTransaction(async function (tx) {
      var invSnap = await tx.collection('store_invites').doc(inviteDocId).get();
      if (!invSnap || !invSnap.data) {
        var miss = new Error('INVITE_MISSING');
        miss._user = { code: 400, msg: '邀请码无效' };
        throw miss;
      }
      var inv = invSnap.data;
      var expires = inv.expires_at;
      var maxUses = inv.max_uses;
      var used = inv.used_count || 0;
      var expMs = expires instanceof Date
        ? expires.getTime()
        : (typeof expires === 'object' && expires && expires._seconds != null
            ? expires._seconds * 1000
            : new Date(expires).getTime());
      if (expMs < Date.now()) {
        var e1 = new Error('EXPIRED');
        e1._user = { code: 400, msg: '邀请码已过期' };
        throw e1;
      }
      if (used >= maxUses) {
        var e2 = new Error('USED_UP');
        e2._user = { code: 400, msg: '邀请码已达使用上限' };
        throw e2;
      }

      /** 通过确定性 _id 检查成员是否已存在：同一 (store, user) 下只会有一条 */
      try {
        var memSnap = await tx.collection('store_members').doc(memberDocId).get();
        if (memSnap && memSnap.data) {
          var e3 = new Error('ALREADY_MEMBER');
          e3._user = { code: 400, msg: '您已是该门店成员' };
          throw e3;
        }
      } catch (e) {
        if (e && e._user) throw e;
        if (!isDocNotFoundErr(e)) throw e;
      }

      await tx.collection('store_members').doc(memberDocId).set({
        data: {
          store_id: storeId,
          user_id: u.userId,
          role: 2,
          is_active: 1,
          created_at: db.serverDate(),
        },
      });
      /** 事务内用「读到的 used」做 +1 写入；若并发写入冲突，runTransaction 会整体回滚重试 */
      await tx.collection('store_invites').doc(inviteDocId).update({
        data: { used_count: used + 1 },
      });
      await tx.collection('users').doc(openid).update({
        data: { current_store_id: storeId, updated_at: db.serverDate() },
      });
    });
  } catch (err) {
    if (err && err._user) return fail(err._user.code, err._user.msg);
    console.error('[storeJoin] tx failed', err);
    return fail(500, '加入失败，请稍后重试');
  }

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
  if (role !== 1) return fail(403, '仅门店管理员可执行此操作');
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

async function handleStoreUpdate(openid, payload) {
  var u = await requireUser(openid);
  if (!u) return fail(401, '未登录或用户无效');
  var storeId = parseInt(payload.store_id, 10);
  if (!storeId || storeId <= 0) return fail(400, '请指定门店');
  var role = await requireStoreMembership(u.userId, storeId);
  if (role == null) return fail(403, '无权操作该门店');
  if (role !== 1) return fail(403, '仅门店管理员可修改名称');
  var name = payload.name != null ? String(payload.name).trim() : '';
  if (!name) return fail(400, '请填写门店名称');
  if (name.length > 64) return fail(400, '门店名称过长');
  var stQ = await db.collection('stores').where({ id: storeId }).limit(1).get();
  if (!stQ.data.length) return fail(404, '门店不存在');
  var doc = stQ.data[0];
  if (doc.is_active === 0) return fail(400, '门店已关闭');
  await db.collection('stores').doc(doc._id).update({
    data: { name: name, updated_at: db.serverDate() },
  });
  return ok({ store_id: storeId, name: name }, '已保存');
}

/**
 * 软删门店：门店 is_active=0，全员 membership 置为失效，并校正各用户 current_store_id。
 * 业务数据（班次、记账记录等）保留在库内，避免误删造成对账缺口。
 */
async function handleStoreDelete(openid, payload) {
  var u = await requireUser(openid);
  if (!u) return fail(401, '未登录或用户无效');
  var storeId = parseInt(payload.store_id, 10);
  if (!storeId || storeId <= 0) return fail(400, '请指定门店');
  var role = await requireStoreMembership(u.userId, storeId);
  if (role == null) return fail(403, '无权操作该门店');
  if (role !== 1) return fail(403, '仅门店管理员可删除门店');
  var stQ = await db.collection('stores').where({ id: storeId }).limit(1).get();
  if (!stQ.data.length) return fail(404, '门店不存在');
  var doc = stQ.data[0];
  if (doc.is_active === 0) return fail(400, '门店已删除');

  var memQ = await db
    .collection('store_members')
    .where({ store_id: storeId, is_active: 1 })
    .limit(500)
    .get();
  for (var i = 0; i < memQ.data.length; i++) {
    await db.collection('store_members').doc(memQ.data[i]._id).update({
      data: { is_active: 0, updated_at: db.serverDate() },
    });
  }
  var seenUser = {};
  for (var j = 0; j < memQ.data.length; j++) {
    var uid = memQ.data[j].user_id;
    if (seenUser[uid]) continue;
    seenUser[uid] = true;
    await refreshUserCurrentStoreAfterMembershipChange(uid);
  }
  await db.collection('stores').doc(doc._id).update({
    data: { is_active: 0, updated_at: db.serverDate() },
  });
  return ok({ store_id: storeId }, '门店已删除');
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
  if (role !== 1) return fail(403, '仅门店管理员可管理班次');

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
  if (role !== 1) return fail(403, '仅门店管理员可管理班次');

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

/** 严校验非负整数：非法则返回 null；空/未填算 0 */
function parseNonNegInt(raw, maxVal) {
  if (raw == null || raw === '') return 0;
  var n = parseInt(raw, 10);
  if (Number.isNaN(n) || !Number.isFinite(n) || n < 0) return null;
  if (maxVal != null && n > maxVal) return null;
  return n;
}

function parseNonNegFloat(raw, maxVal) {
  if (raw == null || raw === '') return 0;
  var n = parseFloat(raw);
  if (Number.isNaN(n) || !Number.isFinite(n) || n < 0) return null;
  if (maxVal != null && n > maxVal) return null;
  return n;
}

var MAX_QTY = 1000000;
var MAX_CASH = 1000000000;

async function handleAddRecord(openid, payload) {
  var u = await requireUser(openid);
  if (!u) return fail(401, '未登录或用户无效');
  var ctx = await requireActiveStoreId(openid, u);
  if (ctx.err) return ctx.err;
  var storeId = ctx.storeId;

  var recordDate = payload.record_date ? String(payload.record_date).trim() : '';
  var shiftConfigId = parseInt(payload.shift_config_id, 10);
  var qtyOpening = parseNonNegInt(payload.qty_opening, MAX_QTY);
  var qtyClosing = parseNonNegInt(payload.qty_closing, MAX_QTY);
  var qtyGift = parseNonNegInt(payload.qty_gift, MAX_QTY);
  var soldWechat = parseNonNegInt(payload.sold_wechat, MAX_QTY);
  var soldAlipay = parseNonNegInt(payload.sold_alipay, MAX_QTY);
  var soldCash = parseNonNegInt(payload.sold_cash, MAX_QTY);
  var cashOpening = parseNonNegFloat(payload.cash_opening, MAX_CASH);
  var cashClosing = parseNonNegFloat(payload.cash_closing, MAX_CASH);
  if ([qtyOpening, qtyClosing, qtyGift, soldWechat, soldAlipay, soldCash].indexOf(null) !== -1) {
    return fail(400, '件数须为非负整数且不能超过上限');
  }
  if (cashOpening === null || cashClosing === null) {
    return fail(400, '现金金额须为非负数且不能超过上限');
  }

  if (!recordDate || !/^\d{4}-\d{2}-\d{2}$/.test(recordDate)) {
    return fail(400, 'record_date 格式不正确，需要 YYYY-MM-DD');
  }
  if (!shiftConfigId || shiftConfigId <= 0) return fail(400, '请选择有效的班次');

  var cfgQ = await db
    .collection('shift_configs')
    .where({ id: shiftConfigId, store_id: storeId, is_active: 1 })
    .limit(1)
    .get();
  if (!cfgQ.data.length) return fail(400, '所选班次不存在或已停用');

  var stQ = await db.collection('stores').where({ id: storeId }).limit(1).get();
  if (!stQ.data.length) return fail(500, '门店信息不存在');
  var storeDoc = stQ.data[0];
  var storeDbId = storeDoc._id;

  var recName = payload.recorder_name != null ? String(payload.recorder_name).trim() : '';
  if (!recName || recName.length > 32) {
    return fail(400, '请选择或填写记账姓名（1～32 字）');
  }
  var whitelist = Array.isArray(storeDoc.recorder_names) ? storeDoc.recorder_names : [];
  if (whitelist.length > 0 && whitelist.indexOf(recName) < 0) {
    return fail(400, '记账姓名不在本店名单中，请在录入页重新选择或联系管理员维护名单');
  }

  var qtySold = qtyOpening - qtyClosing - qtyGift;
  if (qtySold < 0) qtySold = 0;
  var paymentQty = soldWechat + soldAlipay + soldCash;
  if (paymentQty < 0) paymentQty = 0;
  var unitPrice = ITEM_UNIT_PRICE_JPY;
  var totalRevenue = Math.round(unitPrice * paymentQty * 100) / 100;
  var recordMonth = monthFromDateStr(recordDate);

  /**
   * 与库存管理 current_stock 对齐：
   * - 支付渠道售出 + 赠送；若未填支付但填了盘点，则用 max(盘点售出, 支付合计)+赠送，避免只填上班/下班时不扣库。
   */
  var stockBase = Math.max(qtySold, paymentQty);
  var stockDeduct = stockBase + qtyGift;
  if (stockDeduct < 0) stockDeduct = 0;
  var cashDelta = soldCash * unitPrice;

  /** 确定性 _id：同一 (store, date, shift) 组合下任何并发写入都会命中同一文档，天然防重复录入 */
  var shiftRecDocId = 'sr_' + storeId + '_' + recordDate + '_' + shiftConfigId;

  /** 预分配业务 id（nextSeq 自身事务，不与下面外层事务嵌套） */
  var recordId = await nextSeq('shift_record');
  var needLedger = stockDeduct > 0 || cashDelta !== 0;
  var ledgerId = needLedger ? await nextSeq('stock_ledger') : null;

  var txResult;
  try {
    txResult = await db.runTransaction(async function (tx) {
      /** 同 (店/日/班) 唯一性：事务内检查，保证不会有两个记录并存 */
      try {
        var existing = await tx.collection('shift_records').doc(shiftRecDocId).get();
        if (existing && existing.data) {
          var err = new Error('DUP_RECORD');
          err._user = { code: 400, msg: '该日期该班次已有记录，不能重复录入' };
          throw err;
        }
      } catch (e) {
        if (e && e._user) throw e;
        if (!isDocNotFoundErr(e)) throw e;
      }

      var stSnap = await tx.collection('stores').doc(storeDbId).get();
      if (!stSnap || !stSnap.data) {
        var e2 = new Error('STORE_MISSING');
        e2._user = { code: 500, msg: '门店信息不存在' };
        throw e2;
      }
      var live = stSnap.data;
      var liveStock = live.current_stock != null ? live.current_stock : 0;
      var liveCash = live.current_cash != null ? live.current_cash : 0;
      var nextStockTx = liveStock - stockDeduct;
      if (nextStockTx < 0) nextStockTx = 0;
      var nextCashTx = liveCash + cashDelta;

      await tx.collection('shift_records').doc(shiftRecDocId).set({
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

      if (needLedger) {
        await tx.collection('stores').doc(storeDbId).update({
          data: {
            current_stock: nextStockTx,
            current_cash: nextCashTx,
            updated_at: db.serverDate(),
          },
        });
        await insertStockLedgerEntryTx(
          tx,
          ledgerId,
          storeId,
          u.userId,
          'record_add',
          -stockDeduct,
          nextStockTx,
          cashDelta,
          nextCashTx,
          recordId,
          '记账'
        );
      }

      return { nextStock: nextStockTx, nextCash: nextCashTx };
    });
  } catch (err) {
    if (err && err._user) return fail(err._user.code, err._user.msg);
    console.error('[addRecord] tx failed', err);
    return fail(500, '记账失败，已自动回滚，请稍后重试');
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
      current_stock: txResult.nextStock,
      current_cash: txResult.nextCash,
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
  if (role !== 1) return fail(403, '仅门店管理员可维护记账姓名');

  var nm = payload.name != null ? String(payload.name).trim() : '';
  if (!nm || nm.length > 32) return fail(400, '姓名须为 1～32 个字');
  var stQ = await db.collection('stores').where({ id: storeId }).limit(1).get();
  if (!stQ.data.length) return fail(404, '门店不存在');
  var doc = stQ.data[0];
  var existing = Array.isArray(doc.recorder_names) ? doc.recorder_names : [];
  if (existing.indexOf(nm) >= 0) return fail(400, '该姓名已在列表中');
  if (existing.length >= 50) return fail(400, '最多添加 50 个记账姓名');
  /**
   * 用 _.push 让数据库端做并发安全的数组追加，避免两位管理员同时添加造成覆盖丢失。
   * 重复性检查仍走读取路径，并发极端情况下仍由客户端"已存在"提示弥补。
   */
  await db.collection('stores').doc(doc._id).update({
    data: { recorder_names: _.push([nm]), updated_at: db.serverDate() },
  });
  /** 读回一次以保证返回给客户端的是最新的数组快照 */
  var after = await db.collection('stores').doc(doc._id).get();
  var names = after && after.data && Array.isArray(after.data.recorder_names)
    ? after.data.recorder_names
    : existing.concat([nm]);
  return ok({ recorder_names: names }, '已添加');
}

async function handleRecorderNameDelete(openid, payload) {
  var u = await requireUser(openid);
  if (!u) return fail(401, '未登录或用户无效');
  var ctx = await requireActiveStoreId(openid, u);
  if (ctx.err) return ctx.err;
  var storeId = ctx.storeId;
  var role = await requireStoreMembership(u.userId, storeId);
  if (role !== 1) return fail(403, '仅门店管理员可维护记账姓名');

  var nm = payload.name != null ? String(payload.name).trim() : '';
  if (!nm) return fail(400, '请指定要删除的姓名');
  var stQ = await db.collection('stores').where({ id: storeId }).limit(1).get();
  if (!stQ.data.length) return fail(404, '门店不存在');
  var doc = stQ.data[0];
  var existing = Array.isArray(doc.recorder_names) ? doc.recorder_names : [];
  if (existing.indexOf(nm) < 0) return fail(404, '列表中无此姓名');
  /** _.pull 按值原子删除，避免读改写窗口内其他管理员的新增被覆盖丢失 */
  await db.collection('stores').doc(doc._id).update({
    data: { recorder_names: _.pull(nm), updated_at: db.serverDate() },
  });
  var after = await db.collection('stores').doc(doc._id).get();
  var names = after && after.data && Array.isArray(after.data.recorder_names)
    ? after.data.recorder_names
    : existing.filter(function (x) { return x !== nm; });
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
    current_cash: s.current_cash != null ? s.current_cash : 0,
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
      role_name: row.role === 1 ? '管理员' : row.role === 2 ? '员工' : '成员',
    };
  });
  members.sort(function (a, b) {
    if (a.role !== b.role) return a.role - b.role;
    return a.user_id - b.user_id;
  });
  return ok({ members: members });
}

async function handleOpsAction(openid, payload) {
  var u = await requireUser(openid);
  if (!u) return fail(401, '未登录或用户无效');
  var ctx = await requireActiveStoreId(openid, u);
  if (ctx.err) return ctx.err;
  var storeId = ctx.storeId;
  var role = await requireStoreMembership(u.userId, storeId);
  if (role !== 1) return fail(403, '仅门店管理员可执行此操作');

  var actionType = payload.action_type; // 'restock' | 'withdraw' | 'adjust_stock' | 'adjust_cash'
  var valStock = parseNonNegInt(payload.val_stock, MAX_QTY);
  var valCash = parseNonNegFloat(payload.val_cash, MAX_CASH);
  if (valStock === null) return fail(400, '库存数值须为非负整数且不能超过上限');
  if (valCash === null) return fail(400, '金额须为非负数且不能超过上限');
  var note = payload.note != null ? String(payload.note).trim().slice(0, 200) : '';

  /** 先取 stores 文档的 _id（事务内需要通过 _id 读写） */
  var stQ = await db.collection('stores').where({ id: storeId }).limit(1).get();
  if (!stQ.data.length) return fail(404, '门店不存在');
  var storeDbId = stQ.data[0]._id;

  /** 允许的 action 与默认备注；事务外完成基础规则检查，避免无意义的 nextSeq 浪费 */
  if (['restock', 'withdraw', 'adjust_stock', 'adjust_cash'].indexOf(actionType) < 0) {
    return fail(400, '未知的操作类型');
  }
  if (actionType === 'restock' && valStock <= 0) return fail(400, '补货数量须大于 0');
  if (actionType === 'withdraw' && valCash <= 0) return fail(400, '取现金额须大于 0');

  var ledgerId = await nextSeq('stock_ledger');

  var txResult;
  try {
    txResult = await db.runTransaction(async function (tx) {
      var stSnap = await tx.collection('stores').doc(storeDbId).get();
      if (!stSnap || !stSnap.data) {
        var miss = new Error('STORE_MISSING');
        miss._user = { code: 404, msg: '门店不存在' };
        throw miss;
      }
      var liveStock = stSnap.data.current_stock != null ? stSnap.data.current_stock : 0;
      var liveCash = stSnap.data.current_cash != null ? stSnap.data.current_cash : 0;

      var nextStock = liveStock;
      var nextCash = liveCash;
      var deltaStock = 0;
      var deltaCash = 0;
      var defaultNote = '';
      var eventType = actionType;

      if (actionType === 'restock') {
        /** 进货货款走店外资金，不记入门店现金流；val_cash 忽略 */
        deltaStock = valStock;
        nextStock = liveStock + deltaStock;
        defaultNote = '补货 +' + valStock;
      } else if (actionType === 'withdraw') {
        if (valCash > liveCash) {
          var ne = new Error('CASH_INSUFFICIENT');
          ne._user = { code: 400, msg: '取现金额超过当前现金余额' };
          throw ne;
        }
        deltaCash = -valCash;
        nextCash = liveCash + deltaCash;
        defaultNote = '取现 -' + valCash;
      } else if (actionType === 'adjust_stock') {
        deltaStock = valStock - liveStock;
        nextStock = valStock;
        defaultNote = '库存校准';
        if (deltaStock === 0) {
          return { nextStock: liveStock, nextCash: liveCash, deltaStock: 0, deltaCash: 0, skipped: true };
        }
      } else if (actionType === 'adjust_cash') {
        deltaCash = valCash - liveCash;
        nextCash = valCash;
        defaultNote = '现金校准';
        if (deltaCash === 0) {
          return { nextStock: liveStock, nextCash: liveCash, deltaStock: 0, deltaCash: 0, skipped: true };
        }
      }

      await tx.collection('stores').doc(storeDbId).update({
        data: {
          current_stock: nextStock,
          current_cash: nextCash,
          updated_at: db.serverDate(),
        },
      });
      await insertStockLedgerEntryTx(
        tx,
        ledgerId,
        storeId,
        u.userId,
        eventType,
        deltaStock,
        nextStock,
        deltaCash,
        nextCash,
        null,
        note || defaultNote
      );

      return { nextStock: nextStock, nextCash: nextCash, deltaStock: deltaStock, deltaCash: deltaCash, skipped: false };
    });
  } catch (err) {
    if (err && err._user) return fail(err._user.code, err._user.msg);
    console.error('[handleOpsAction] tx failed', err);
    return fail(500, '操作失败，已自动回滚，请稍后重试');
  }

  if (txResult.skipped) {
    return ok(
      { current_stock: txResult.nextStock, current_cash: txResult.nextCash },
      actionType === 'adjust_stock' ? '库存未变化' : '现金未变化'
    );
  }
  return ok({
    current_stock: txResult.nextStock,
    current_cash: txResult.nextCash,
    delta_stock: txResult.deltaStock,
    delta_cash: txResult.deltaCash,
  }, '操作成功');
}

async function handleStockLedgerList(openid, payload) {
  var u = await requireUser(openid);
  if (!u) return fail(401, '未登录或用户无效');
  var ctx = await requireActiveStoreId(openid, u);
  if (ctx.err) return ctx.err;
  var storeId = ctx.storeId;
  var mem = await requireStoreMembership(u.userId, storeId);
  if (mem == null) return fail(403, '无权查看该门店');
  var lim = parseInt(payload && payload.limit, 10) || 50;
  if (lim < 1 || lim > 100) lim = 50;
  /**
   * cursor：上一页最后一条流水的 id（前端直接透传），按 id 严格小于它继续取下一页。
   * 这是"按 id 降序游标"的标准翻页，不会因新增流水造成错位。
   */
  var cursor = payload && payload.cursor != null ? parseInt(payload.cursor, 10) : NaN;
  var whereClause = { store_id: storeId };
  if (!Number.isNaN(cursor) && cursor > 0) {
    whereClause.id = _.lt(cursor);
  }
  var rows;
  try {
    var q = await db
      .collection('store_stock_ledger')
      .where(whereClause)
      .orderBy('id', 'desc')
      .limit(lim)
      .get();
    rows = q.data || [];
  } catch (e) {
    console.error('[stockLedgerList] orderBy query failed, fallback', e);
    var q2 = await db
      .collection('store_stock_ledger')
      .where({ store_id: storeId })
      .limit(500)
      .get();
    var arr = (q2.data || []).slice().sort(function (a, b) {
      return (b.id || 0) - (a.id || 0);
    });
    if (!Number.isNaN(cursor) && cursor > 0) {
      arr = arr.filter(function (r) { return (r.id || 0) < cursor; });
    }
    rows = arr.slice(0, lim);
  }
  /**
   * 批量 join 三件事，让每条流水直接带上「谁在什么班次做了什么」，
   * 便于管理员回头按班次排查库存/现金对不上的原因。
   * 1) ref_record_id → shift_records 得到 (record_date, shift_config_id)
   * 2) shift_config_id → shift_configs 得到班次名
   * 3) created_by → users 得到操作人昵称
   */
  var refIdSet = {};
  for (var ri = 0; ri < rows.length; ri++) {
    var rid = rows[ri].ref_record_id;
    if (rid != null && !Number.isNaN(parseInt(rid, 10))) {
      refIdSet[parseInt(rid, 10)] = true;
    }
  }
  var refIds = Object.keys(refIdSet).map(function (x) { return parseInt(x, 10); });
  var recByRef = {};
  var cfgIdSet = {};
  for (var rc = 0; rc < refIds.length; rc += 10) {
    var rchunk = refIds.slice(rc, rc + 10);
    if (!rchunk.length) break;
    var rq = await db.collection('shift_records').where({ id: _.in(rchunk) }).get();
    for (var ri2 = 0; ri2 < rq.data.length; ri2++) {
      var srow = rq.data[ri2];
      recByRef[srow.id] = srow;
      if (srow.shift_config_id != null) cfgIdSet[srow.shift_config_id] = true;
    }
  }
  var cfgIds = Object.keys(cfgIdSet).map(function (x) { return parseInt(x, 10); });
  var cfgMap = {};
  for (var cc = 0; cc < cfgIds.length; cc += 10) {
    var cchunk = cfgIds.slice(cc, cc + 10);
    if (!cchunk.length) break;
    var cq = await db.collection('shift_configs').where({ id: _.in(cchunk) }).get();
    for (var ci2 = 0; ci2 < cq.data.length; ci2++) {
      cfgMap[cq.data[ci2].id] = cq.data[ci2];
    }
  }
  var opIdSet = {};
  for (var oi = 0; oi < rows.length; oi++) {
    var cb = rows[oi].created_by;
    if (cb != null && !Number.isNaN(parseInt(cb, 10))) {
      opIdSet[parseInt(cb, 10)] = true;
    }
  }
  var opIds = Object.keys(opIdSet).map(function (x) { return parseInt(x, 10); });
  var opMap = {};
  for (var oc = 0; oc < opIds.length; oc += 10) {
    var ochunk = opIds.slice(oc, oc + 10);
    if (!ochunk.length) break;
    var oq = await db.collection('users').where({ userId: _.in(ochunk) }).get();
    for (var oi2 = 0; oi2 < oq.data.length; oi2++) {
      opMap[oq.data[oi2].userId] = oq.data[oi2].nickname || '';
    }
  }

  var items = rows.map(function (row) {
    var shiftDate = '';
    var shiftName = '';
    var recName = '';
    if (row.ref_record_id != null) {
      var linked = recByRef[parseInt(row.ref_record_id, 10)];
      if (linked) {
        shiftDate = linked.record_date || '';
        var cfg = cfgMap[linked.shift_config_id];
        shiftName = cfg && cfg.name ? cfg.name : '';
        recName = linked.recorder_name || '';
      }
    }
    return {
      id: row.id,
      event_type: row.event_type,
      delta: row.delta || 0,
      balance_after: row.balance_after != null ? row.balance_after : 0,
      cash_delta: row.cash_delta || 0,
      cash_balance_after: row.cash_balance_after != null ? row.cash_balance_after : 0,
      ref_record_id: row.ref_record_id != null ? row.ref_record_id : null,
      note: row.note || '',
      time_display: formatLedgerEntryTime(row.created_at),
      shift_date: shiftDate,
      shift_name: shiftName,
      recorder_name: recName,
      operator_name: opMap[row.created_by] || '',
    };
  });
  var nextCursor = rows.length === lim ? (rows[rows.length - 1].id || null) : null;
  return ok({ items: items, next_cursor: nextCursor, has_more: !!nextCursor }, 'success');
}

async function handleStockAdjust(openid, payload) {
  var u = await requireUser(openid);
  if (!u) return fail(401, '未登录或用户无效');
  var ctx = await requireActiveStoreId(openid, u);
  if (ctx.err) return ctx.err;
  var storeId = ctx.storeId;
  var role = await requireStoreMembership(u.userId, storeId);
  if (role !== 1) return fail(403, '仅门店管理员可校准库存');
  var target = parseNonNegInt(payload && payload.target_stock, MAX_QTY);
  if (target === null) {
    return fail(400, '实盘库存须为非负整数且不能超过上限');
  }
  var noteIn = payload && payload.note != null ? String(payload.note).trim().slice(0, 200) : '';

  var stQ = await db.collection('stores').where({ id: storeId }).limit(1).get();
  if (!stQ.data.length) return fail(404, '门店不存在');
  var storeDbId = stQ.data[0]._id;

  var ledgerId = await nextSeq('stock_ledger');
  var noteOut = noteIn || '库存校准';

  var txResult;
  try {
    txResult = await db.runTransaction(async function (tx) {
      var snap = await tx.collection('stores').doc(storeDbId).get();
      if (!snap || !snap.data) {
        var miss = new Error('STORE_MISSING');
        miss._user = { code: 404, msg: '门店不存在' };
        throw miss;
      }
      var cur = snap.data.current_stock != null ? snap.data.current_stock : 0;
      var curCashForLedger = snap.data.current_cash != null ? snap.data.current_cash : 0;
      var delta = target - cur;
      if (delta === 0) {
        return { skipped: true, current_stock: cur, delta: 0 };
      }
      await tx.collection('stores').doc(storeDbId).update({
        data: { current_stock: target, updated_at: db.serverDate() },
      });
      await insertStockLedgerEntryTx(
        tx,
        ledgerId,
        storeId,
        u.userId,
        'adjust_stock',
        delta,
        target,
        0,
        curCashForLedger,
        null,
        noteOut
      );
      return { skipped: false, current_stock: target, delta: delta };
    });
  } catch (err) {
    if (err && err._user) return fail(err._user.code, err._user.msg);
    console.error('[stockAdjust] tx failed', err);
    return fail(500, '校准失败，已自动回滚，请稍后重试');
  }

  if (txResult.skipped) {
    return ok({ current_stock: txResult.current_stock, skipped: true, delta: 0 }, '库存未变化');
  }
  return ok({ current_stock: txResult.current_stock, delta: txResult.delta }, '校准成功');
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
    return fail(403, '仅记录人或管理员可修改');
  }

  var recordDate = payload.record_date ? String(payload.record_date).trim() : '';
  var shiftConfigId = parseInt(payload.shift_config_id, 10);
  var qtyOpening = parseNonNegInt(payload.qty_opening, MAX_QTY);
  var qtyClosing = parseNonNegInt(payload.qty_closing, MAX_QTY);
  var qtyGift = parseNonNegInt(payload.qty_gift, MAX_QTY);
  var soldWechat = parseNonNegInt(payload.sold_wechat, MAX_QTY);
  var soldAlipay = parseNonNegInt(payload.sold_alipay, MAX_QTY);
  var soldCash = parseNonNegInt(payload.sold_cash, MAX_QTY);
  var cashOpening = parseNonNegFloat(payload.cash_opening, MAX_CASH);
  var cashClosing = parseNonNegFloat(payload.cash_closing, MAX_CASH);
  if ([qtyOpening, qtyClosing, qtyGift, soldWechat, soldAlipay, soldCash].indexOf(null) !== -1) {
    return fail(400, '件数须为非负整数且不能超过上限');
  }
  if (cashOpening === null || cashClosing === null) {
    return fail(400, '现金金额须为非负数且不能超过上限');
  }

  if (!recordDate || !/^\d{4}-\d{2}-\d{2}$/.test(recordDate)) {
    return fail(400, 'record_date 格式不正确');
  }
  if (!shiftConfigId || shiftConfigId <= 0) return fail(400, '请选择有效的班次');

  var cfgQ = await db
    .collection('shift_configs')
    .where({ id: shiftConfigId, store_id: storeId, is_active: 1 })
    .limit(1)
    .get();
  if (!cfgQ.data.length) return fail(400, '所选班次不存在或已停用');

  var stQ = await db.collection('stores').where({ id: storeId }).limit(1).get();
  if (!stQ.data.length) return fail(500, '门店信息不存在');
  var storeDbId = stQ.data[0]._id;
  var whitelist = Array.isArray(stQ.data[0].recorder_names) ? stQ.data[0].recorder_names : [];

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
  if (whitelist.length > 0 && whitelist.indexOf(recName) < 0) {
    return fail(400, '记账姓名不在本店名单中');
  }

  var qtySold = qtyOpening - qtyClosing - qtyGift;
  if (qtySold < 0) qtySold = 0;
  var paymentQty = soldWechat + soldAlipay + soldCash;
  if (paymentQty < 0) paymentQty = 0;
  /**
   * 修改记录时使用原记录的 unit_price：
   * - 不因后续单价调整而让历史记录「金额被重估」
   * - 保证 oldCashDelta 与 newCashDelta 使用同一单价，对 current_cash 的增减自洽
   */
  var unitPrice = (oldRow.unit_price != null && !Number.isNaN(parseFloat(oldRow.unit_price)))
    ? parseFloat(oldRow.unit_price)
    : ITEM_UNIT_PRICE_JPY;
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
  var oldCashDelta = (oldRow.sold_cash || 0) * unitPrice;
  var newCashDelta = soldCash * unitPrice;
  var stockDelta = oldDeduct - newDeduct;
  var cashDelta = newCashDelta - oldCashDelta;
  var needLedger = stockDelta !== 0 || cashDelta !== 0;

  var ledgerId = needLedger ? await nextSeq('stock_ledger') : null;

  var txResult;
  try {
    txResult = await db.runTransaction(async function (tx) {
      var stSnap = await tx.collection('stores').doc(storeDbId).get();
      if (!stSnap || !stSnap.data) {
        var miss = new Error('STORE_MISSING');
        miss._user = { code: 500, msg: '门店信息不存在' };
        throw miss;
      }
      var liveStock = stSnap.data.current_stock != null ? stSnap.data.current_stock : 0;
      var liveCash = stSnap.data.current_cash != null ? stSnap.data.current_cash : 0;
      var nextStock = liveStock + stockDelta;
      if (nextStock < 0) nextStock = 0;
      var nextCash = liveCash + cashDelta;

      await tx.collection('shift_records').doc(oldDocId).update({
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

      if (needLedger) {
        await tx.collection('stores').doc(storeDbId).update({
          data: { current_stock: nextStock, current_cash: nextCash, updated_at: db.serverDate() },
        });
        await insertStockLedgerEntryTx(
          tx,
          ledgerId,
          storeId,
          u.userId,
          'record_update',
          stockDelta,
          nextStock,
          cashDelta,
          nextCash,
          recordId,
          '修改记账'
        );
      }

      return { nextStock: nextStock, nextCash: nextCash };
    });
  } catch (err) {
    if (err && err._user) return fail(err._user.code, err._user.msg);
    console.error('[updateRecord] tx failed', err);
    return fail(500, '保存失败，已自动回滚，请稍后重试');
  }

  return ok(
    {
      id: recordId,
      record_date: recordDate,
      stock_deduct: newDeduct,
      current_stock: txResult.nextStock,
      current_cash: txResult.nextCash,
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
    return fail(403, '仅管理员可移除其他成员');
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
      return fail(400, '门店至少保留一名管理员');
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
  if (callerRole !== 1) return fail(403, '仅管理员可调整角色');

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
      return fail(400, '门店至少保留一名管理员');
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
    };
    if (ACTION_ALIASES[action]) {
      action = ACTION_ALIASES[action];
    }

    var sessionErr = await validateSession(OPENID, payload, action);
    if (sessionErr) return sessionErr;

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
      case 'storeUpdate':
        return await handleStoreUpdate(OPENID, payload);
      case 'storeDelete':
        return await handleStoreDelete(OPENID, payload);
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
      case 'updateProfile':
        return await handleUpdateProfile(OPENID, payload);
      case 'stockLedgerList':
        return await handleStockLedgerList(OPENID, payload);
      case 'stockAdjust':
        return await handleStockAdjust(OPENID, payload);
      case 'opsAction':
        return await handleOpsAction(OPENID, payload);
      default:
        return fail(400, '请求参数不正确');
    }
  } catch (e) {
    console.error(e);
    /** 对外返回泛化信息，内部错误细节仅在日志中保留，避免通过文案泄露实现 */
    return fail(500, '服务器错误，请稍后重试');
  }
};
