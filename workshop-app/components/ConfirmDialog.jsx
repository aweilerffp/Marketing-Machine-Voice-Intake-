'use client';

import { CARD, BORDER, MUTED, RED } from './design-tokens';

export default function ConfirmDialog({ title, body, confirmLabel = 'Confirm', onCancel, onConfirm, icon = '⚠️' }) {
  return (
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
        <div style={{ fontSize: 32, marginBottom: 12 }}>{icon}</div>
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>
          {title}
        </h3>
        <div style={{ color: MUTED, fontSize: 14, lineHeight: 1.5, marginBottom: 24 }}>
          {body}
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button
            onClick={onCancel}
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
            onClick={onConfirm}
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
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
