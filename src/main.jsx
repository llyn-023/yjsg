// src/main.jsx — 应用入口
// 兼容两种模式：
//   1. Vite 构建：import React from 'react'; import ReactDOM from 'react-dom/client';
//   2. Babel Standalone（原型兼容）：React 和 ReactDOM 已全局注入

import App from './App.jsx';

// 检测运行环境
const isStandalone = typeof window !== 'undefined' && window.React && window.ReactDOM && !window.__VITE_DEV__;

if (isStandalone) {
  // Babel Standalone 模式：组件通过 window 全局暴露
  window.App = App;
} else {
  // Vite / 标准构建模式
  import('react').then(React => {
    import('react-dom/client').then(ReactDOM => {
      const root = ReactDOM.createRoot(document.getElementById('root'));
      root.render(React.createElement(App));
    });
  });
}

export default App;
