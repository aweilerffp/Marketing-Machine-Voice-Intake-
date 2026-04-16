'use client';

import { useState } from 'react';
import { useWorkshopSession } from '../hooks/useWorkshopSession';
import { ACCENT, CARD, BORDER, TEXT, MUTED, DIM } from './design-tokens';

export default function WelcomeScreen() {
  const { state, dispatch } = useWorkshopSession();
  const [name, setName] = useState('');

  function handleStart(e) {
    e.preventDefault();
    if (!name.trim()) return;
    dispatch({ type: 'SET_CLIENT_NAME', name: name.trim() });
    dispatch({ type: 'SET_PHASE', phase: 'SA_INT' });
  }

  function handleResume() {
    // Session already loaded from localStorage — just stay on current phase
  }

  const hasSavedSession = state.clientName && state.currentPhase !== 'WELCOME';

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '40px 20px',
    }}>
      <div style={{
        maxWidth: 520,
        width: '100%',
        animation: 'fade-in 0.5s ease-out',
      }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>{'\uD83C\uDFA4'}</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
            Brand Builder Workshop
          </h1>
          <p style={{ color: MUTED, fontSize: 16, lineHeight: 1.5 }}>
            A voice-powered discovery session to uncover your brand voice,
            ideal customer profile, and marketing strategy.
          </p>
        </div>

        <div style={{
          background: CARD,
          border: `1px solid ${BORDER}`,
          borderRadius: 12,
          padding: 32,
        }}>
          <form onSubmit={handleStart}>
            <label style={{
              display: 'block',
              fontSize: 14,
              fontWeight: 600,
              color: MUTED,
              marginBottom: 8,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}>
              Company Name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Enter your company name"
              autoFocus
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: 16,
                background: '#0F172A',
                border: `1px solid ${BORDER}`,
                borderRadius: 8,
                color: TEXT,
                outline: 'none',
                marginBottom: 20,
              }}
              onFocus={e => e.target.style.borderColor = ACCENT}
              onBlur={e => e.target.style.borderColor = BORDER}
            />
            <button
              type="submit"
              disabled={!name.trim()}
              style={{
                width: '100%',
                padding: '12px 24px',
                fontSize: 16,
                fontWeight: 600,
                background: name.trim() ? ACCENT : DIM,
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                cursor: name.trim() ? 'pointer' : 'not-allowed',
                transition: 'background 0.2s',
              }}
            >
              Start Workshop
            </button>
          </form>

          {hasSavedSession && (
            <div style={{
              marginTop: 20,
              paddingTop: 20,
              borderTop: `1px solid ${BORDER}`,
              textAlign: 'center',
            }}>
              <p style={{ color: MUTED, fontSize: 14, marginBottom: 12 }}>
                You have a session in progress for <strong style={{ color: TEXT }}>{state.clientName}</strong>
              </p>
              <button
                onClick={handleResume}
                style={{
                  padding: '10px 20px',
                  fontSize: 14,
                  fontWeight: 600,
                  background: 'transparent',
                  color: ACCENT,
                  border: `1px solid ${ACCENT}`,
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                Resume Session
              </button>
            </div>
          )}
        </div>

        <div style={{
          marginTop: 32,
          display: 'flex',
          justifyContent: 'center',
          gap: 32,
        }}>
          {[
            { icon: '\uD83C\uDFA4', label: 'Brand Voice' },
            { icon: '\uD83C\uDFAF', label: 'Ideal Customer' },
            { icon: '\uD83D\uDCE1', label: 'Channels' },
          ].map(s => (
            <div key={s.label} style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 24, marginBottom: 4 }}>{s.icon}</div>
              <div style={{ fontSize: 12, color: DIM }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
