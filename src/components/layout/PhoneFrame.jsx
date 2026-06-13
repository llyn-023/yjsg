// src/components/layout/PhoneFrame.jsx — 手机外壳（390×844）
// 用于设计画布/原型展示时包裹页面组件

import React from 'react';
import { C, DIMS } from '../../config/tokens.js';

const { PW, PH } = DIMS;

export default function PhoneFrame({ children, scale = 1 }) {
  return (
    <div style={{
      width: PW, height: PH,
      transform: `scale(${scale})`, transformOrigin: 'center center',
      borderRadius: 52, overflow: 'hidden',
      boxShadow: '0 40px 100px rgba(0,0,0,0.28), 0 8px 30px rgba(0,0,0,0.16), 0 0 0 1px rgba(0,0,0,0.06)',
      position: 'relative', background: C.bg,
    }}>
      {/* Dynamic Island */}
      <div style={{
        position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
        width: 126, height: 38, background: '#080808',
        borderRadius: '0 0 22px 22px', zIndex: 20,
      }} />
      {children}
    </div>
  );
}

export { PW, PH };
