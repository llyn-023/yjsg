// src/engine/age-compare.js — 长幼排序算法
// 对应规格：家谱关系系统 §7
//
// 比较规则（优先级从高到低）：
//   1. 双方都有完整 birth_date → 比较日期，日期小的（先出生）年长
//   2. 一方有，另一方无 → 有日期的视为年长
//   3. 双方都无任何出生信息 → 按 createdAt 加入时间，先加入的年长

import { lunarToSolar } from '../utils/date.js';

/**
 * @typedef {'ego_older' | 'peer_older' | 'unknown'} AgeResult
 */

/**
 * 标准化出生日期（农历转阳历）
 */
function normalizeBirthDate(member) {
  if (!member.birthDate) return null;
  if (member.birthType === 'lunar') {
    return lunarToSolar(member.birthDate);
  }
  const d = new Date(member.birthDate);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * 比较 ego 和 peer 的长幼
 * @param {Object} ego  - FamilyMember（含 birthDate, birthType, createdAt）
 * @param {Object} peer - FamilyMember
 * @returns {AgeResult}
 */
export function compareAge(ego, peer) {
  const egoDate = normalizeBirthDate(ego);
  const peerDate = normalizeBirthDate(peer);

  // 双方都有完整日期 → 比较日期
  if (egoDate && peerDate) {
    return egoDate < peerDate ? 'ego_older' : 'peer_older';
  }

  // 一方有，另一方无 → 有日期的一方年长
  if (egoDate && !peerDate) return 'ego_older';
  if (!egoDate && peerDate) return 'peer_older';

  // 双方都无 → 按加入时间
  const egoCreated = new Date(ego.createdAt || 0);
  const peerCreated = new Date(peer.createdAt || 0);

  if (isNaN(egoCreated.getTime()) || isNaN(peerCreated.getTime())) {
    return 'unknown';
  }

  return egoCreated < peerCreated ? 'ego_older' : 'peer_older';
}

/**
 * 比较两个人相对于第三方的年龄（如"伯父 vs 叔叔"——看 TA 与我父亲谁年长）
 * @param {Object} target     - 要比较的人
 * @param {Object} reference  - 参照人（如我父亲）
 * @returns {AgeResult}
 */
export function compareAgeToReference(target, reference) {
  return compareAge(reference, target); // reference 年长 → 'ego_older' 即 target 年幼
}

/**
 * 根据年龄比较结果获取同辈长幼称谓后缀
 * @param {'male' | 'female'} gender
 * @param {AgeResult} ageResult
 * @returns {[string, string]} [我年长时的称谓, TA年长时的称谓]
 *    如: male → ['弟', '兄']
 */
export function getSiblingSuffix(gender, ageResult) {
  if (ageResult === 'peer_older') {
    // TA 年长
    return gender === 'male' ? ['弟', '兄'] : ['妹', '姐'];
  } else {
    // 我年长或未知
    return gender === 'male' ? ['兄', '弟'] : ['姐', '妹'];
  }
}

/**
 * 伯/叔 判定：看父亲的兄弟相对于父亲的长幼
 */
export function classifyBoShu(father, uncle) {
  const result = compareAgeToReference(uncle, father);
  return result === 'peer_older' ? '叔叔' : '伯父';
}
