'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useWorkshopSession } from '../../hooks/useWorkshopSession';
import { currentSectionFromPhase, SECTIONS } from '../../lib/constants';
import StageProgress from './StageProgress';
import { CARD, BORDER, MUTED, DIM, TEXT, RED } from '../design-tokens';

const STAGE_SEQUENCE = ['analyzing', 'extracting', 'validating', 'complete'];
const STAGE_DELAYS = [2000, 0, 1500]; // delay before transitioning from analyzing to extracting, etc.

export default function GeneratingScreen() {
  const { state, dispatch } = useWorkshopSession();
  const sectionLetter = currentSectionFromPhase(state.currentPhase);
  const meta = SECTIONS[sectionLetter];
  const sectionData = state[meta.stateKey];

  const [stage, setStage] = useState('analyzing');
  const [error, setError] = useState(null);
  const extractionStarted = useRef(false);

  useEffect(() => {
    if (extractionStarted.current) return;
    extractionStarted.current = true;

    async function runExtraction() {
      // Stage 1: Analyzing (visual delay)
      setStage('analyzing');
      await delay(STAGE_DELAYS[0]);

      // Stage 2: Extracting (actual API call)
      setStage('extracting');
      try {
        const res = await fetch('/api/extract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            transcript: sectionData.transcript,
            section: meta.key,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || `API error: ${res.status}`);
        }

        const result = await res.json();

        // Stage 3: Validating (visual delay)
        setStage('validating');
        await delay(STAGE_DELAYS[2]);

        // Stage 4: Complete
        setStage('complete');

        // Save result and advance
        dispatch({
          type: 'SET_EXTRACTED_DATA',
          sectionKey: meta.stateKey,
          data: result,
        });

        // Brief pause to show completion
        await delay(1000);
        dispatch({ type: 'SET_PHASE', phase: `S${sectionLetter}_REV` });
      } catch (err) {
        console.error('Extraction failed:', err);
        setError(err.message);
      }
    }

    runExtraction();
  }, []);

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 40,
    }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          background: CARD,
          border: `1px solid ${BORDER}`,
          borderRadius: 16,
          padding: '48px 40px',
          maxWidth: 480,
          width: '100%',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16 }}>{meta.icon}</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
          Generating {meta.deliv}
        </h2>
        <p style={{ color: MUTED, fontSize: 14, marginBottom: 32 }}>
          Analyzing your conversation and extracting structured insights...
        </p>

        <StageProgress currentStage={stage} />

        {error && (
          <div style={{
            marginTop: 24,
            padding: '12px 16px',
            background: 'rgba(239, 68, 68, 0.1)',
            border: `1px solid rgba(239, 68, 68, 0.3)`,
            borderRadius: 8,
            fontSize: 13,
            color: RED,
            textAlign: 'left',
          }}>
            <strong>Error:</strong> {error}
            <button
              onClick={() => {
                setError(null);
                extractionStarted.current = false;
                setStage('analyzing');
              }}
              style={{
                display: 'block',
                marginTop: 8,
                padding: '6px 16px',
                fontSize: 12,
                fontWeight: 600,
                background: RED,
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
