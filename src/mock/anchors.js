// src/mock/anchors.js — 锚点（已点亮/灰锚点）Mock 数据

export const MOCK_FOOD_IMG = 'uploads/pasted-1781230551205-0.png'; // 通用食物占位图

// ── 已点亮锚点 ──
export const ANCHORS = [
  {
    id: 'a1', name: '外婆的辣子鸡', by: '外婆 · 陈秀英', era: '1998',
    location: '江苏 · 扬州', img: MOCK_FOOD_IMG, isOwner: true,
  },
  {
    id: 'a2', name: '年三十的饺子', by: '二伯 · 陈建华', era: '1985',
    location: '江苏 · 扬州', img: MOCK_FOOD_IMG, isOwner: false,
  },
  {
    id: 'a3', name: '清明的青团', by: '妈妈 · 陈丽华', era: '2000',
    location: '江苏 · 南京', img: MOCK_FOOD_IMG, isOwner: false,
  },
  {
    id: 'a4', name: '红烧肉', by: '爷爷 · 陈志农', era: '1960',
    location: '江苏 · 扬州', img: MOCK_FOOD_IMG, isOwner: false,
  },
];

// ── 灰锚点（待点亮）──
export const ANCHORS_GRAY = [
  { id: 'g1', name: '姥姥的锅贴',       tag: '妈妈想听', who: '妈妈 · 陈丽华',  img: null },
  { id: 'g2', name: '太姥姥的冰糖葫芦',  tag: '爸爸想听', who: '爸爸 · 陈建明',  img: null },
  { id: 'g3', name: '八宝饭',            tag: '我提到过', who: '我 · 陈小明',    img: null },
];
