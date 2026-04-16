'use client';

import { useWorkshopSession } from '../hooks/useWorkshopSession';
import { SECTIONS, currentSectionFromPhase, phaseType } from '../lib/constants';
import { CARD, BORDER, DIM, TEXT, MUTED } from './design-tokens';

const SECTION_ORDER = ['A', 'B', 'C'];

function sectionProgress(phase, sectionLetter) {
  const pt = phaseType(phase);
  const current = currentSectionFromPhase(phase);
  const currentIdx = SECTION_ORDER.indexOf(current);
  const thisIdx = SECTION_ORDER.indexOf(sectionLetter);

  if (thisIdx < currentIdx) return 1; // completed
  if (thisIdx > currentIdx) return 0; // not started
  // current section
  if (pt === 'INTERVIEW') return 0.33;
  if (pt === 'GENERATING') return 0.66;
  if (pt === 'REVIEW') return 0.9;
  return 0;
}

export default function ProgressBar() {
  const { state } = useWorkshopSession();
  const { currentPhase, clientName } = state;

  if (currentPhase === 'WELCOME') return null;

  return (
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
    </div>
  );
}
