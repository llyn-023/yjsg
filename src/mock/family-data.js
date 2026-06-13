// src/mock/family-data.js — 家族成员与关系 Mock 数据
// 对应原型家谱：陈氏一家

import { createMember } from '../models/family-member.js';
import { createRelation } from '../models/family-relation.js';

// ── 陈氏一家成员 ──
export const MOCK_MEMBERS = [
  // 祖辈
  createMember({ id: 'n_zufu',  familyId: 'fam_chen', name: '祖父 · 陈志农', gender: 'male',   birthDate: '1935-03-15', hometown: '江苏 · 扬州', status: 'deceased' }),
  createMember({ id: 'n_zumu',  familyId: 'fam_chen', name: '祖母 · 周桃妖', gender: 'female', birthDate: '1938-07-22', hometown: '江苏 · 扬州', status: 'deceased' }),

  // 父辈
  createMember({ id: 'n_dabo',  familyId: 'fam_chen', name: '大伯 · 陈建华', gender: 'male',   birthDate: '1958-01-10', hometown: '江苏 · 扬州', dish: '冰粉' }),
  createMember({ id: 'n_father',familyId: 'fam_chen', name: '父亲 · 陈建明', gender: 'male',   birthDate: '1962-05-18', hometown: '江苏 · 扬州', dish: '北京烤鸭' }),
  createMember({ id: 'n_mother',familyId: 'fam_chen', name: '母亲 · 陈丽华', gender: 'female', birthDate: '1965-09-03', hometown: '江苏 · 南京', dish: '辣子鸡' }),
  createMember({ id: 'n_gugu',  familyId: 'fam_chen', name: '姑姑 · 陈建军', gender: 'female', birthDate: '1966-11-20', hometown: '江苏 · 扬州' }),

  // 同辈
  createMember({ id: 'n_tangxiong', familyId: 'fam_chen', name: '堂兄 · 陈子翔', gender: 'male',   birthDate: '1985-04-02', hometown: '江苏 · 扬州' }),
  createMember({ id: 'n_ego',        familyId: 'fam_chen', name: '我 · 陈小明',   gender: 'male',   birthDate: '1992-08-15', hometown: '江苏 · 扬州', userId: 'user_001', dish: '待点亮…' }),
  createMember({ id: 'n_meimei',     familyId: 'fam_chen', name: '妹妹 · 陈小雨', gender: 'female', birthDate: '1996-02-28', hometown: '江苏 · 扬州', dish: '待点亮…' }),
  createMember({ id: 'n_gubiaodi',   familyId: 'fam_chen', name: '表弟 · 陈小豆', gender: 'male',   birthDate: '1998-11-09', hometown: '江苏 · 扬州' }),
];

// ── 关系边 ──
export const MOCK_RELATIONS = [
  // 祖辈 → 父辈
  createRelation({ id: 'r1',  familyId: 'fam_chen', relationType: 'parent_of', fromNodeId: 'n_zufu',  toNodeId: 'n_dabo' }),
  createRelation({ id: 'r2',  familyId: 'fam_chen', relationType: 'parent_of', fromNodeId: 'n_zufu',  toNodeId: 'n_father' }),
  createRelation({ id: 'r3',  familyId: 'fam_chen', relationType: 'parent_of', fromNodeId: 'n_zufu',  toNodeId: 'n_gugu' }),
  createRelation({ id: 'r4',  familyId: 'fam_chen', relationType: 'parent_of', fromNodeId: 'n_zumu',  toNodeId: 'n_dabo' }),
  createRelation({ id: 'r5',  familyId: 'fam_chen', relationType: 'parent_of', fromNodeId: 'n_zumu',  toNodeId: 'n_father' }),
  createRelation({ id: 'r6',  familyId: 'fam_chen', relationType: 'parent_of', fromNodeId: 'n_zumu',  toNodeId: 'n_gugu' }),

  // 祖辈配偶
  createRelation({ id: 'r7',  familyId: 'fam_chen', relationType: 'spouse_of', fromNodeId: 'n_zufu',  toNodeId: 'n_zumu' }),

  // 父母
  createRelation({ id: 'r8',  familyId: 'fam_chen', relationType: 'spouse_of', fromNodeId: 'n_father', toNodeId: 'n_mother' }),

  // 父辈 → 同辈
  createRelation({ id: 'r9',  familyId: 'fam_chen', relationType: 'parent_of', fromNodeId: 'n_dabo',   toNodeId: 'n_tangxiong' }),
  createRelation({ id: 'r10', familyId: 'fam_chen', relationType: 'parent_of', fromNodeId: 'n_father', toNodeId: 'n_ego' }),
  createRelation({ id: 'r11', familyId: 'fam_chen', relationType: 'parent_of', fromNodeId: 'n_father', toNodeId: 'n_meimei' }),
  createRelation({ id: 'r12', familyId: 'fam_chen', relationType: 'parent_of', fromNodeId: 'n_mother', toNodeId: 'n_ego' }),
  createRelation({ id: 'r13', familyId: 'fam_chen', relationType: 'parent_of', fromNodeId: 'n_mother', toNodeId: 'n_meimei' }),
  createRelation({ id: 'r14', familyId: 'fam_chen', relationType: 'parent_of', fromNodeId: 'n_gugu',   toNodeId: 'n_gubiaodi' }),
];

// ── 用户所属家族 ──
export const MOCK_FAMILIES = [
  { id: 'fam_chen', name: '陈氏一家人', surname: '陈', code: 'YJ2026' },
];

// ── 当前用户 ──
export const MOCK_USER = {
  id: 'user_001',
  username: 'chenxiaoming',
  nickname: '小明',
  memberId: 'n_ego',
};
