// src/engine/kinship-derive.js — 亲属称谓双向推导引擎
// 对应规格：家谱关系系统 §5 / §8 / §9
//
// 核心逻辑：
//   1. 从关系图中找到 ego → alter 的最短路径
//   2. 将路径翻译为方向序列（↑上 / ↓下 / ↔旁）
//   3. 根据方向序列 + 路径上每个人的性别，查称谓映射表
//   4. 同辈旁系（↑步数 = ↓步数）触发堂/表判定
//   5. 双向计算：derive(ego, alter) + derive(alter, ego)

import { buildGraph, findShortestPath } from './relation-graph.js';
import { classifyCousin, getCousinTerm } from './tang-biao.js';
import { compareAge, classifyBoShu } from './age-compare.js';

// ── 称谓表 ────────────────────────────────────────

// 直系长辈（纯 ↑）
const DIRECT_UP = {
  'M': { 1: '父亲', 2: '爷爷',  3: '曾祖父', 4: '高祖父' },
  'F': { 1: '母亲', 2: '奶奶',  3: '曾祖母', 4: '高祖母' },
};

// 外系长辈（第一跳是女性）
const MATERNAL_UP = {
  'M': { 2: '外公', 3: '曾外祖父', 4: '外高祖父' },
  'F': { 2: '外婆', 3: '曾外祖母', 4: '外高祖母' },
};

// 直系晚辈（纯 ↓）
const DIRECT_DOWN = {
  'M': { 1: '儿子', 2: '孙子',  3: '曾孙',  4: '玄孙' },
  'F': { 1: '女儿', 2: '孙女',  3: '曾孙女', 4: '玄孙女' },
};

// 父辈旁系（↑↑↓）
const PARENT_SIBLINGS = {
  'father_brother': '伯父/叔叔',   // 需比较年龄
  'father_sister':  '姑姑',
  'mother_brother': '舅舅',
  'mother_sister':  '阿姨',
};

// 子辈旁系（↑↓↓）
const CHILD_SIBLINGS = {
  'brother_male':   '侄子',
  'brother_female': '侄女',
  'sister_male':    '外甥',
  'sister_female':  '外甥女',
};

// ── 路径分析 ─────────────────────────────────────

function analyzePath(path) {
  let upSteps = 0, downSteps = 0, sideSteps = 0;
  const genderChain = []; // 路径每步的性别
  const parentGenders = []; // up 步的父节点性别

  for (const step of path) {
    genderChain.push(step.gender);
    if (step.direction === 'up') {
      upSteps++;
      if (step.parentGender) parentGenders.push(step.parentGender);
    } else if (step.direction === 'down') {
      downSteps++;
    } else if (step.direction === 'side') {
      sideSteps++;
    }
  }

  return { upSteps, downSteps, sideSteps, genderChain, parentGenders };
}

function isPureDown(path) {
  return path.length > 0 && path.every(s => s.direction === 'down');
}

function isPureUp(path) {
  return path.length > 0 && path.every(s => s.direction === 'up');
}

function isCousinPattern(upSteps, downSteps) {
  return upSteps === downSteps && upSteps >= 2;
}

function isSiblingPattern(upSteps, downSteps) {
  return upSteps === 1 && downSteps === 1 && upSteps === downSteps;
}

// ── 主推导函数 ────────────────────────────────────

/**
 * 推导 ego 对 alter 的亲属称谓
 * @param {Object} graph     - RelationGraph
 * @param {string} egoId
 * @param {string} alterId
 * @param {Array}  members   - FamilyMember[]，用于长幼比较
 * @returns {string} 称谓
 */
export function deriveKinship(graph, egoId, alterId, members = []) {
  if (egoId === alterId) return '自己';

  const path = findShortestPath(graph, egoId, alterId);
  if (!path || path.length === 0) return '家人';
  if (path.length > 5) return '长辈'; // 超过 5 代简化

  const { upSteps, downSteps, sideSteps, genderChain, parentGenders } = analyzePath(path);
  const egoNode = graph.nodes.get(egoId);
  const alterNode = graph.nodes.get(alterId);
  if (!egoNode || !alterNode) return '家人';

  // ── 含配偶边 → 姻亲 ──
  if (sideSteps > 0) {
    return deriveInLaw(egoNode, alterNode, upSteps, downSteps, genderChain);
  }

  // ── 纯直系长辈 ──
  if (upSteps > 0 && downSteps === 0) {
    return deriveDirectUp(genderChain, parentGenders, upSteps);
  }

  // ── 纯直系晚辈 ──
  if (downSteps > 0 && upSteps === 0) {
    return deriveDirectDown(genderChain, parentGenders, downSteps);
  }

  // ── 同辈旁系 ──
  if (isCousinPattern(upSteps, downSteps)) {
    return deriveCousin(graph, egoId, alterId, members);
  }

  // ── 亲兄弟姐妹（↑↓=1）──
  if (isSiblingPattern(upSteps, downSteps)) {
    return deriveSibling(egoNode, alterNode, members, egoId, alterId);
  }

  // ── 父辈旁系（↑↑↓）──
  if (upSteps === 2 && downSteps === 1) {
    return deriveParentSibling(graph, egoId, alterId, path, members);
  }

  // ── 子辈旁系（↑↓↓）──
  if (upSteps === 1 && downSteps === 2) {
    return deriveChildSibling(graph, egoId, alterId, path, genderChain);
  }

  // 兜底
  if (upSteps > downSteps) return '长辈';
  if (upSteps < downSteps) return '晚辈';
  return '家人';
}

