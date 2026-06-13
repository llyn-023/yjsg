// src/components/ui/Btn.jsx

import React from 'react';
import { C } from '../../config/tokens.js';

export default function Btn({ children, onClick, variant = 'primary', size = 'md', disabled, fullWidth, xstyle }) {
  const sz = {
    lg: { height: 52, fontSize: 16, padding: '0 32px' },
    md: { height: 48, fontSize: 15, padding: '0 24px' },
    sm: { height: 40, fontSize: 14, padding: '0 18px' },
    xs: { height: 32, fontSize: 12, padding: '0 12px', borderRadius: 8 },
  }[size] || {};

  const vt = {
    primary:   { background: disabled ? C.primary100 : C.primary, color: '#fff' },
    secondary: { background: C.primaryPale, color: C.primary, border: `1px solid ${C.primary100}` },
    outline:   { background: 'transparent', color: C.primary, border: `1.5px solid ${C.primary}` },
    ghost:     { background: 'transparent', color: C.t2, border: `1px solid ${C.border}` },
    warm:      { background: C.gold, color: '#fff' },
    text:      { background: 'transparent', color: C.primary, height: 'auto', padding: 0 },
  }[variant] || {};

  return (
    <button
      onClick={disabled ? undefined : onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        borderRadius: 9999, border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit', fontWeight: 600, letterSpacing: 0.2,
        transition: 'all 0.15s', userSelect: 'none',
        width: fullWidth ? '100%' : undefined, opacity: disabled ? 0.48 : 1,
        ...sz, ...vt, ...xstyle,
      }}
      onMouseDown={e => { if (!disabled) e.currentTarget.style.opacity = '0.78'; }}
      onMouseUp={e => { e.currentTarget.style.opacity = disabled ? '0.48' : '1'; }}
      onMouseLeave={e => { e.currentTarget.style.opacity = disabled ? '0.48' : '1'; }}
    >
      {children}
    </button>
  );
}
