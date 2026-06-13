// src/components/ui/BottomNav.jsx — 底部导航栏
// P10/P20/P40/P50 四个 Tab + 中央「+」创建入口

import React from 'react';
import { C } from '../../config/tokens.js';

const TABS = [
  { id: 'P10', label: '味道桌', icon: '🍲' },
  { id: 'P20', label: '家谱',   icon: '🌳' },
  { id: 'P40', label: '动态',   icon: '💬' },
  { id: 'P50', label: '我的',   icon: '👤' },
];

export default function BottomNav({ current, onChange, onAdd }) {
  return (
    <div style={{
      height: 56, display: 'flex', alignItems: 'center',
      background: '#FFFDF8', borderTop: `1px solid ${C.border}`,
      padding: '0 8px', flexShrink: 0,
      paddingBottom: 'env(safe-area-inset-bottom)',
    }}>
      {TABS.map((tab, i) => (
        <React.Fragment key={tab.id}>
          <button
            onClick={() => onChange && onChange(tab.id)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 2,
              border: 'none', background: 'transparent',
              cursor: 'pointer', fontFamily: 'inherit',
              padding: '6px 0',
            }}
          >
            <span style={{ fontSize: 20, opacity: current === tab.id ? 1 : 0.45 }}>
              {tab.icon}
            </span>
            <span style={{
              fontSize: 10, fontWeight: current === tab.id ? 600 : 400,
              color: current === tab.id ? C.primary : C.t3,
            }}>
              {tab.label}
            </span>
          </button>
          {i === 1 && (
            /* Center + button */
            <button
              onClick={onAdd}
              style={{
                width: 44, height: 44, borderRadius: '50%',
                background: C.primary, color: '#fff', border: 'none',
                cursor: 'pointer', fontSize: 24, fontWeight: 300,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, margin: '0 4px',
                boxShadow: '0 4px 12px rgba(40,91,78,0.3)',
                fontFamily: 'inherit', lineHeight: 1,
              }}
            >
              +
            </button>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}
