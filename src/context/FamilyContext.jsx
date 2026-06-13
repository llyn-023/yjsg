// src/context/FamilyContext.jsx — 家族数据上下文
// 管理当前家族、家谱成员、关系边、称谓缓存

import React, { createContext, useContext, useReducer } from 'react';
import { deriveAllKinship } from '../engine/kinship-derive.js';

const FamilyContext = createContext(null);

// ── Action Types ──
export const FamilyActions = {
  SET_FAMILY:      'SET_FAMILY',
  SWITCH_FAMILY:   'SWITCH_FAMILY',
  ADD_MEMBER:      'ADD_MEMBER',
  UPDATE_MEMBER:   'UPDATE_MEMBER',
  REMOVE_MEMBER:   'REMOVE_MEMBER',
  ADD_RELATION:    'ADD_RELATION',
  REMOVE_RELATION: 'REMOVE_RELATION',
  REFRESH_KINSHIP: 'REFRESH_KINSHIP',
};

function familyReducer(state, action) {
  switch (action.type) {
    case FamilyActions.SET_FAMILY:
      return { ...state, activeFamilyId: action.payload, members: action.members, relations: action.relations };

    case FamilyActions.SWITCH_FAMILY:
      return { ...state, activeFamilyId: action.payload };

    case FamilyActions.ADD_MEMBER:
      return { ...state, members: [...state.members, action.payload] };

    case FamilyActions.UPDATE_MEMBER:
      return {
        ...state,
        members: state.members.map(m => m.id === action.payload.id ? { ...m, ...action.payload } : m),
      };

    case FamilyActions.REMOVE_MEMBER:
      return {
        ...state,
        members: state.members.filter(m => m.id !== action.payload),
      };

    case FamilyActions.ADD_RELATION:
      return { ...state, relations: [...state.relations, action.payload] };

    case FamilyActions.REMOVE_RELATION:
      return {
        ...state,
        relations: state.relations.filter(r => r.id !== action.payload),
      };

    case FamilyActions.REFRESH_KINSHIP:
      return {
        ...state,
        kinshipCache: deriveAllKinship(state.members, state.relations),
      };

    default:
      return state;
  }
}

const initialState = {
  activeFamilyId: null,
  families: [],          // [{ id, name, surname }]
  members: [],           // FamilyMember[]
  relations: [],         // FamilyRelation[]
  kinshipCache: {},      // { [egoId]: { [alterId]: term } }
};

export function FamilyProvider({ children }) {
  const [state, dispatch] = useReducer(familyReducer, initialState);

  return (
    <FamilyContext.Provider value={{ state, dispatch }}>
      {children}
    </FamilyContext.Provider>
  );
}

export function useFamily() {
  const ctx = useContext(FamilyContext);
  if (!ctx) throw new Error('useFamily must be used within FamilyProvider');
  return ctx;
}

export default FamilyContext;
