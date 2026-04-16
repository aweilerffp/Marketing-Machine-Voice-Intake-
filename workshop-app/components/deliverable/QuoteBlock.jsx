'use client';

import { ACCENT, MUTED, DIM, TEXT, BORDER } from '../design-tokens';

export default function QuoteBlock({ quote }) {
  return (
    <div style={{
      padding: '12px 16px',
      borderLeft: `3px solid ${ACCENT}`,
      background: 'rgba(59, 130, 246, 0.05)',
      borderRadius: '0 8px 8px 0',
      marginBottom: 8,
    }}>
      <div style={{
        fontSize: 14,
        color: TEXT,
        lineHeight: 1.6,
        fontStyle: 'italic',
      }}>
        &ldquo;{quote.quote}&rdquo;
      </div>
      <div style={{
        display: 'flex',
        gap: 12,
        marginTop: 8,
        fontSize: 12,
        color: DIM,
      }}>
        <span>— {quote.speaker}</span>
        {quote.context && <span>{'\u00B7'} {quote.context}</span>}
      </div>
    </div>
  );
}
