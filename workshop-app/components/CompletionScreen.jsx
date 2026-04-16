'use client';

import { useWorkshopSession } from '../hooks/useWorkshopSession';
import { SECTIONS } from '../lib/constants';
import { CARD, BORDER, MUTED, GREEN, ACCENT } from './design-tokens';
import { clearSession } from '../lib/session';

export default function CompletionScreen() {
  const { state, dispatch } = useWorkshopSession();

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
    }}>
      <div style={{
        background: CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        padding: 40,
        textAlign: 'center',
        maxWidth: 520,
        animation: 'fade-in 0.5s ease-out',
      }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>{'\uD83C\uDF89'}</div>
        <h2 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8, color: GREEN }}>
          Workshop Complete!
        </h2>
        <p style={{ color: MUTED, fontSize: 16, lineHeight: 1.5, marginBottom: 32 }}>
          All three discovery sections are done for <strong style={{ color: '#E2E8F0' }}>{state.clientName}</strong>.
          Your deliverables are ready.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
          {['A', 'B', 'C'].map(letter => {
            const meta = SECTIONS[letter];
            const section = state[meta.stateKey];
            const hasData = !!section.extractedData;
            return (
              <div key={letter} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                background: '#0F172A',
                borderRadius: 8,
                border: `1px solid ${BORDER}`,
              }}>
                <span style={{ fontSize: 20 }}>{meta.icon}</span>
                <span style={{ flex: 1, textAlign: 'left', fontSize: 14, fontWeight: 600 }}>
                  {meta.deliv}
                </span>
                <span style={{ fontSize: 12, color: hasData ? GREEN : MUTED }}>
                  {hasData ? 'Generated' : 'Pending'}
                </span>
              </div>
            );
          })}
        </div>

        <button
          onClick={() => {
            clearSession();
            dispatch({ type: 'RESET' });
          }}
          style={{
            padding: '10px 24px',
            fontSize: 14,
            fontWeight: 600,
            background: 'transparent',
            color: MUTED,
            border: `1px solid ${BORDER}`,
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          Start New Session
        </button>
      </div>
    </div>
  );
}
