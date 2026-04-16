'use client';

import { useState } from 'react';
import { useWorkshopSession } from '../hooks/useWorkshopSession';
import { SECTIONS, currentSectionFromPhase, phaseType } from '../lib/constants';
import { clearSession } from '../lib/session';
import { CARD, BORDER, DIM, TEXT, MUTED, RED, ACCENT } from './design-tokens';

const SECTION_ORDER = ['A', 'B', 'C'];

function sectionProgress(phase, sectionLetter) {
  const pt = phaseType(phase);
  const current = currentSectionFromPhase(phase);
  const currentIdx = SECTION_ORDER.indexOf(current);
  const thisIdx = SECTION_ORDER.indexOf(sectionLetter);

  if (thisIdx < currentIdx) return 1;
  if (thisIdx > currentIdx) return 0;
  if (pt === 'INTERVIEW') return 0.33;
  if (pt === 'GENERATING') return 0.66;
  if (pt === 'REVIEW') return 0.9;
  return 0;
}

export default function ProgressBar() {
  const { state, dispatch } = useWorkshopSession();
  const { currentPhase, clientName } = state;
  const [showConfirm, setShowConfirm] = useState(false);

  if (currentPhase === 'WELCOME') return null;

  function handleReset() {
    clearSession();
    dispatch({ type: 'RESET' });
    setShowConfirm(false);
  }

  return (
    <>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '12px 24px',
        background: CARD,
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: TEXT, marginRight: 8 }}>
          {clientName}
        </span>

        {SECTION_ORDER.map(letter => {
          const meta = SECTIONS[letter];
          const progress = currentPhase === 'COMPLETE' ? 1 : sectionProgress(currentPhase, letter);

          return (
            <div key={letter} style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>{meta.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 4,
                }}>
                  <span style={{ fontSize: 11, color: progress > 0 ? meta.color : DIM, fontWeight: 600 }}>
                    {meta.label}
                  </span>
                  {progress >= 1 && (
                    <span style={{ fontSize: 11, color: meta.color }}>{'\u2713'}</span>
                  )}
                </div>
                <div style={{
                  height: 4,
                  background: BORDER,
                  borderRadius: 2,
                  overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%',
                    width: `${progress * 100}%`,
                    background: meta.color,
                    borderRadius: 2,
                    transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>
            </div>
          );
        })}

        <button
          onClick={() => setShowConfirm(true)}
          title="Reset session"
          style={{
            marginLeft: 8,
            padding: '6px 12px',
            fontSize: 12,
            fontWeight: 600,
            background: 'transparent',
            color: DIM,
            border: `1px solid ${BORDER}`,
            borderRadius: 6,
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.target.style.color = RED; e.target.style.borderColor = RED; }}
          onMouseLeave={e => { e.target.style.color = DIM; e.target.style.borderColor = BORDER; }}
        >
          Reset
        </button>
      </div>

      {/* Confirmation modal */}
      {showConfirm && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
        }}>
          <div style={{
            background: CARD,
            border: `1px solid ${BORDER}`,
            borderRadius: 12,
            padding: '32px 36px',
            maxWidth: 400,
            textAlign: 'center',
            animation: 'fade-in 0.2s ease-out',
          }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>{'\u26A0\uFE0F'}</div>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
              Reset Session?
            </h3>
            <p style={{ color: MUTED, fontSize: 14, lineHeight: 1.5, marginBottom: 24 }}>
              This will erase all progress for <strong style={{ color: TEXT }}>{clientName}</strong> — transcripts, insights, and deliverables. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button
                onClick={() => setShowConfirm(false)}
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
                Cancel
              </button>
              <button
                onClick={handleReset}
                style={{
                  padding: '10px 24px',
                  fontSize: 14,
                  fontWeight: 600,
                  background: RED,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                Reset Everything
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
