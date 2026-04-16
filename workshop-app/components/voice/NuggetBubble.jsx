'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TEXT, ACCENT } from '../design-tokens';

const CATEGORY_COLORS = {
  quote: '#3B82F6',
  insight: '#22C55E',
  value: '#F59E0B',
  boundary: '#EF4444',
};

const CATEGORY_ICONS = {
  quote: '\uD83D\uDCAC',
  insight: '\uD83D\uDCA1',
  value: '\u2764\uFE0F',
  boundary: '\uD83D\uDEAB',
};

/**
 * Animated nugget bubble that pops up, holds, then fades out.
 * The NuggetPanel handles the "landed" state.
 */
export default function NuggetBubble({ nugget, onComplete }) {
  const [phase, setPhase] = useState('pop'); // pop -> hold -> exit

  useEffect(() => {
    // Pop -> Hold after 300ms
    const holdTimer = setTimeout(() => setPhase('hold'), 300);
    // Hold -> Exit after 2000ms total
    const exitTimer = setTimeout(() => setPhase('exit'), 2200);
    // Complete after exit animation
    const completeTimer = setTimeout(() => {
      if (onComplete) onComplete();
    }, 2800);

    return () => {
      clearTimeout(holdTimer);
      clearTimeout(exitTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  const color = CATEGORY_COLORS[nugget.category] || ACCENT;
  const icon = CATEGORY_ICONS[nugget.category] || '\u2728';

  return (
    <AnimatePresence>
      {phase !== 'exit' ? null : null}
      <motion.div
        initial={{ scale: 0, opacity: 0, y: 20 }}
        animate={
          phase === 'pop'
            ? { scale: [0, 1.15, 1], opacity: 1, y: 0 }
            : phase === 'hold'
            ? { scale: 1, opacity: 1, y: 0 }
            : { scale: 0.85, opacity: 0, y: -30, x: 100 }
        }
        transition={
          phase === 'pop'
            ? { duration: 0.3, ease: 'easeOut' }
            : phase === 'exit'
            ? { duration: 0.5, ease: [0.25, 0.1, 0.25, 1.0] }
            : { duration: 0.2 }
        }
        style={{
          position: 'fixed',
          bottom: 120,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100,
          maxWidth: 360,
          padding: '12px 18px',
          background: `rgba(${hexToRgb(color)}, 0.15)`,
          border: `1px solid rgba(${hexToRgb(color)}, 0.4)`,
          borderRadius: 12,
          backdropFilter: 'blur(12px)',
          boxShadow: `0 0 20px rgba(${hexToRgb(color)}, 0.3)`,
          animation: phase === 'hold' ? 'nugget-glow 1.5s ease-in-out infinite' : undefined,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>{icon}</span>
          <div>
            <div style={{
              fontSize: 14,
              fontWeight: 500,
              color: TEXT,
              lineHeight: 1.5,
            }}>
              &ldquo;{nugget.text}&rdquo;
            </div>
            <div style={{
              fontSize: 10,
              color,
              textTransform: 'uppercase',
              fontWeight: 700,
              letterSpacing: '0.08em',
              marginTop: 4,
            }}>
              {nugget.category}
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}
