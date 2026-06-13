// src/components/ui/StatusBar.jsx

import React from 'react';
import { C } from '../../config/tokens.js';

export default function StatusBar({ dark = false }) {
  const fg = dark ? 'rgba(255,255,255,0.92)' : C.t1;
  return (
    <div style={{
      height: 54, display: 'flex', alignItems: 'flex-end',
      justifyContent: 'space-between', padding: '0 22px 10px',
      flexShrink: 0, position: 'relative', zIndex: 5,
    }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: fg, fontVariantNumeric: 'tabular-nums' }}>9:41</span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {/* Signal bars */}
        <svg width="17" height="12" viewBox="0 0 17 12" fill={fg}>
          <rect x="0" y="8" width="3" height="4" rx="1" opacity="0.38"/>
          <rect x="4.5" y="5" width="3" height="7" rx="1" opacity="0.65"/>
          <rect x="9" y="2" width="3" height="10" rx="1" opacity="0.88"/>
          <rect x="13.5" y="0" width="3" height="12" rx="1"/>
        </svg>
        {/* WiFi */}
        <svg width="16" height="12" viewBox="0 0 16 12" fill="none">
          <path d="M8 8.6a1.4 1.4 0 0 1 1 .4L8 11.2 7 9a1.4 1.4 0 0 1 1-.4Z" fill={fg}/>
          <path d="M5.5 6.8A3.5 3.5 0 0 1 8 5.8c1 0 1.9.4 2.5 1" stroke={fg} strokeWidth="1.2" fill="none" opacity="0.68"/>
          <path d="M2.8 4.2A7 7 0 0 1 8 2a7 7 0 0 1 5.2 2.2" stroke={fg} strokeWidth="1.2" fill="none" opacity="0.38"/>
        </svg>
        {/* Battery */}
        <svg width="26" height="13" viewBox="0 0 26 13" fill="none">
          <rect x="0.5" y="0.5" width="22" height="12" rx="3.5" stroke={fg} strokeOpacity="0.38"/>
          <rect x="1.5" y="1.5" width="16" height="10" rx="2.5" fill={fg}/>
          <path d="M23 4.5v4c1.2-.5 1.2-3.5 0-4Z" fill={fg} fillOpacity="0.4"/>
        </svg>
      </div>
    </div>
  );
}
