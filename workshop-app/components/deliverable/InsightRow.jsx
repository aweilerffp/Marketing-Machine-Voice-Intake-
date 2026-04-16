'use client';

import { MUTED, DIM, TEXT, BORDER } from '../design-tokens';

export default function InsightRow({ insight }) {
  return (
    <div style={{
      display: 'flex',
      gap: 12,
      padding: '10px 0',
      borderBottom: `1px solid ${BORDER}`,
    }}>
      <div style={{
        fontSize: 12,
        fontWeight: 700,
        color: MUTED,
        minWidth: 120,
        textTransform: 'uppercase',
        letterSpacing: '0.03em',
        paddingTop: 2,
      }}>
        {insight.label}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, color: TEXT, lineHeight: 1.5 }}>
          {insight.value}
        </div>
        {insight.evidence && (
          <div style={{
            fontSize: 12,
            color: DIM,
            marginTop: 4,
            fontStyle: 'italic',
          }}>
            Evidence: {insight.evidence}
          </div>
        )}
      </div>
    </div>
  );
}
