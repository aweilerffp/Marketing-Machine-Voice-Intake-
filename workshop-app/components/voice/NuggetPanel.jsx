'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { BORDER, MUTED, DIM, TEXT } from '../design-tokens';

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

export default function NuggetPanel({ nuggets, sectionColor }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
    }}>
      <div style={{
        padding: '16px 20px',
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: MUTED }}>
            {'\u2728'} Key Insights
          </h3>
          {nuggets.length > 0 && (
            <span style={{
              fontSize: 11,
              fontWeight: 700,
              color: sectionColor,
              background: `rgba(59, 130, 246, 0.1)`,
              padding: '2px 8px',
              borderRadius: 10,
            }}>
              {nuggets.length}
            </span>
          )}
        </div>
        <p style={{ fontSize: 11, color: DIM, marginTop: 4 }}>
          Golden nuggets from the conversation
        </p>
      </div>

      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}>
        {nuggets.length === 0 && (
          <div style={{
            textAlign: 'center',
            padding: '40px 16px',
            color: DIM,
            fontSize: 13,
          }}>
            Insights will appear here as the conversation progresses...
          </div>
        )}

        <AnimatePresence>
          {nuggets.map((nugget, i) => {
            const color = CATEGORY_COLORS[nugget.category] || sectionColor;
            const icon = CATEGORY_ICONS[nugget.category] || '\u2728';

            return (
              <motion.div
                key={`${nugget.text}-${i}`}
                initial={{ scale: 0.8, opacity: 0, y: -10 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{
                  type: 'spring',
                  stiffness: 300,
                  damping: 20,
                  delay: 0.05,
                }}
                style={{
                  padding: '10px 14px',
                  background: `rgba(${hexToRgb(color)}, 0.08)`,
                  border: `1px solid rgba(${hexToRgb(color)}, 0.2)`,
                  borderRadius: 8,
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: TEXT,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>{icon}</span>
                  <div style={{ flex: 1 }}>
                    <div>&ldquo;{nugget.text}&rdquo;</div>
                    <div style={{
                      fontSize: 10,
                      color,
                      textTransform: 'uppercase',
                      fontWeight: 600,
                      letterSpacing: '0.05em',
                      marginTop: 4,
                    }}>
                      {nugget.category}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}
