// src/engine/relation-graph.js — 关系图构建与 BFS 最短路径查找
// 对应规格：家谱关系系统 §5.2 / §5.3

/**
 * @typedef {Object} GraphNode
 * @property {'male' | 'female'} gender
 * @property {Date|null}          birthDate
 * @property {'solar' | 'lunar'}  birthType
 *
 * @typedef {Object} GraphEdge
 * @property {string}         target      - 目标节点 ID
 * @property {'parent_of' | 'spouse_of'} type
 * @property {'up' | 'down' | 'side'}    direction
 * @property {'male' | 'female'| null}   parentGender - 仅 direction='up' 时有效
 *
 * @typedef {Object} RelationGraph
 * @property {Map<string, GraphNode>} nodes
 * @property {Map<string, GraphEdge[]>} edges
 */

/**
 * 从成员列表和关系列表构建关系图
 * @param {Array} members   - FamilyMember[]
 * @param {Array} relations - FamilyRelation[]
 * @returns {RelationGraph}
 */
export function buildGraph(members, relations) {
  const nodes = new Map();
  const edges = new Map();

  // 初始化节点
  for (const m of members) {
    nodes.set(m.id, {
      gender: m.gender,
      birthDate: m.birthDate ? new Date(m.birthDate) : null,
      birthType: m.birthType || 'solar',
    });
    edges.set(m.id, []);
  }

  // 添加边
  for (const r of relations) {
    const fromNode = nodes.get(r.fromNodeId);
    const toNode = nodes.get(r.toNodeId);
    if (!fromNode || !toNode) continue;

    if (r.relationType === 'parent_of') {
      // parent_of(A, B): A 是 B 的父/母
      // B→A: up（从子女到父母）
      edges.get(r.toNodeId).push({
        target: r.fromNodeId,
        type: 'parent_of',
        direction: 'up',
        parentGender: fromNode.gender,
      });
      // A→B: down（从父母到子女）
      edges.get(r.fromNodeId).push({
        target: r.toNodeId,
        type: 'parent_of',
        direction: 'down',
        parentGender: null,
      });
    } else if (r.relationType === 'spouse_of') {
      // spouse_of(A, B): 双向 side
      edges.get(r.fromNodeId).push({
        target: r.toNodeId,
        type: 'spouse_of',
        direction: 'side',
        parentGender: null,
      });
      edges.get(r.toNodeId).push({
        target: r.fromNodeId,
        type: 'spouse_of',
        direction: 'side',
        parentGender: null,
      });
    }
  }

  return { nodes, edges };
}

/**
 * @typedef {Object} PathStep
 * @property {'up' | 'down' | 'side'} direction
 * @property {string}         nodeId
 * @property {'male' | 'female'} gender
 * @property {Date|null}      birthDate
 * @property {'male' | 'female' | null} parentGender
 */

/**
 * BFS 查找最短路径（血亲优先）
 * @param {RelationGraph} graph
 * @param {string} egoId
 * @param {string} alterId
 * @returns {PathStep[] | null}
 */
export function findShortestPath(graph, egoId, alterId) {
  if (egoId === alterId) return [];

  const visited = new Set([egoId]);
  const queue = [{
    nodeId: egoId,
    path: [],
  }];

  let bestPath = null;
  let bestSpouseCount = Infinity;

  while (queue.length > 0) {
    const { nodeId, path } = queue.shift();

    const neighbors = graph.edges.get(nodeId) || [];
    for (const edge of neighbors) {
      if (visited.has(edge.target) && edge.target !== alterId) continue;

      const newNode = graph.nodes.get(edge.target);
      if (!newNode) continue;

      const step = {
        direction: edge.direction,
        nodeId: edge.target,
        gender: newNode.gender,
        birthDate: newNode.birthDate,
        parentGender: edge.parentGender || null,
      };

      const newPath = [...path, step];

      if (edge.target === alterId) {
        const spouseCount = newPath.filter(s => s.direction === 'side').length;
        if (spouseCount < bestSpouseCount) {
          bestPath = newPath;
          bestSpouseCount = spouseCount;
        }
        continue;
      }

      visited.add(edge.target);
      queue.push({ nodeId: edge.target, path: newPath });
    }
  }

  return bestPath;
}

/**
 * 找最近共同祖先（LCA）
 */
export function findLCA(graph, egoId, peerId) {
  const ancestorsEgo = getAllAncestors(graph, egoId);
  const ancestorsPeer = getAllAncestors(graph, peerId);

  // 找最近的（路径最短的）共同祖先
  let bestLCA = null;
  let bestDistance = Infinity;

  for (const [ancId, egoDist] of ancestorsEgo.entries()) {
    if (ancestorsPeer.has(ancId)) {
      const dist = egoDist + ancestorsPeer.get(ancId);
      if (dist < bestDistance) {
        bestDistance = dist;
        bestLCA = ancId;
      }
    }
  }

  return bestLCA;
}

function getAllAncestors(graph, nodeId) {
  const ancestors = new Map(); // nodeId → distance
  const visited = new Set();
  const queue = [{ nodeId, dist: 0 }];

  while (queue.length > 0) {
    const { nodeId: cur, dist } = queue.shift();
    if (visited.has(cur)) continue;
    visited.add(cur);

    const neighbors = graph.edges.get(cur) || [];
    for (const edge of neighbors) {
      if (edge.direction === 'up') {
        ancestors.set(edge.target, dist + 1);
        queue.push({ nodeId: edge.target, dist: dist + 1 });
      }
    }
  }

  return ancestors;
}

/**
 * 获取从祖先到后代的下行路径
 */
export function pathFromAncestor(graph, ancestorId, descendantId) {
  const path = [];
  function dfs(curId, targetId, curPath, visited) {
    if (curId === targetId) {
      path.push(...curPath);
      return true;
    }
    visited.add(curId);
    const neighbors = graph.edges.get(curId) || [];
    for (const edge of neighbors) {
      if (edge.direction === 'down' && !visited.has(edge.target)) {
        const node = graph.nodes.get(edge.target);
        if (!node) continue;
        const step = {
          direction: 'down',
          nodeId: edge.target,
          gender: node.gender,
          parentNode: graph.nodes.get(curId),
          parentGender: graph.nodes.get(curId)?.gender,
        };
        if (dfs(edge.target, targetId, [...curPath, step], new Set(visited))) {
          return true;
        }
      }
    }
    return false;
  }
  dfs(ancestorId, descendantId, [], new Set());
  return path;
}
