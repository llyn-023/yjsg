// src/models/family-member.js — 家族成员节点数据模型
// 对应规格：家谱关系系统 §2.1 family_member 表

/**
 * @typedef {'male' | 'female'} Gender
 * @typedef {'active' | 'placeholder' | 'deceased'} MemberStatus
 * @typedef {'solar' | 'lunar'} BirthType
 *
 * @typedef {Object} FamilyMember
 * @property {string}      id          - UUID
 * @property {string}      familyId    - 所属家族 ID
 * @property {string}      name        - 姓名
 * @property {Gender}      gender      - 性别（必填）
 * @property {Date|null}   birthDate   - 完整出生年月日（长幼排序用）
 * @property {BirthType}   birthType   - 阳历/农历
 * @property {Date|null}   deathDate   - 忌日（null = 在世）
 * @property {MemberStatus} status     - active/placeholder/deceased
 * @property {string|null} userId      - 关联账号（null = 未认领）
 * @property {string|null} avatarUrl   - 头像
 * @property {string|null} hometown    - 故乡/籍贯（"江苏 · 扬州"）
 * @property {string|null} dish        - 代表味道
 * @property {string}      createdAt   - 加入时间
 */

/**
 * 创建一个家族成员节点
 */
export function createMember({
  id, familyId, name, gender,
  birthDate = null, birthType = 'solar',
  deathDate = null, status = 'active',
  userId = null, avatarUrl = null,
  hometown = null, dish = null,
  createdAt = new Date().toISOString(),
}) {
  return {
    id, familyId, name, gender,
    birthDate, birthType,
    deathDate, status,
    userId, avatarUrl,
    hometown, dish,
    createdAt,
  };
}

/**
 * 判断成员是否为占位节点
 */
export function isPlaceholder(member) {
  return member.status === 'placeholder';
}

/**
 * 判断成员是否为已故
 */
export function isDeceased(member) {
  return member.status === 'deceased' || !!member.deathDate;
}

/**
 * 获取成员显示的短名（去除关系前缀）
 */
export function getShortName(member) {
  const parts = member.name.split(' · ');
  return parts[parts.length - 1] || member.name;
}
