// src/context/AuthContext.jsx — 认证上下文

import React, { createContext, useContext, useReducer } from 'react';

const AuthContext = createContext(null);

export const AuthActions = {
  LOGIN:     'LOGIN',
  LOGOUT:    'LOGOUT',
  UPDATE_ME: 'UPDATE_ME',
};

function authReducer(state, action) {
  switch (action.type) {
    case AuthActions.LOGIN:
      return { ...state, isLoggedIn: true, user: action.payload };
    case AuthActions.LOGOUT:
      return { ...state, isLoggedIn: false, user: null };
    case AuthActions.UPDATE_ME:
      return { ...state, user: { ...state.user, ...action.payload } };
    default:
      return state;
  }
}

const initialState = {
  isLoggedIn: false,
  user: null,  // { id, username, nickname, avatar }
};

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  return (
    <AuthContext.Provider value={{ state, dispatch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export default AuthContext;
