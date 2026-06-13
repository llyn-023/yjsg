// src/components/ui/BottomSheet.jsx

import React from 'react';
import { C } from '../../config/tokens.js';

export default function BottomSheet({ open, onClose, title, children }) {
  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(28,16,8,0.42)', zIndex: 100,
          opacity: open ? 1 : 0, pointerEvents: open ? 'all' : 'none',
          transition: 'opacity 0.25s',
        }}
      />
      {/* Sheet */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: '#FFFDF8', borderRadius: '22px 22px 0 0', zIndex: 101,
        transform: open ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.32s cubic-bezier(0.32,0.72,0,1)',
        maxHeight: '84%', display: 'flex', flexDirection: 'column',
        boxShadow: '0 -4px 32px rgba(0,0,0,0.12)',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 0', flexShrink: 0 }}>
          <div style={{ width: 40, height: 4, background: '#D8CEBF', borderRadius: 2 }} />
        </div>
        {/* Title */}
        {title && (
          <div style={{
            padding: '10px 22px 14px', fontSize: 17, fontWeight: 700,
            color: C.t1, borderBottom: `1px solid ${C.border}`, flexShrink: 0,
          }}>
            {title}
          </div>
        )}
        {/* Content */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '16px 22px 24px',
          WebkitOverflowScrolling: 'touch',
        }}>
          {children}
        </div>
      </div>
    </>
  );
}
