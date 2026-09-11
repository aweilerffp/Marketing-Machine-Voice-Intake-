'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { TEXT, MUTED, DIM } from '../design-tokens';

const MAX_PRIOR = 2;

export default function QuestionStack({ transcript, isActive, sectionColor }) {
  const questions = extractAgentQuestions(transcript);
  const current = questions[questions.length - 1] || null;
  const prior = questions.slice(Math.max(0, questions.length - 1 - MAX_PRIOR), questions.length - 1);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 10,
      padding: '24px 32px 8px',
      minHeight: 200,
      width: '100%',
    }}>
      <AnimatePresence initial={false}>
        {prior.map((q, i) => (
          <motion.div
            key={q + i}
            layout
            initial={{ opacity: 0, y: 8 }}
            animate={{
              opacity: 0.3 - i * 0.08,
              y: 0,
              scale: 0.85 - i * 0.04,
            }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            style={{
              fontSize: 14,
              color: MUTED,
              textAlign: 'center',
              maxWidth: 640,
              lineHeight: 1.4,
            }}
          >
            {q}
          </motion.div>
        ))}
      </AnimatePresence>

      <AnimatePresence mode="wait" initial={false}>
        {current ? (
          <motion.div
            key={current}
            layout
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            style={{
              fontSize: 26,
              lineHeight: 1.35,
              fontWeight: 600,
              color: TEXT,
              textAlign: 'center',
              maxWidth: 720,
              letterSpacing: '-0.01em',
            }}
          >
            {current}
          </motion.div>
        ) : (
          <motion.div
            key="placeholder"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              fontSize: 18,
              color: DIM,
              textAlign: 'center',
              fontStyle: 'italic',
            }}
          >
            {isActive ? 'Starting conversation…' : 'Connecting…'}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function extractAgentQuestions(transcript) {
  if (!transcript || !transcript.trim()) return [];
  const parts = transcript.split(/\n(?=[QA]:)/);
  const result = [];
  for (const part of parts) {
    const trimmed = part.trim();
    if (trimmed.startsWith('Q:')) {
      result.push(trimmed.slice(2).replace(/\s*\[interrupted\]\s*$/, '').trim());
    }
  }
  return result;
}
