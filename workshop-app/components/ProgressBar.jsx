'use client';

import { useState } from 'react';
import { useWorkshopSession } from '../hooks/useWorkshopSession';
import { SECTIONS, currentSectionFromPhase, phaseType } from '../lib/constants';
import { clearSession } from '../lib/session';
import ConfirmDialog from './ConfirmDialog';
import { CARD, BORDER, DIM, TEXT, RED } from './design-tokens';

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
        <ConfirmDialog
          title="Reset Session?"
          body={<>This will erase all progress for <strong style={{ color: TEXT }}>{clientName}</strong> — transcripts, insights, and deliverables. This cannot be undone.</>}
          confirmLabel="Reset Everything"
          onCancel={() => setShowConfirm(false)}
          onConfirm={handleReset}
        />
      )}
    </>
  );
}
