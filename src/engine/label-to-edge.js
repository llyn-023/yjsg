// src/engine/label-to-edge.js — 6 种定位关系 → 基础边转换
// 对应规格：家谱关系系统 §4.2 / §14.2

/**
 * @typedef {'父亲' | '母亲' | '儿子' | '女儿' | '丈夫' | '妻子'} RelationshipLabel
 */

/**
 * 将用户的定位声明转换为基础关系边
 * @param {string} egoId           - 用户节点 ID
 * @param {string} targetId        - 目标节点 ID
 * @param {'male' | 'female'} egoGender - 用户性别
 * @param {RelationshipLabel} label - 定位关系
 * @returns {{ relationType: 'parent_of' | 'spouse_of', from: string, to: string, targetGender: 'male' | 'female' }}
 */
export function labelToEdge(egoId, targetId, egoGender, label) {
  switch (label) {
    case '父亲':
      return { relationType: 'parent_of', from: targetId, to: egoId, targetGender: 'male' };
    case '母亲':
      return { relationType: 'parent_of', from: targetId, to: egoId, targetGender: 'female' };
    case '儿子':
      return { relationType: 'parent_of', from: egoId, to: targetId, targetGender: 'male' };
    case '女儿':
      return { relationType: 'parent_of', from: egoId, to: targetId, targetGender: 'female' };
    case '丈夫':
      return { relationType: 'spouse_of', from: egoId, to: targetId, targetGender: 'male' };
    case '妻子':
      return { relationType: 'spouse_of', from: egoId, to: targetId, targetGender: 'female' };
    default:
      throw new Error(`Unknown relationship label: ${label}`);
  }
}

/**
 * 性别校验：用户性别与所选关系是否兼容
 */
export function validateGenderCompatibility(egoGender, label) {
  if (egoGender === 'male' && label === '丈夫') return false;
  if (egoGender === 'female' && label === '妻子') return false;
  return true;
}

/**
 * 获取指定性别可用的关系标签
 */
export function getAvailableLabels(egoGender) {
  const all = ['父亲', '母亲', '儿子', '女儿', '丈夫', '妻子'];
  return all.filter(l => validateGenderCompatibility(egoGender, l));
}

/** 所有 6 种关系标签 */
export const RELATIONSHIP_LABELS = ['父亲', '母亲', '儿子', '女儿', '丈夫', '妻子'];
