'use client';

import { useState, useCallback, useRef } from 'react';
import { useWorkshopSession } from '../../hooks/useWorkshopSession';
import { currentSectionFromPhase, SECTIONS } from '../../lib/constants';
import { useNuggetDetection } from '../../hooks/useNuggetDetection';
import { useGeminiLive, getDebugLog } from '../../hooks/useGeminiLive';
import AnswerSummary from './AnswerSummary';
import NuggetPanel from './NuggetPanel';
import NuggetBubble from './NuggetBubble';
import TopicAgenda from './TopicAgenda';
import QuestionStack from './QuestionStack';
import VoiceWaveform from './VoiceWaveform';
import LiveTranscript from './LiveTranscript';
import { CARD, CARD2, BORDER, MUTED, DIM, AMBER, TEXT } from '../design-tokens';

const ROLLOVER_PHASES = new Set(['draining', 'reconnecting', 'handoff']);
const SHOW_VERBATIM = process.env.NEXT_PUBLIC_SHOW_VERBATIM === 'true';
const SHOW_DEBUG_TOOLS = process.env.NEXT_PUBLIC_GEMINI_DEBUG === 'true';

export default function GeminiLiveSession() {
  const { state, dispatch } = useWorkshopSession();
  const sectionLetter = currentSectionFromPhase(state.currentPhase);
  const meta = SECTIONS[sectionLetter];
  const sectionData = state[meta.stateKey];

  const [activeBubble, setActiveBubble] = useState(null);
  const priorTranscriptRef = useRef(sectionData.transcript || '');

  const onTranscriptCheckpoint = useCallback((chunk) => {
    dispatch({ type: 'APPEND_TRANSCRIPT', sectionKey: meta.stateKey, chunk });
  }, [dispatch, meta.stateKey]);

  // Bullet summary of the founder's latest answer (replaces verbatim captions).
  const [summary, setSummary] = useState({ pending: false, bullets: [] });
  const summarySeq = useRef(0);
  const onUserAnswer = useCallback(async ({ question, answer }) => {
    const seq = ++summarySeq.current;
    setSummary({ pending: true, bullets: [] });
    try {
      const res = await fetch('/api/summarize-answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, answer }),
      });
      const data = res.ok ? await res.json() : { bullets: [] };
      if (seq === summarySeq.current) setSummary({ pending: false, bullets: data.bullets || [] });
    } catch {
      if (seq === summarySeq.current) setSummary({ pending: false, bullets: [] });
    }
  }, []);

  const [copied, setCopied] = useState(false);
  async function handleCopyLog() {
    const text = getDebugLog();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('Copy the debug log:', text.slice(-4000));
    }
  }

  const {
    startSession,
    endSession,
    status,
    phase,
    isSpeaking,
    isUserSpeaking,
    getInputByteFrequencyData,
    getOutputByteFrequencyData,
    transcript,
    currentUserUtterance,
    error,
  } = useGeminiLive({
    section: meta.key,
    clientName: state.clientName,
    priorTranscript: priorTranscriptRef.current,
    onTranscriptCheckpoint,
    onUserAnswer,
  });

  const isActive = status === 'connected';
  const isRollingOver = ROLLOVER_PHASES.has(phase);
  const hasStarted = phase !== 'idle';
  const isComplete = (phase === 'ended' || phase === 'error') && transcript.length > 0;

  const handleNuggetsFound = useCallback((nuggets) => {
    dispatch({ type: 'ADD_NUGGET', sectionKey: meta.stateKey, nuggets });
    if (nuggets.length > 0) {
      setActiveBubble(nuggets[0]);
    }
  }, [dispatch, meta.stateKey]);

  useNuggetDetection(transcript, isActive, handleNuggetsFound, sectionData.nuggets);

  async function handleEndSection() {
    await endSession(); // checkpoints the transcript before closing
    dispatch({ type: 'SET_PHASE', phase: `S${sectionLetter}_GEN` });
  }

  const statusLabel =
    phase === 'connecting' ? 'Connecting…' :
    phase === 'handoff' ? 'Saving progress…' :
    isRollingOver ? 'One moment…' :
    isActive ? (isSpeaking ? 'Agent speaking' : 'Listening') :
    phase === 'ended' ? 'Session complete' :
    phase === 'error' ? 'Connection lost' :
    'Ready to start';

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {error && (
        <div style={{
          padding: '8px 24px',
          fontSize: 12,
          background: 'rgba(239,68,68,0.1)',
          color: '#EF4444',
          borderBottom: `1px solid ${BORDER}`,
        }}>
          {error}
        </div>
      )}

      {isRollingOver && (
        <div style={{
          padding: '6px 24px',
          fontSize: 12,
          background: 'rgba(245,158,11,0.12)',
          color: AMBER,
          borderBottom: `1px solid ${BORDER}`,
        }}>
          {phase === 'handoff'
            ? 'Saving your progress so far…'
            : 'Reconnecting the interviewer. Your answers are saved, one moment…'}
        </div>
      )}

      {/* Section header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 24px',
        borderBottom: `1px solid ${BORDER}`,
        background: CARD,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 24 }}>{meta.icon}</span>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>{meta.label} Discovery</h2>
            <p style={{ fontSize: 12, color: DIM }}>{statusLabel}</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {SHOW_DEBUG_TOOLS && hasStarted && (
          <button
            onClick={handleCopyLog}
            title="Copy the session debug log to the clipboard"
            style={{
              padding: '6px 12px',
              fontSize: 12,
              background: 'transparent',
              color: DIM,
              border: `1px solid ${BORDER}`,
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            {copied ? 'Copied ✓' : 'Copy log'}
          </button>
        )}
        <button
          onClick={handleEndSection}
          disabled={!hasStarted}
          style={{
            padding: '8px 20px',
            fontSize: 13,
            fontWeight: 600,
            background: isComplete ? meta.color : 'transparent',
            color: isComplete ? '#fff' : MUTED,
            border: `1px solid ${isComplete ? meta.color : BORDER}`,
            borderRadius: 8,
            cursor: hasStarted ? 'pointer' : 'default',
            opacity: hasStarted ? 1 : 0.5,
            transition: 'all 0.2s',
          }}
        >
          {isComplete ? 'Generate Deliverable' : 'End Section'}
        </button>
        </div>
      </div>

      <TopicAgenda activeLetter={sectionLetter} />

      {activeBubble && (
        <NuggetBubble
          nugget={activeBubble}
          onComplete={() => setActiveBubble(null)}
        />
      )}

      <div style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
      }}>
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          overflow: 'auto',
          padding: '16px 0',
        }}>
          {!hasStarted ? (
            <StartPanel meta={meta} onStart={startSession} />
          ) : (
            <>
              <QuestionStack
                transcript={transcript}
                isActive={isActive}
                sectionColor={meta.color}
              />
              <VoiceWaveform
                getInputData={getInputByteFrequencyData}
                getOutputData={getOutputByteFrequencyData}
                isSpeaking={isSpeaking}
                isActive={isActive}
                userColor={meta.color}
              />
              {SHOW_VERBATIM ? (
                <LiveTranscript
                  utterance={currentUserUtterance}
                  isSpeaking={isSpeaking}
                  isActive={isActive}
                />
              ) : (
                <AnswerSummary
                  bullets={summary.bullets}
                  pending={summary.pending}
                  userSpeaking={isUserSpeaking}
                  isSpeaking={isSpeaking}
                  isActive={isActive}
                  accent={meta.color}
                />
              )}
            </>
          )}
        </div>

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

function StartPanel({ meta, onStart }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      padding: '48px 32px',
      maxWidth: 560,
      textAlign: 'center',
    }}>
      <p style={{ fontSize: 20, fontWeight: 600, color: TEXT, lineHeight: 1.4 }}>
        Ready for the {meta.label.toLowerCase()} conversation?
      </p>
      <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.5 }}>
        Your browser will ask for microphone access. Headphones are recommended so the
        interviewer does not hear itself. Speak naturally; you can interrupt at any time.
      </p>
      <button
        onClick={onStart}
        style={{
          marginTop: 8,
          padding: '12px 28px',
          fontSize: 15,
          fontWeight: 600,
          background: meta.color,
          color: '#fff',
          border: 'none',
          borderRadius: 10,
          cursor: 'pointer',
        }}
      >
        Start interview
      </button>
    </div>
  );
}
