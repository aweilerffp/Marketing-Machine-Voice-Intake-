'use client';

import { createContext, useContext, useReducer, useEffect, useRef, useCallback } from 'react';
import { defaultSession, saveSession, loadSession } from '../lib/session';

const WorkshopContext = createContext(null);

function reducer(state, action) {
  switch (action.type) {
    case 'INIT':
      return { ...action.session };

    case 'SET_CLIENT_NAME':
      return { ...state, clientName: action.name, startedAt: state.startedAt || new Date().toISOString() };

    case 'SET_PHASE':
      return { ...state, currentPhase: action.phase };

    case 'APPEND_TRANSCRIPT': {
      const key = action.sectionKey;
      return {
        ...state,
        [key]: { ...state[key], transcript: state[key].transcript + action.chunk },
      };
    }

    case 'ADD_NUGGET': {
      const key = action.sectionKey;
      return {
        ...state,
        [key]: { ...state[key], nuggets: [...state[key].nuggets, ...action.nuggets] },
      };
    }

    case 'SET_EXTRACTED_DATA': {
      const key = action.sectionKey;
      return {
        ...state,
        [key]: {
          ...state[key],
          extractedData: action.data,
          completedAt: new Date().toISOString(),
        },
      };
    }

    case 'RESET':
      return defaultSession();

    default:
      return state;
  }
}

export function WorkshopSessionProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, defaultSession());
  const initialized = useRef(false);

  // Load from localStorage on mount
  useEffect(() => {
    const saved = loadSession();
    if (saved) {
      dispatch({ type: 'INIT', session: saved });
    }
    initialized.current = true;
  }, []);

  // Persist to localStorage on changes (debounced)
  useEffect(() => {
    if (!initialized.current) return;
    const timer = setTimeout(() => saveSession(state), 500);
    return () => clearTimeout(timer);
  }, [state]);

  return (
    <WorkshopContext.Provider value={{ state, dispatch }}>
      {children}
    </WorkshopContext.Provider>
  );
}

export function useWorkshopSession() {
  const ctx = useContext(WorkshopContext);
  if (!ctx) throw new Error('useWorkshopSession must be used within WorkshopSessionProvider');
  return ctx;
}
