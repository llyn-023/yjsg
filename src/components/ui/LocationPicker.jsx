// src/components/ui/LocationPicker.jsx — 省市二级选择器
// 标签支持自定义，默认"故乡 / 籍贯"

import React, { useState } from 'react';
import BottomSheet from './BottomSheet.jsx';
import { C } from '../../config/tokens.js';
import { CN_REGIONS, PROVINCES } from '../../utils/china-regions.js';

export default function LocationPicker({ value, onChange, disabled, label }) {
  const [open, setOpen] = useState(false);
  const parts = (value || '').split(' · ');
  const initProv = parts.length > 1 ? parts[0] : PROVINCES[0];
  const [selProv, setSelProv] = useState(initProv);

  return (
    <>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.t2, marginBottom: 6 }}>
          {label || '故乡 / 籍贯'}
        </div>
        <button
          onClick={() => {
            if (!disabled) {
              setSelProv(parts.length > 1 ? parts[0] : PROVINCES[0]);
              setOpen(true);
            }
          }}
          style={{
            width: '100%', height: 44, padding: '0 14px',
            background: '#FFFDF8', border: '1px solid ' + C.border,
            borderRadius: 10, cursor: disabled ? 'default' : 'pointer',
            fontFamily: 'inherit', textAlign: 'left', fontSize: 14,
            color: value ? C.t1 : C.t3,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            opacity: disabled ? 0.6 : 1,
          }}
        >
          <span>{value || '选择省市'}</span>
          {!disabled && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M6 9l6 6 6-6" stroke={C.t3} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </button>
      </div>

      {open && (
        <BottomSheet open={open} onClose={() => setOpen(false)} title="选择地区">
          <div style={{ display: 'flex', height: 260, gap: 0 }}>
            {/* Province list */}
            <div style={{ width: 110, overflowY: 'auto', borderRight: '1px solid ' + C.border, flexShrink: 0 }}>
              {PROVINCES.map(p => (
                <button
                  key={p}
                  onClick={() => setSelProv(p)}
                  style={{
                    width: '100%', padding: '11px 12px',
                    background: selProv === p ? C.primaryPale : 'transparent',
                    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                    fontSize: 13, color: selProv === p ? C.primary : C.t1,
                    fontWeight: selProv === p ? 700 : 400,
                    textAlign: 'left',
                    borderLeft: selProv === p ? '2.5px solid ' + C.primary : '2.5px solid transparent',
                    boxSizing: 'border-box',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
            {/* City list */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {selProv && (CN_REGIONS[selProv] || []).map(city => {
                const full = selProv + ' · ' + city;
                const sel = value === full;
                return (
                  <button
                    key={city}
                    onClick={() => { onChange(full); setOpen(false); }}
                    style={{
                      width: '100%', padding: '11px 14px',
                      background: sel ? C.primaryPale : 'transparent',
                      border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                      fontSize: 13, color: sel ? C.primary : C.t1,
                      fontWeight: sel ? 700 : 400, textAlign: 'left',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}
                  >
                    {city}
                    {sel && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M5 13l4 4L19 7" stroke={C.primary} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </BottomSheet>
      )}
    </>
  );
}
