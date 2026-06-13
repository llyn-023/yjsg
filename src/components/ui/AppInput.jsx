// src/components/ui/AppInput.jsx

import React, { useState } from 'react';
import { C } from '../../config/tokens.js';

export default function AppInput({ label, placeholder, value, onChange, type = 'text', error, rightEl, hint, autoComplete }) {
  const [focused, setFocused] = useState(false);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {label && (
        <label style={{ fontSize: 13, fontWeight: 600, color: C.t2, letterSpacing: 0.3 }}>
          {label}
        </label>
      )}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          type={type}
          value={value || ''}
          placeholder={placeholder}
          autoComplete={autoComplete}
          onChange={e => onChange && onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            flex: 1, height: 50, padding: rightEl ? '0 48px 0 16px' : '0 16px',
            background: C.inputBg,
            border: `1.5px solid ${error ? C.red : focused ? C.primary : C.border}`,
            borderRadius: 12, fontSize: 15, color: C.t1,
            fontFamily: 'inherit', outline: 'none', transition: 'border-color 0.15s',
          }}
        />
        {rightEl && <div style={{ position: 'absolute', right: 12 }}>{rightEl}</div>}
      </div>
      {error && <div style={{ fontSize: 12, color: C.red }}>{error}</div>}
      {hint && !error && <div style={{ fontSize: 12, color: C.t3, lineHeight: 1.5 }}>{hint}</div>}
    </div>
  );
}
