// src/App.jsx — 应用根组件
// 路由 + Context Provider + Toast

import React, { useState, useCallback, useRef, useEffect } from 'react';
import AppContext from './context/AppContext.js';
import { AuthProvider } from './context/AuthContext.js';
import { FamilyProvider } from './context/FamilyContext.js';
import Toast from './components/ui/Toast.jsx';
import SCREENS from './config/routes.js';

// ── 动态页面导入 ──
// 页面组件通过 SCREENS 配置中的 page 字段延迟加载
// 在 Vite 构建环境中可改用 import() 动态导入
// 当前兼容 Babel Standalone：组件挂载到 window 后使用

const pageModules = {};

function getPageComponent(pageName) {
  if (pageModules[pageName]) return pageModules[pageName];
  // 尝试从全局 window 获取（Babel Standalone 模式）
  if (typeof window !== 'undefined' && window[pageName]) {
    pageModules[pageName] = window[pageName];
    return window[pageName];
  }
  return null;
}

export default function App() {
  // ── 路由 ──
  const initId = () => {
    if (typeof window === 'undefined') return 'P0';
    const h = window.location.hash.slice(1);
    return SCREENS.find(s => s.id === h) ? h : 'P0';
  };

  const [screenId, setScreenId] = useState(initId);
  const [history, setHistory] = useState([initId()]);
  const [animDir, setAnimDir] = useState(1);

  // ── Toast ──
  const [toast, setToast] = useState({ msg: '', on: false });
  const toastRef = useRef();

  const showToast = useCallback((msg) => {
    clearTimeout(toastRef.current);
    setToast({ msg, on: true });
    toastRef.current = setTimeout(() => setToast(t => ({ ...t, on: false })), 2200);
  }, []);

  // ── 导航 ──
  const navigate = useCallback((id) => {
    if (id === -1) {
      setHistory(h => {
        const nh = [...h];
        nh.pop();
        const prev = nh[nh.length - 1] || 'P0';
        setScreenId(prev);
        setAnimDir(-1);
        if (typeof window !== 'undefined') window.location.hash = prev;
        return nh;
      });
    } else {
      const curIdx = SCREENS.findIndex(s => s.id === screenId);
      const newIdx = SCREENS.findIndex(s => s.id === id);
      setAnimDir(newIdx >= curIdx ? 1 : -1);
      setScreenId(id);
      if (typeof window !== 'undefined') window.location.hash = id;
      setHistory(h => [...h, id]);
    }
  }, [screenId]);

  const goBack = useCallback(() => navigate(-1), [navigate]);

  // ── Hash 变化监听 ──
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onHash = () => {
      const id = window.location.hash.slice(1);
      if (SCREENS.find(s => s.id === id) && id !== screenId) {
        setScreenId(id);
        setHistory(h => [...h, id]);
      }
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [screenId]);

  // ── 渲染 ──
  const curScreen = SCREENS.find(s => s.id === screenId) || SCREENS[0];
  const PageComp = getPageComponent(curScreen.page);

  return (
    <AppContext.Provider value={{ navigate, showToast, goBack }}>
      <AuthProvider>
        <FamilyProvider>
          <div style={{
            width: '100%', height: '100dvh',
            position: 'relative', overflow: 'hidden',
            background: '#FAF7F2',
            fontFamily: '"PingFang SC","Hiragino Sans GB",-apple-system,system-ui,sans-serif',
          }}>
            {/* Page content with transition */}
            <div
              key={screenId}
              style={{
                position: 'absolute', inset: 0,
                animation: `slideIn${animDir > 0 ? 'Right' : 'Left'} 0.28s cubic-bezier(0.32,0,0.2,1) forwards`,
              }}
            >
              {PageComp ? <PageComp /> : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#A09590' }}>
                  页面加载中…
                </div>
              )}
            </div>

            {/* Global Toast */}
            <Toast message={toast.msg} visible={toast.on} />
          </div>
        </FamilyProvider>
      </AuthProvider>
    </AppContext.Provider>
  );
}
