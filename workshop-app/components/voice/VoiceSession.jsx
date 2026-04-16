'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useWorkshopSession } from '../../hooks/useWorkshopSession';
import { currentSectionFromPhase, SECTIONS } from '../../lib/constants';
import { useTranscriptStream } from './useTranscriptStream';
import { useNuggetDetection } from '../../hooks/useNuggetDetection';
import TranscriptStream from './TranscriptStream';
import NuggetPanel from './NuggetPanel';
import NuggetBubble from './NuggetBubble';
import { CARD, CARD2, BORDER, MUTED, DIM, RED, TEXT } from '../design-tokens';

export default function VoiceSession() {
  const { state, dispatch } = useWorkshopSession();
  const sectionLetter = currentSectionFromPhase(state.currentPhase);
  const meta = SECTIONS[sectionLetter];
  const sectionData = state[meta.stateKey];

  const [activeBubble, setActiveBubble] = useState(null);
  const transcriptSaved = useRef(false);

  const {
    transcript,
    currentSpeaker,
    isActive,
    isComplete,
    start,
    stop,
  } = useTranscriptStream(meta.key);

  const handleNuggetsFound = useCallback((nuggets) => {
    dispatch({ type: 'ADD_NUGGET', sectionKey: meta.stateKey, nuggets });
    if (nuggets.length > 0) {
      setActiveBubble(nuggets[0]);
    }
  }, [dispatch, meta.stateKey]);

  useNuggetDetection(transcript, isActive, handleNuggetsFound, sectionData.nuggets);

  useEffect(() => {
    start();
  }, [start]);

  function saveTranscriptOnce() {
    if (transcriptSaved.current || !transcript) return;
    transcriptSaved.current = true;
    // Use SET_TRANSCRIPT to replace (not append) — prevents double-saving
    dispatch({
      type: 'APPEND_TRANSCRIPT',
      sectionKey: meta.stateKey,
      chunk: transcript,
    });
  }

  // Save transcript when mock completes naturally
  useEffect(() => {
    if (isComplete) saveTranscriptOnce();
  }, [isComplete]);

  function handleEndSection() {
    stop();
    saveTranscriptOnce();
    dispatch({ type: 'SET_PHASE', phase: `S${sectionLetter}_GEN` });
  }

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Section header — pinned at top */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 24px',
        borderBottom: `1px solid ${BORDER}`,
        background: CARD,
        flexShrink: 0,
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24 }}>{meta.icon}</span>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>{meta.label} Discovery</h2>
            <p style={{ fontSize: 12, color: DIM }}>
              {isActive ? 'Session in progress...' : isComplete ? 'Session complete' : 'Starting...'}
            </p>
          </div>
        </div>

        {/* Voice indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {isActive && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              background: CARD2,
              borderRadius: 20,
              fontSize: 12,
              color: MUTED,
            }}>
              <div style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: currentSpeaker === 'user' ? meta.color : '#22C55E',
                animation: 'stage-pulse 1.5s ease-in-out infinite',
              }} />
              {currentSpeaker === 'user' ? 'Listening...' : 'Speaking...'}
            </div>
          )}

          <button
            onClick={handleEndSection}
            style={{
              padding: '8px 20px',
              fontSize: 13,
              fontWeight: 600,
              background: isComplete ? meta.color : 'transparent',
              color: isComplete ? '#fff' : MUTED,
              border: `1px solid ${isComplete ? meta.color : BORDER}`,
              borderRadius: 8,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {isComplete ? 'Generate Deliverable' : 'End Section Early'}
          </button>
        </div>
      </div>

      {/* Floating nugget bubble */}
      {activeBubble && (
        <NuggetBubble
          nugget={activeBubble}
          onComplete={() => setActiveBubble(null)}
        />
      )}

      {/* Main content: transcript + nugget panel */}
      <div style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
      }}>
        {/* Transcript stream (left/center) */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <TranscriptStream
            transcript={transcript}
            currentSpeaker={currentSpeaker}
            isActive={isActive}
          />
        </div>

        {/* Nugget panel (right side) */}
        <div style={{
          width: 300,
          borderLeft: `1px solid ${BORDER}`,
          background: CARD2,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}>
          <NuggetPanel nuggets={sectionData.nuggets} sectionColor={meta.color} />
        </div>
      </div>
    </div>
  );
}
