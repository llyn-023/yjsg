// src/models/family-relation.js — 基础关系边数据模型
// 对应规格：家谱关系系统 §2.2 family_relation 表
// 只存两种边：parent_of 和 spouse_of

/**
 * @typedef {'parent_of' | 'spouse_of'} RelationType
 *
 * @typedef {Object} FamilyRelation
 * @property {string}       id            - UUID
 * @property {string}       familyId      - 所属家族 ID
 * @property {RelationType} relationType  - parent_of | spouse_of
 * @property {string}       fromNodeId    - parent_of: 父/母；spouse_of: 任意一方
 * @property {string}       toNodeId      - parent_of: 子女；spouse_of: 另一方
 */

/**
 * 创建一条关系边
 */
export function createRelation({
  id, familyId, relationType,
  fromNodeId, toNodeId,
}) {
  return {
    id, familyId, relationType,
    fromNodeId, toNodeId,
    createdAt: new Date().toISOString(),
  };
}

/**
 * 获取某节点的父母
 */
export function getParents(relations, nodeId) {
  return relations
    .filter(r => r.relationType === 'parent_of' && r.toNodeId === nodeId)
    .map(r => r.fromNodeId);
}

/**
 * 获取某节点的子女
 */
export function getChildren(relations, nodeId) {
  return relations
    .filter(r => r.relationType === 'parent_of' && r.fromNodeId === nodeId)
    .map(r => r.toNodeId);
}

/**
 * 获取某节点的配偶
 */
export function getSpouse(relations, nodeId) {
  const rel = relations.find(r =>
    r.relationType === 'spouse_of' &&
    (r.fromNodeId === nodeId || r.toNodeId === nodeId)
  );
  if (!rel) return null;
  return rel.fromNodeId === nodeId ? rel.toNodeId : rel.fromNodeId;
}

/**
 * 获取某节点的兄弟姐妹（同父母）
 */
export function getSiblings(relations, nodeId) {
  const parents = getParents(relations, nodeId);
  if (parents.length === 0) return [];
  const siblings = new Set();
  for (const pId of parents) {
    const children = getChildren(relations, pId);
    children.forEach(c => { if (c !== nodeId) siblings.add(c); });
  }
  return [...siblings];
}
