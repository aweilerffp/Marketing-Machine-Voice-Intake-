'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { ConversationProvider, useConversation } from '@elevenlabs/react';
import { useWorkshopSession } from '../../hooks/useWorkshopSession';
import { currentSectionFromPhase, SECTIONS } from '../../lib/constants';
import { useNuggetDetection } from '../../hooks/useNuggetDetection';
import TranscriptStream from './TranscriptStream';
import NuggetPanel from './NuggetPanel';
import NuggetBubble from './NuggetBubble';
import { CARD, CARD2, BORDER, MUTED, DIM, TEXT } from '../design-tokens';

const AGENT_ID = process.env.NEXT_PUBLIC_ELEVENLABS_AGENT_ID || '';

export default function ElevenLabsSession() {
  return (
    <ConversationProvider>
      <ElevenLabsSessionInner />
    </ConversationProvider>
  );
}

function ElevenLabsSessionInner() {
  const { state, dispatch } = useWorkshopSession();
  const sectionLetter = currentSectionFromPhase(state.currentPhase);
  const meta = SECTIONS[sectionLetter];
  const sectionData = state[meta.stateKey];

  const [transcript, setTranscript] = useState('');
  const [activeBubble, setActiveBubble] = useState(null);
  const [error, setError] = useState(null);
  const transcriptSaved = useRef(false);
  const lastAgentMessage = useRef('');
  const lastUserMessage = useRef('');

  const {
    startSession,
    endSession,
    status,
    mode,
    isSpeaking,
  } = useConversation({
    onConnect: () => {
      console.log('ElevenLabs: connected');
    },
    onMessage: (event) => {
      console.log('ElevenLabs message:', event.type, event);
      if (event.type === 'agent_response') {
        const text = event.agent_response_event?.agent_response;
        if (text && text !== lastAgentMessage.current) {
          lastAgentMessage.current = text;
          setTranscript(prev => prev + '\nQ: ' + text);
        }
      } else if (event.type === 'user_transcript') {
        const text = event.user_transcription_event?.user_transcript;
        if (text && text !== lastUserMessage.current) {
          lastUserMessage.current = text;
          setTranscript(prev => prev + '\nA: ' + text);
        }
      }
    },
    onError: (error) => {
      console.error('ElevenLabs error:', error);
      setError(typeof error === 'string' ? error : error?.message || JSON.stringify(error));
    },
    onDisconnect: (details) => {
      console.log('ElevenLabs: disconnected', details);
      saveTranscriptOnce();
    },
  });

  console.log('ElevenLabs status:', status, 'AGENT_ID:', AGENT_ID);

  const isActive = status === 'connected';
  const isComplete = status === 'disconnected' && transcript.length > 0;
  const currentSpeaker = isSpeaking ? 'agent' : 'user';

  // Start session on mount
  useEffect(() => {
    console.log('ElevenLabs useEffect - status:', status, 'agentId:', AGENT_ID);
    if (AGENT_ID && (status === 'idle' || status === undefined)) {
      try {
        startSession({ agentId: AGENT_ID });
      } catch (e) {
        console.error('startSession failed:', e);
        setError(e.message);
      }
    }
  }, []);

  // Nugget detection
  const handleNuggetsFound = useCallback((nuggets) => {
    dispatch({ type: 'ADD_NUGGET', sectionKey: meta.stateKey, nuggets });
    if (nuggets.length > 0) {
      setActiveBubble(nuggets[0]);
    }
  }, [dispatch, meta.stateKey]);

  useNuggetDetection(transcript, isActive, handleNuggetsFound, sectionData.nuggets);

  function saveTranscriptOnce() {
    if (transcriptSaved.current || !transcript) return;
    transcriptSaved.current = true;
    dispatch({
      type: 'APPEND_TRANSCRIPT',
      sectionKey: meta.stateKey,
      chunk: transcript,
    });
  }

  function handleEndSection() {
    if (isActive) {
      endSession();
    }
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
      {/* Debug info — remove later */}
      {(error || !isActive) && (
        <div style={{
          padding: '8px 24px',
          fontSize: 12,
          background: error ? 'rgba(239,68,68,0.1)' : 'rgba(59,130,246,0.1)',
          color: error ? '#EF4444' : '#94A3B8',
          borderBottom: `1px solid ${BORDER}`,
        }}>
          Status: {status || 'unknown'} | Agent: {AGENT_ID ? AGENT_ID.slice(0, 15) + '...' : 'MISSING'}
          {error && <> | Error: {error}</>}
        </div>
      )}
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
              {status === 'connecting' ? 'Connecting...' :
               isActive ? 'Voice session active' :
               isComplete ? 'Session complete' : 'Starting...'}
            </p>
          </div>
        </div>

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
                background: isSpeaking ? '#22C55E' : meta.color,
                animation: 'stage-pulse 1.5s ease-in-out infinite',
              }} />
              {isSpeaking ? 'Agent speaking...' : 'Listening...'}
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
            {isComplete ? 'Generate Deliverable' : 'End Section'}
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
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <TranscriptStream
            transcript={transcript}
            currentSpeaker={currentSpeaker}
            isActive={isActive}
          />
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
