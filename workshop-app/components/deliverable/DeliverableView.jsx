'use client';

import { motion } from 'framer-motion';
import { useWorkshopSession } from '../../hooks/useWorkshopSession';
import { currentSectionFromPhase, SECTIONS } from '../../lib/constants';
import ThemeCard from './ThemeCard';
import CoverageBar from './CoverageBar';
import { CARD, CARD2, BORDER, MUTED, DIM, TEXT, ACCENT } from '../design-tokens';

const NEXT_PHASE = { A: 'SB_INT', B: 'SC_INT', C: 'COMPLETE' };

export default function DeliverableView() {
  const { state, dispatch } = useWorkshopSession();
  const sectionLetter = currentSectionFromPhase(state.currentPhase);
  const meta = SECTIONS[sectionLetter];
  const sectionData = state[meta.stateKey];
  const data = sectionData.extractedData;

  if (!data) {
    return (
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
      }}>
        <div style={{ textAlign: 'center', color: MUTED }}>
          <p>No extraction data available. Run the generation step first.</p>
          <button
            onClick={() => dispatch({ type: 'SET_PHASE', phase: `S${sectionLetter}_GEN` })}
            style={{
              marginTop: 16,
              padding: '8px 20px',
              fontSize: 14,
              background: meta.color,
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            Go to Generation
          </button>
        </div>
      </div>
    );
  }

  const themes = data.themes ? Object.entries(data.themes) : [];
  const nuggets = sectionData.nuggets || [];

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      padding: '32px 40px',
    }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          style={{ textAlign: 'center', marginBottom: 32 }}
        >
          <div style={{ fontSize: 48, marginBottom: 12 }}>{meta.icon}</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>
            {meta.deliv}
          </h1>
          <p style={{ color: MUTED, fontSize: 15 }}>
            Extracted from your {meta.label} discovery session
          </p>
        </motion.div>

        {/* Theme cards */}
        {themes.map(([key, theme], i) => (
          <ThemeCard
            key={key}
            theme={theme}
            index={i}
            sectionColor={meta.color}
          />
        ))}

        {/* Coverage */}
        {data.coverage_check && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: themes.length * 0.1 }}
          >
            <CoverageBar coverageCheck={data.coverage_check} />
          </motion.div>
        )}

        {/* Nuggets collected during session */}
        {nuggets.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: themes.length * 0.1 + 0.1 }}
            style={{
              background: CARD,
              border: `1px solid ${BORDER}`,
              borderRadius: 12,
              padding: '16px 20px',
              marginBottom: 16,
            }}
          >
            <h4 style={{
              fontSize: 11,
              fontWeight: 700,
              color: MUTED,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 12,
            }}>
              {'\u2728'} Session Highlights ({nuggets.length})
            </h4>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {nuggets.map((n, i) => (
                <span key={i} style={{
                  padding: '6px 12px',
                  fontSize: 12,
                  background: 'rgba(59, 130, 246, 0.08)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  borderRadius: 20,
                  color: TEXT,
                }}>
                  {n.text}
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* Client Reflection */}
        {data.client_reflection && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: themes.length * 0.1 + 0.2 }}
            style={{
              background: CARD,
              border: `1px solid ${BORDER}`,
              borderRadius: 12,
              padding: '20px 24px',
              marginBottom: 32,
            }}
          >
            <h4 style={{
              fontSize: 11,
              fontWeight: 700,
              color: MUTED,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 12,
            }}>
              {'\uD83D\uDCAD'} Reflection
            </h4>
            <p style={{
              fontSize: 14,
              color: TEXT,
              lineHeight: 1.7,
            }}>
              {data.client_reflection}
            </p>
          </motion.div>
        )}

        {/* Continue button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: themes.length * 0.1 + 0.3 }}
          style={{ textAlign: 'center', paddingBottom: 40 }}
        >
          <button
            onClick={() => dispatch({ type: 'SET_PHASE', phase: NEXT_PHASE[sectionLetter] })}
            style={{
              padding: '14px 32px',
              fontSize: 16,
              fontWeight: 600,
              background: meta.color,
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              cursor: 'pointer',
              transition: 'transform 0.2s',
            }}
            onMouseEnter={e => e.target.style.transform = 'scale(1.02)'}
            onMouseLeave={e => e.target.style.transform = 'scale(1)'}
          >
            {sectionLetter === 'C' ? '\uD83C\uDF89 Complete Workshop' : `Continue to ${SECTIONS[sectionLetter === 'A' ? 'B' : 'C'].label} \u2192`}
          </button>
        </motion.div>
      </div>
    </div>
  );
}
