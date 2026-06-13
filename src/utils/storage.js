// src/utils/storage.js — sessionStorage 存取封装
// 用于页面间传递上下文数据（替代 window.__xxx 临时变量）

const PREFIX = 'yjfs_';

export function setCtx(key, data) {
  try {
    sessionStorage.setItem(PREFIX + key, JSON.stringify(data));
  } catch (e) {
    // sessionStorage 不可用时静默失败
  }
}

export function getCtx(key, fallback = null) {
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (e) {
    return fallback;
  }
}

export function clearCtx(key) {
  try {
    sessionStorage.removeItem(PREFIX + key);
  } catch (e) {
    // 静默
  }
}

// ── 专用键名 ──
export const CTX_KEYS = {
  P11:   'p11ctx',          // 记忆瞬间数据
  P30:   'p30ctx',          // Agent 对话上下文
  P31:   'p31ctx',          // 故事生成上下文
  EDIT_MEMORY: 'editMemoryCtx', // 编辑记忆上下文
  EDIT_MEMBER: 'editMemberCtx', // 编辑家人上下文
  CONFIRM_MEMBER: 'confirmMemCtx', // 审核上下文
  CAPSULE: 'capsuleCtx',    // 胶囊上下文
  GRAY_DISH: 'grayDishCtx', // 灰锚点上下文
};
