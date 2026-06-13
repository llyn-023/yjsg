// src/context/AppContext.jsx — 全局应用上下文

import React from 'react';

export const AppContext = React.createContext({
  navigate: (id) => {},
  showToast: (msg) => {},
  goBack: () => {},
});

export function useApp() {
  return React.useContext(AppContext);
}

export default AppContext;
