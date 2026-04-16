'use client';

import { motion } from 'framer-motion';
import InsightRow from './InsightRow';
import QuoteBlock from './QuoteBlock';
import { CARD, BORDER, MUTED, DIM, TEXT, RED } from '../design-tokens';

export default function ThemeCard({ theme, index, sectionColor }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
      style={{
        background: CARD,
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 16,
      }}
    >
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: `1px solid ${BORDER}`,
        background: `linear-gradient(135deg, rgba(59, 130, 246, 0.05) 0%, transparent 100%)`,
      }}>
        <h3 style={{
          fontSize: 16,
          fontWeight: 700,
          color: TEXT,
        }}>
          {theme.section_title}
        </h3>
      </div>

      <div style={{ padding: '16px 20px' }}>
        {/* Insights */}
        {theme.insights && theme.insights.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <h4 style={{
              fontSize: 11,
              fontWeight: 700,
              color: MUTED,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 8,
            }}>
              Insights
            </h4>
            {theme.insights.map((insight, i) => (
              <InsightRow key={i} insight={insight} />
            ))}
          </div>
        )}

        {/* Verbatim Quotes */}
        {theme.verbatim_quotes && theme.verbatim_quotes.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <h4 style={{
              fontSize: 11,
              fontWeight: 700,
              color: MUTED,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 8,
            }}>
              Verbatim Quotes
            </h4>
            {theme.verbatim_quotes.map((q, i) => (
              <QuoteBlock key={i} quote={q} />
            ))}
          </div>
        )}

        {/* Explicit Don'ts */}
        {theme.explicit_dont && theme.explicit_dont.length > 0 && (
          <div>
            <h4 style={{
              fontSize: 11,
              fontWeight: 700,
              color: RED,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 8,
            }}>
              {'\uD83D\uDEAB'} Explicit Don&apos;ts
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {theme.explicit_dont.map((item, i) => (
                <span key={i} style={{
                  padding: '4px 10px',
                  fontSize: 12,
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: 6,
                  color: RED,
                }}>
                  {item}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
