'use client';

import { CARD, BORDER, MUTED, DIM, TEXT, GREEN, AMBER, RED } from '../design-tokens';

const DEPTH_COLORS = {
  fully_covered: GREEN,
  partially_covered: AMBER,
  not_covered: RED,
};

const DEPTH_LABELS = {
  fully_covered: 'Full',
  partially_covered: 'Partial',
  not_covered: 'Gap',
};

export default function CoverageBar({ coverageCheck }) {
  if (!coverageCheck || coverageCheck.length === 0) return null;

  const counts = {
    fully_covered: coverageCheck.filter(q => q.coverage_depth === 'fully_covered').length,
    partially_covered: coverageCheck.filter(q => q.coverage_depth === 'partially_covered').length,
    not_covered: coverageCheck.filter(q => q.coverage_depth === 'not_covered').length,
  };
  const total = coverageCheck.length;

  return (
    <div style={{
      background: CARD,
      border: `1px solid ${BORDER}`,
      borderRadius: 12,
      padding: '16px 20px',
      marginBottom: 16,
    }}>
      <h4 style={{
        fontSize: 11,
        fontWeight: 700,
        color: MUTED,
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: 12,
      }}>
        Coverage Summary
      </h4>

      {/* Bar */}
      <div style={{
        display: 'flex',
        height: 8,
        borderRadius: 4,
        overflow: 'hidden',
        background: BORDER,
        marginBottom: 12,
      }}>
        {counts.fully_covered > 0 && (
          <div style={{
            width: `${(counts.fully_covered / total) * 100}%`,
            background: GREEN,
            transition: 'width 0.5s',
          }} />
        )}
        {counts.partially_covered > 0 && (
          <div style={{
            width: `${(counts.partially_covered / total) * 100}%`,
            background: AMBER,
            transition: 'width 0.5s',
          }} />
        )}
        {counts.not_covered > 0 && (
          <div style={{
            width: `${(counts.not_covered / total) * 100}%`,
            background: RED,
            transition: 'width 0.5s',
          }} />
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
        {Object.entries(counts).map(([key, count]) => (
          count > 0 && (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: DEPTH_COLORS[key],
              }} />
              <span style={{ color: MUTED }}>
                {count} {DEPTH_LABELS[key]}
              </span>
            </div>
          )
        ))}
      </div>

      {/* Gaps list */}
      {counts.not_covered > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 11, color: RED, fontWeight: 600, marginBottom: 4 }}>
            Gaps to address:
          </div>
          {coverageCheck
            .filter(q => q.coverage_depth === 'not_covered')
            .map(q => (
              <div key={q.question_number} style={{
                fontSize: 12,
                color: DIM,
                padding: '4px 0',
              }}>
                Q{q.question_number}: {q.question_text}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
