'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { TEXT, DIM } from '../design-tokens';

export default function LiveTranscript({ utterance, isSpeaking, isActive }) {
  const placeholder = !isActive
    ? ''
    : isSpeaking
      ? ''
      : 'Listening…';

  const text = utterance || placeholder;
  const isPlaceholder = !utterance;

  return (
    <div style={{
      padding: '20px 32px 32px',
      width: '100%',
      display: 'flex',
      justifyContent: 'center',
      minHeight: 80,
    }}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={text || 'empty'}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: isPlaceholder ? 0.5 : 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          style={{
            fontSize: 18,
            lineHeight: 1.5,
            fontStyle: isPlaceholder ? 'italic' : 'normal',
            color: isPlaceholder ? DIM : TEXT,
            textAlign: 'center',
            maxWidth: 720,
          }}
        >
          {text}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
