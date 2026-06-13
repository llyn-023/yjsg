// src/mock/capsules.js — 时间胶囊 Mock 数据
import { MOCK_FOOD_IMG } from './anchors.js';

export const CAPSULES = [
  {
    id: 'c1', name: '给女儿十八岁的老味道', to: '女儿·陈小豆',
    open: '2030年9月12日', days: 1572, state: 'sealed', img: MOCK_FOOD_IMG,
  },
  {
    id: 'c2', name: '给妹妹的成年礼', to: '妹妹·陈小雨',
    open: '2028年2月28日', days: 625, state: 'sealed', img: MOCK_FOOD_IMG,
  },
];

export const CAPSULE_FORM_DEFAULTS = {
  name: '',
  whenY: '2030',
  whenM: '1',
  whenD: '1',
  to: ['全家'],
};