// ── 直系长辈 ──
function deriveDirectUp(genderChain, parentGenders, steps) {
  const alterGender = genderChain[genderChain.length - 1];
  // 判断父系还是母系：第一跳的父节点性别
  const firstIsMale = parentGenders[0] === 'male';

  if (firstIsMale) {
    return DIRECT_UP[alterGender]?.[steps] || (steps > 4 ? '长辈' : '长辈');
  } else {
    // 经过女性 → 外系
    if (steps === 1) return '母亲';
    const maternalMap = MATERNAL_UP;
    return maternalMap[alterGender]?.[steps] || (steps > 4 ? '长辈' : '长辈');
  }
}

// ── 直系晚辈 ──
function deriveDirectDown(genderChain, parentGenders, steps) {
  const alterGender = genderChain[genderChain.length - 1];
  // 判断：ego 是男性还是女性？看第一跳
  if (genderChain.length === 0) return DIRECT_DOWN[alterGender]?.[steps] || '晚辈';

  // 简化：直接查 DIRECT_DOWN
  const term = DIRECT_DOWN[alterGender]?.[steps];
  if (term) return term;

  return steps > 4 ? '晚辈' : '晚辈';
}

// ── 同辈旁系（堂/表）──
function deriveCousin(graph, egoId, alterId, members) {
  const alterNode = graph.nodes.get(alterId);
  const egoMember = members.find(m => m.id === egoId);
  const alterMember = members.find(m => m.id === alterId);

  const cousinClass = classifyCousin(graph, egoId, alterId);

  let ageResult = 'unknown';
  if (egoMember && alterMember) {
    ageResult = compareAge(egoMember, alterMember);
  }

  return getCousinTerm(cousinClass, alterNode.gender, ageResult);
}

// ── 亲兄弟姐妹 ──
function deriveSibling(egoNode, alterNode, members, egoId, alterId) {
  const egoMember = members.find(m => m.id === egoId);
  const alterMember = members.find(m => m.id === alterId);

  let ageResult = 'unknown';
  if (egoMember && alterMember) {
    ageResult = compareAge(egoMember, alterMember);
  }

  if (ageResult === 'peer_older') {
    // TA 年长
    return alterNode.gender === 'male' ? '哥哥' : '姐姐';
  } else {
    // 我年长或未知
    return alterNode.gender === 'male' ? '弟弟' : '妹妹';
  }
}

// ── 父辈旁系 ──
function deriveParentSibling(graph, egoId, alterId, path, members) {
  const alterNode = graph.nodes.get(alterId);

  // 判断是父亲的兄弟/姐妹还是母亲的兄弟/姐妹
  // 路径: ego →↑ parent →↑ grandparent →↓ alter
  // path[0] = ↑ to parent
  // path[1] = ↑ to grandparent
  // path[2] = ↓ to alter

  const firstUpStep = path[0]; // ego → parent
  const viaFather = firstUpStep.parentGender === 'male';

  if (viaFather) {
    if (alterNode.gender === 'male') {
      // 父亲的兄弟 → 伯父/叔叔
      // 需要比较 alter 与父亲的长幼
      // 简化：比较 alter 与 ego 的父亲
      const fatherId = path[0].nodeId;
      const fatherMember = members.find(m => m.id === fatherId);
      const alterMember = members.find(m => m.id === alterId);
      if (fatherMember && alterMember) {
        return classifyBoShu(fatherMember, alterMember);
      }
      return '伯父/叔叔';
    } else {
      return '姑姑';
    }
  } else {
    if (alterNode.gender === 'male') {
      return '舅舅';
    } else {
      return '阿姨';
    }
  }
}

// ── 子辈旁系 ──
function deriveChildSibling(graph, egoId, alterId, path, genderChain) {
  const alterNode = graph.nodes.get(alterId);

  // 判断是兄弟的子女还是姐妹的子女
  // 路径: ego →↑ parent →↓ siblingOfEgo →↓ alter
  const firstUpStep = path[0];
  const childIsViaBrother = firstUpStep.parentGender === 'male';

  if (childIsViaBrother) {
    return alterNode.gender === 'male' ? '侄子' : '侄女';
  } else {
    return alterNode.gender === 'male' ? '外甥' : '外甥女';
  }
}

// ── 姻亲 ──
function deriveInLaw(egoNode, alterNode, upSteps, downSteps, genderChain) {
  // 配偶
  if (upSteps === 0 && downSteps === 0) {
    return alterNode.gender === 'male' ? '丈夫' : '妻子';
  }

  // 配偶的父母
  if (upSteps === 1 && downSteps === 0) {
    return alterNode.gender === 'male'
      ? (egoNode.gender === 'male' ? '岳父' : '公公')
      : (egoNode.gender === 'male' ? '岳母' : '婆婆');
  }

  // 子女的配偶
  if (upSteps === 0 && downSteps === 1) {
    return alterNode.gender === 'male' ? '女婿' : '儿媳';
  }

  // 其他姻亲
  return '家人';
}

// ── 批量推导 ────────────────────────────────────

/**
 * 为整个家族生成所有双向称谓缓存
 * @param {Array} members   - FamilyMember[]
 * @param {Array} relations - FamilyRelation[]
 * @returns {Object} { [egoId]: { [alterId]: term } }
 */
export function deriveAllKinship(members, relations) {
  const graph = buildGraph(members, relations);
  const cache = {};

  for (const ego of members) {
    cache[ego.id] = {};
    for (const alter of members) {
      if (ego.id === alter.id) continue;
      const term = deriveKinship(graph, ego.id, alter.id, members);
      cache[ego.id][alter.id] = term;
    }
  }

  return cache;
}

/**
 * 查询称谓（从缓存）
 * @param {Object} cache - deriveAllKinship 的输出
 * @param {string} egoId
 * @param {string} alterId
 * @returns {string}
 */
export function getKinshipTerm(cache, egoId, alterId) {
  return cache?.[egoId]?.[alterId] || '家人';
}
