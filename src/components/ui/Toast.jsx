// src/components/ui/Toast.jsx

import React from 'react';

export default function Toast({ message, visible }) {
  return (
    <div style={{
      position: 'absolute', top: '50%', left: '50%',
      transform: 'translate(-50%,-50%)',
      background: 'rgba(22,50,40,0.94)', color: '#fff',
      fontSize: 14, fontWeight: 500, padding: '10px 22px',
      borderRadius: 10, zIndex: 200,
      opacity: visible ? 1 : 0, pointerEvents: 'none',
      transition: 'opacity 0.2s', whiteSpace: 'nowrap',
      boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
    }}>
      {message}
    </div>
  );
}
