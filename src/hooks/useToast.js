// src/hooks/useToast.js — Toast 消息管理

import { useState, useRef, useCallback } from 'react';

export function useToast(duration = 2200) {
  const [toast, setToast] = useState({ msg: '', on: false });
  const timerRef = useRef(null);

  const showToast = useCallback((msg) => {
    clearTimeout(timerRef.current);
    setToast({ msg, on: true });
    timerRef.current = setTimeout(() => {
      setToast(t => ({ ...t, on: false }));
    }, duration);
  }, [duration]);

  return { toast, showToast };
}
