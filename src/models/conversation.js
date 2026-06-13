// src/models/conversation.js — P30 对话消息与状态追踪数据模型
// 对应规格：Agent 对话 Skill §8 / §13

/**
 * @typedef {Object} ConversationMessage
 * @property {string}  id        - UUID
 * @property {'user' | 'assistant'} role
 * @property {string}  content   - 消息文本
 * @property {number}  timestamp - Unix ms
 * @property {Array}   media     - [{ type:'image'|'voice', url, duration?, transcript? }]
 * @property {Object}  metadata  - { emotion_detected?, dimensions_updated?, related_foods_detected?, city_updated?, era_updated? }
 */

/**
 * @typedef {Object} ConversationState
 * @property {Object}   food                 - 吃食本体信息
 * @property {Object}   people               - 关联人物
 * @property {Object}   scene                - 时间与场景（location.city 必挖）
 * @property {Object}   emotion              - 情感与故事
 * @property {Array}    relatedFoods         - 关联吃食
 * @property {Object}   dimensionsCovered    - 维度覆盖状态
 * @property {boolean}  timeLocationLocked   - 时空是否已锚定
 * @property {number}   conversationTurns    - 对话轮数
 * @property {string}   emotionalState       - normal|touched|nostalgic|sad|happy
 */

/**
 * 创建空白的对话状态（新对话入口）
 */
export function createBlankState() {
  return {
    food: { name: '', ingredientsMentioned: [], tasteMemory: '', appearanceMemory: '', specialTechnique: '' },
    people: { mainPerson: '', inheritanceChain: [], coEaters: [], personHabits: '', signaturePhrases: [], treeNodes: [] },
    scene: {
      era: '', eraDetail: '', occasion: '',
      location: { city: '', province: '', venue: '', spatialDetails: '', isOrigin: true, cityConfidence: 'unknown' },
      season: '',
    },
    emotion: { feeling: '', stories: [], generational: '', personalMeaning: '' },
    relatedFoods: [],
    dimensionsCovered: {},
    timeLocationLocked: false,
    conversationTurns: 0,
    emotionalState: 'normal',
  };
}

/**
 * 创建一条对话消息
 */
export function createMessage({ id, role, content, media = [], metadata = {} }) {
  return {
    id: id || 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    role,
    content,
    timestamp: Date.now(),
    media,
    metadata,
  };
}

/**
 * 判断对话状态是否足够丰富可生成故事（时间+地点已锁 + 维度覆盖 >= 70%）
 */
export function isReadyToGenerate(state) {
  const dims = Object.values(state.dimensionsCovered || {});
  const covered = dims.filter(Boolean).length;
  const ratio = dims.length > 0 ? covered / dims.length : 0;
  return state.timeLocationLocked && ratio >= 0.7;
}
