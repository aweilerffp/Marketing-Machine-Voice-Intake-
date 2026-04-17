'use client';

import { SECTIONS } from '../../lib/constants';
import { BORDER, CARD2, DIM, MUTED } from '../design-tokens';

const ORDER = ['A', 'B', 'C'];

export default function TopicAgenda({ activeLetter }) {
  const active = SECTIONS[activeLetter];

  return (
    <div style={{
      padding: '14px 24px',
      borderBottom: `1px solid ${BORDER}`,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {ORDER.map((letter, i) => {
          const sec = SECTIONS[letter];
          const isActive = letter === activeLetter;
          return (
            <div key={letter} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                opacity: isActive ? 1 : 0.4,
                transition: 'opacity 0.3s',
              }}>
                <div style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: isActive ? sec.color : MUTED,
                  boxShadow: isActive ? `0 0 12px ${sec.color}` : 'none',
                  transition: 'all 0.3s',
                }} />
                <span style={{
                  fontSize: 12,
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? sec.color : MUTED,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  {sec.label}
                </span>
              </div>
              {i < ORDER.length - 1 && (
                <div style={{ width: 20, height: 1, background: BORDER }} />
              )}
            </div>
          );
        })}
      </div>

      {active && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {active.subtopics.map(t => (
            <span key={t} style={{
              fontSize: 11,
              color: DIM,
              background: CARD2,
              padding: '3px 10px',
              borderRadius: 12,
              border: `1px solid ${BORDER}`,
            }}>
              {t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
