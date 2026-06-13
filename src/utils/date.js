// src/utils/date.js — 日期工具函数

/**
 * 格式化日期为显示字符串
 */
export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/**
 * 计算两个日期之间的天数差
 */
export function daysBetween(a, b) {
  const d1 = new Date(a);
  const d2 = new Date(b);
  return Math.ceil((d2 - d1) / (1000 * 60 * 60 * 24));
}

/**
 * 判断日期是否已到期
 */
export function isExpired(dateStr) {
  return daysBetween(new Date().toISOString(), dateStr) <= 0;
}

/**
 * 计算距到期日的天数（负数=已过期）
 */
export function daysUntil(dateStr) {
  return daysBetween(new Date().toISOString(), dateStr);
}

/**
 * 农历转阳历的占位函数（需集成 lunar-javascript 等库）
 * 当前直接返回日期，不做转换
 */
export function lunarToSolar(dateStr) {
  // TODO: 集成农历库进行转换
  return dateStr ? new Date(dateStr) : null;
}
