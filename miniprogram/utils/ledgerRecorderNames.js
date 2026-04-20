/**
 * 记账人姓名：门店维度本地记忆 key、列表解析与选中索引（录入页 / 班次详情内联编辑共用）
 */
var storeUtil = require('./store');

function storageKey(userInfo) {
  var u = userInfo || {};
  var sid = storeUtil.getStoreIdFromUserInfo(u);
  return sid ? 'ledger_recorder_' + sid : 'ledger_recorder';
}

function defaultNickname(userInfo) {
  var u = userInfo || {};
  return (u.nickname && String(u.nickname).trim()) || '员工';
}

function namesFromDetail(detail) {
  var raw = detail && detail.recorder_names;
  var list = [];
  if (!Array.isArray(raw)) {
    return list;
  }
  for (var j = 0; j < raw.length; j++) {
    var one = raw[j];
    if (one == null) continue;
    var t = String(one).trim();
    if (t) list.push(t);
  }
  return list;
}

/**
 * @param {object} opts
 * @param {object} [opts.detail] store_detail 响应
 * @param {object} opts.userInfo
 * @param {string} [opts.ensureName] 若不在列表中则置于首位（如当前记录记账人）
 * @returns {{ list: string[], savedKey: string }}
 */
function buildRecorderNameList(opts) {
  var detail = opts.detail || {};
  var u = opts.userInfo || {};
  var list = namesFromDetail(detail);
  var ensureName = opts.ensureName != null ? String(opts.ensureName).trim() : '';
  if (ensureName && list.indexOf(ensureName) < 0) {
    list = [ensureName].concat(list);
  }
  if (!list.length) {
    list = [defaultNickname(u)];
  }
  return { list: list, savedKey: storageKey(u) };
}

/**
 * @param {string[]} list
 * @param {string} saved 本地缓存中选中的姓名
 * @param {string} [preferredName] 优先选中（如记录上的记账人）
 */
function pickRecorderIndex(list, saved, preferredName) {
  var idx = 0;
  var i;
  for (i = 0; i < list.length; i++) {
    if (list[i] === saved) {
      idx = i;
      break;
    }
  }
  if (preferredName) {
    var nm = String(preferredName).trim();
    if (nm) {
      var hit = list.indexOf(nm);
      if (hit >= 0) idx = hit;
    }
  }
  var display = list[idx] || list[0] || '';
  return { index: idx, display: display };
}

/**
 * 在已有列表上确保某姓名出现（用于编辑回填，避免 picker range 缺项）
 * @param {string[]|null|undefined} baseList
 * @param {string|null|undefined} name
 * @returns {string[]}
 */
function listWithEnsuredName(baseList, name) {
  var list = Array.isArray(baseList) ? baseList.slice() : [];
  var nm = name != null ? String(name).trim() : '';
  if (nm && list.indexOf(nm) < 0) {
    list.unshift(nm);
  }
  return list;
}

module.exports = {
  storageKey: storageKey,
  defaultNickname: defaultNickname,
  namesFromDetail: namesFromDetail,
  buildRecorderNameList: buildRecorderNameList,
  pickRecorderIndex: pickRecorderIndex,
  listWithEnsuredName: listWithEnsuredName
};
