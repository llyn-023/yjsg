// src/components/ui/ScrollPicker.jsx — 滚动选择器
// 用于年/月/日等滚动选择

import React from 'react';
import { C } from '../../config/tokens.js';

export default function ScrollPicker({ options = [], value, onChange }) {
  return (
    <div style={{
      flex: 1, height: 120, overflowY: 'auto',
      background: '#FFFDF8', border: '1px solid ' + C.border,
      borderRadius: 10, scrollSnapType: 'y mandatory',
    }}>
      {options.map((opt, i) => {
        const v = typeof opt === 'string' ? opt : opt.value;
        const label = typeof opt === 'string' ? opt : (opt.label || opt.value);
        const sel = v === value;
        return (
          <div
            key={v || i}
            onClick={() => onChange && onChange(v)}
            style={{
              height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, cursor: 'pointer',
              background: sel ? C.primaryPale : 'transparent',
              color: sel ? C.primary : C.t1,
              fontWeight: sel ? 600 : 400,
              scrollSnapAlign: 'center',
              borderBottom: '1px solid ' + C.border,
              fontFamily: 'inherit',
            }}
          >
            {label}
          </div>
        );
      })}
    </div>
  );
}
