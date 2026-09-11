'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { TEXT, DIM, MUTED } from '../design-tokens';

/**
 * Replaces the verbatim live caption. States:
 *  - user speaking     → "Listening…" pulse (no raw text shown)
 *  - summary pending   → "Capturing that…"
 *  - bullets available → 1-3 short bullets in the founder's words
 */
export default function AnswerSummary({ bullets, pending, userSpeaking, isSpeaking, isActive, accent }) {
  let mode = 'idle';
  if (!isActive) mode = 'idle';
  else if (userSpeaking) mode = 'listening';
  else if (pending) mode = 'pending';
  else if (bullets && bullets.length) mode = 'bullets';
  else if (!isSpeaking) mode = 'listening';

  const key = mode === 'bullets' ? 'b:' + bullets.join('|') : mode;

  return (
    <div style={{
      padding: '20px 32px 32px',
      width: '100%',
      display: 'flex',
      justifyContent: 'center',
      minHeight: 96,
    }}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={key}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          style={{ maxWidth: 720, width: '100%' }}
        >
          {mode === 'bullets' ? (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {bullets.map((b, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08, duration: 0.25 }}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    fontSize: 17,
                    lineHeight: 1.45,
                    color: TEXT,
                  }}
                >
                  <span style={{
                    marginTop: 9,
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: accent,
                    flexShrink: 0,
                  }} />
                  <span>{b}</span>
                </motion.li>
              ))}
            </ul>
          ) : (
            <div style={{
              textAlign: 'center',
              fontSize: 17,
              fontStyle: 'italic',
              color: mode === 'pending' ? MUTED : DIM,
              opacity: 0.7,
            }}>
              {mode === 'listening' ? 'Listening…' : mode === 'pending' ? 'Capturing that…' : ''}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
