// src/components/ui/NavBar.jsx

import React from 'react';
import { C } from '../../config/tokens.js';

export default function NavBar({ title, onBack, rightEl }) {
  return (
    <div style={{
      height: 44, display: 'flex', alignItems: 'center',
      padding: '0 16px', gap: 8, flexShrink: 0,
    }}>
      <button onClick={onBack} style={{
        width: 40, height: 40, border: 'none', background: 'transparent',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 24, color: C.primary, marginLeft: -8,
      }}>‹</button>
      <div style={{
        flex: 1, textAlign: 'center', fontSize: 16, fontWeight: 700,
        color: C.t1, fontFamily: '"Noto Serif SC",serif',
      }}>
        {title}
      </div>
      {rightEl || <div style={{ width: 40 }} />}
    </div>
  );
}
