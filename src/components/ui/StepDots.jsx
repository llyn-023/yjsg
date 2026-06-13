// src/components/ui/StepDots.jsx

import React from 'react';
import { C } from '../../config/tokens.js';

export default function StepDots({ total, current }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 0' }}>
      {Array.from({ length: total }, (_, i) => (
        <React.Fragment key={i}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, fontWeight: 700, flexShrink: 0,
            background: i < current ? C.primary : i === current ? C.primary : '#E8E0D4',
            color: i <= current ? '#fff' : C.t3,
            boxShadow: i === current ? `0 0 0 4px ${C.primaryPale}` : 'none',
            transition: 'all 0.2s',
          }}>
            {i < current ? '✓' : i + 1}
          </div>
          {i < total - 1 && (
            <div style={{
              height: 2, width: 44,
              background: i < current ? C.primary : '#E8E0D4',
              flexShrink: 0, transition: 'background 0.2s',
            }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
