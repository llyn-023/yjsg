// src/mock/notifications.js — 通知 Mock 数据

export const NOTIFICATIONS = [
  {
    id: 'n1', type: 'join', read: false,
    title: '陈建军 申请加入家族',
    sub: '陈氏一家 · 今天 14:32',
    action: '审核',
  },
  {
    id: 'n2', type: 'comment', read: false,
    title: '妈妈·陈丽华 补述了「外婆的辣子鸡」',
    sub: '对，那件蓝围裙后来洗破了好几个洞……',
    action: '查看',
  },
  {
    id: 'n3', type: 'light', read: false,
    title: '一道味道被点亮了',
    sub: '「清明的青团」由妈妈·陈丽华讲述完成',
    action: '查看',
  },
  {
    id: 'n4', type: 'capsule', read: true,
    title: '时间胶囊提醒',
    sub: '「给女儿的老味道」将于 2030年1月1日 开启',
    action: '查看',
  },
  {
    id: 'n5', type: 'comment', read: true,
    title: '二伯·陈建华 补述了「年三十的饺子」',
    sub: '辣子鸡里要放一勺米酒糟，外婆是跟太外婆学的。',
    action: '查看',
  },
];

// 通知类型图标 SVG path 配置
export const NOTIF_ICONS = {
  join:    'M16 11a4 4 0 1 0-8 0M3 19c0-3.5 3.6-6 9-6s9 2.5 9 6M19 4v6m-3-3h6',
  comment: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  light:   'M12 2l2.5 6h6l-5 4.5L17.5 19 12 15.5 6.5 19l2-6.5L3.5 8h6L12 2Z',
  capsule: 'M12 7v5l3 2',
};
