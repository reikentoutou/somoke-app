/**
 * 通用工具函数
 */

/**
 * 格式化日期为 YYYY-MM-DD
 */
function formatDate(date) {
  const d = date || new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return y + '-' + m + '-' + day;
}

/**
 * 格式化月份为 YYYY-MM
 */
function formatMonth(date) {
  const d = date || new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return y + '-' + m;
}

/**
 * 金额格式化: 12840 → "12,840.00"
 */
function formatMoney(amount) {
  const num = parseFloat(amount) || 0;
  return num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** 日元整数展示：90000 → "90,000" */
function formatJpy(amount) {
  const n = Math.round(parseFloat(amount) || 0);
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * 获取星期几（中文）
 */
function getWeekday(dateStr) {
  const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return days[new Date(dateStr).getDay()];
}

/**
 * 设置导航栏标题；个别场景（如分享中、组件未渲染完成）调用会抛错，统一 try/catch
 */
function setNavBarTitleSafe(title) {
  try {
    wx.setNavigationBarTitle({ title: title });
  } catch (e) {
    /* ignore */
  }
}

module.exports = {
  formatDate,
  formatMonth,
  formatMoney,
  formatJpy,
  getWeekday,
  setNavBarTitleSafe
};
