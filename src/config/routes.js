// src/config/routes.js — 路由表配置
// 来源：一家食光.html SCREENS 数组

const SCREENS = [
  // ── 认证与入伙 ──
  { id: 'P0',  group: '认证与入伙', label: '启动页',      sub: 'Splash',       page: 'P0_Splash' },
  { id: 'P1',  group: '认证与入伙', label: '登录',         sub: 'Login',        page: 'P1_Login' },
  { id: 'P2',  group: '认证与入伙', label: '入伙引导',     sub: 'Family Entry', page: 'P2_Family' },
  { id: 'P3',  group: '认证与入伙', label: '找到你的位置', sub: 'Position',     page: 'P3_Position' },

  // ── 创作闭环 ──
  { id: 'P10', group: '创作闭环',   label: '味道桌',      sub: 'Home',         page: 'P10_Home' },
  { id: 'P30', group: '创作闭环',   label: 'Agent 对话',   sub: 'Chat',         page: 'P30_Chat' },
  { id: 'P31', group: '创作闭环',   label: '故事生成',     sub: 'Story',        page: 'P31_Story' },
  { id: 'P11', group: '创作闭环',   label: '记忆瞬间',     sub: 'Anchor',       page: 'P11_Anchor' },

  // ── 家族与社交 ──
  { id: 'P20', group: '家族与社交', label: '家谱',         sub: 'Tree',         page: 'P20_Tree' },
  { id: 'P21', group: '家族与社交', label: '人物详情',     sub: 'Person',       page: 'P21_Person' },
  { id: 'P40', group: '家族与社交', label: '动态',         sub: 'Feed',         page: 'P40_Feed' },
  { id: 'P50', group: '家族与社交', label: '我的',         sub: 'Me',           page: 'P50_Me' },

  // ── 设置与传承 ──
  { id: 'P51', group: '设置与传承', label: '设置',         sub: 'Settings',     page: 'P51_Settings' },
  { id: 'P52', group: '设置与传承', label: '家族管理',     sub: 'FamilyMgmt',   page: 'P52_Family' },
  { id: 'P60', group: '设置与传承', label: '记忆地图',     sub: 'Map',          page: 'P60_Map' },
  { id: 'P61', group: '设置与传承', label: '纪念册',       sub: 'Book',         page: 'P61_Book' },
  { id: 'P62', group: '设置与传承', label: '时间胶囊',     sub: 'Capsule',      page: 'P62_Capsule' },

  // ── 内页 ──
  { id: 'P_EditProfile',   group: '内页', label: '编辑个人资料', sub: 'EditProfile',    page: 'P_EditProfile' },
  { id: 'P_Drafts',        group: '内页', label: '我的草稿',     sub: 'Drafts',         page: 'P_Drafts' },
  { id: 'P_EditMember',    group: '内页', label: '编辑家人资料', sub: 'Edit Member',    page: 'P_EditMember' },
  { id: 'P_ConfirmMember', group: '内页', label: '审核申请',     sub: 'Confirm',        page: 'P_ConfirmMember' },
  { id: 'P_ForgotPwd',     group: '内页', label: '找回密码',     sub: 'Forgot',         page: 'P_ForgotPwd' },
  { id: 'P_Register',      group: '内页', label: '创建账号',     sub: 'Register',       page: 'P_Register' },
  { id: 'P_CreateFamily',  group: '内页', label: '创建家族',     sub: 'CreateFamily',   page: 'P_CreateFamily' },
  { id: 'P_JoinFamily',    group: '内页', label: '加入家族',     sub: 'JoinFamily',     page: 'P_JoinFamily' },
  { id: 'P_GrayDish',      group: '内页', label: '待讲味道',     sub: 'GrayDish',       page: 'P_GrayDish' },
  { id: 'P_Notifications', group: '内页', label: '通知中心',     sub: 'Notifications',  page: 'P_Notifications' },
  { id: 'P_EditFamily',    group: '内页', label: '编辑家族信息', sub: 'EditFamily',     page: 'P_EditFamily' },
  { id: 'P_CapsuleDetail', group: '内页', label: '胶囊详情',     sub: 'Capsule Detail', page: 'P_CapsuleDetail' },
  { id: 'P_EditMemory',    group: '内页', label: '编辑记忆',     sub: 'Edit Memory',    page: 'P_EditMemory' },
];

// 底部导航栏配置（P10/P20/P40/P50）
export const TAB_SCREENS = ['P10', 'P20', 'P40', 'P50'];

export default SCREENS;
