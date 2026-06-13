// src/engine/tang-biao.js — 堂/表判定算法
// 对应规格：家谱关系系统 §6（核心）
//
// 核心原则：
//   堂亲：我和 TA 的父亲是亲兄弟（同祖父、纯父系血脉）
//   表亲：其余所有同辈旁系（姑表 / 舅表 / 姨表统一）
//
// 判定标准：
//   两条血脉路径（LCA→ego、LCA→peer）都全程父→子 → 堂
//   任一条中途经过女性 → 表

import { findLCA, pathFromAncestor } from './relation-graph.js';

/**
 * @typedef {'tang' | 'biao'} CousinClass
 */

/**
 * 判定 ego 和 peer（同辈旁系）是堂亲还是表亲
 * @param {Object} graph   - RelationGraph
 * @param {string} egoId
 * @param {string} peerId
 * @returns {CousinClass}
 */
export function classifyCousin(graph, egoId, peerId) {
  // 1. 找最近共同祖先
  const lca = findLCA(graph, egoId, peerId);
  if (!lca) return 'biao'; // 无共同祖先，表亲兜底

  // 2. 取 LCA → ego 和 LCA → peer 两条路径
  const pathToEgo = pathFromAncestor(graph, lca, egoId);
  const pathToPeer = pathFromAncestor(graph, lca, peerId);

  // 3. 检查两条路径是否"全程父→子"
  //    路径上每一节的 parent_of 边，from 节点都是男性（父亲）
  const allPatriarch = (path) =>
    path.length > 0 && path.every(step =>
      step.direction === 'down' &&
      step.parentNode &&
      step.parentNode.gender === 'male'
    );

  // 4. 两条都纯父系 → 堂；否则 → 表
  return (allPatriarch(pathToEgo) && allPatriarch(pathToPeer)) ? 'tang' : 'biao';
}

/**
 * 获取同辈旁系的完整称谓（含长幼）
 * @param {CousinClass} cousinClass
 * @param {'male' | 'female'} targetGender
 * @param {'ego_older' | 'peer_older' | 'unknown'} ageResult
 * @returns {string} 如 "堂兄"、"表妹"
 */
export function getCousinTerm(cousinClass, targetGender, ageResult) {
  const prefix = cousinClass === 'tang' ? '堂' : '表';

  if (ageResult === 'peer_older') {
    // TA 年长于我
    return prefix + (targetGender === 'male' ? '兄' : '姐');
  } else {
    // 我年长于 TA（或未知）
    return prefix + (targetGender === 'male' ? '弟' : '妹');
  }
}

/**
 * 判断两个同辈旁系是否有共同祖父（传统堂亲判定）
 * 保留作为交叉验证
 */
export function hasSameGrandfather(graph, egoId, peerId) {
  const lca = findLCA(graph, egoId, peerId);
  if (!lca) return false;
  const lcaNode = graph.nodes.get(lca);
  return lcaNode?.gender === 'male';
}
