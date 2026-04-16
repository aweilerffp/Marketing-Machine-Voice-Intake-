'use client';

import { motion } from 'framer-motion';
import { ACCENT, GREEN, MUTED, DIM, TEXT, BORDER } from '../design-tokens';

const STAGES = [
  { key: 'analyzing', label: 'Analyzing Transcript', icon: '\uD83D\uDD0D' },
  { key: 'extracting', label: 'Extracting Insights', icon: '\u2699\uFE0F' },
  { key: 'validating', label: 'Validating Coverage', icon: '\u2705' },
  { key: 'complete', label: 'Complete', icon: '\uD83C\uDF89' },
];

export default function StageProgress({ currentStage }) {
  const currentIdx = STAGES.findIndex(s => s.key === currentStage);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}>
      {STAGES.map((stage, i) => {
        const isActive = i === currentIdx;
        const isDone = i < currentIdx;
        const isPending = i > currentIdx;

        return (
          <motion.div
            key={stage.key}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1, duration: 0.3 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              padding: '12px 16px',
              borderRadius: 8,
              background: isActive ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
              border: `1px solid ${isActive ? 'rgba(59, 130, 246, 0.2)' : 'transparent'}`,
            }}
          >
            {/* Icon/status */}
            <div style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              background: isDone ? GREEN : isActive ? ACCENT : BORDER,
              transition: 'background 0.3s',
            }}>
              {isDone ? '\u2713' : stage.icon}
            </div>

            {/* Label */}
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 15,
                fontWeight: isActive ? 600 : 400,
                color: isPending ? DIM : TEXT,
              }}>
                {stage.label}
              </div>
            </div>

            {/* Spinner for active */}
            {isActive && (
              <div style={{
                width: 20,
                height: 20,
                border: `2px solid ${BORDER}`,
                borderTopColor: ACCENT,
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }} />
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
