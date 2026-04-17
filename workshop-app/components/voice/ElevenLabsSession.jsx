'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { ConversationProvider, useConversation } from '@elevenlabs/react';
import { useWorkshopSession } from '../../hooks/useWorkshopSession';
import { currentSectionFromPhase, SECTIONS } from '../../lib/constants';
import { useNuggetDetection } from '../../hooks/useNuggetDetection';
import NuggetPanel from './NuggetPanel';
import NuggetBubble from './NuggetBubble';
import TopicAgenda from './TopicAgenda';
import QuestionStack from './QuestionStack';
import VoiceWaveform from './VoiceWaveform';
import LiveTranscript from './LiveTranscript';
import { CARD, CARD2, BORDER, MUTED, DIM } from '../design-tokens';

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
  const [currentUserUtterance, setCurrentUserUtterance] = useState('');
  const [activeBubble, setActiveBubble] = useState(null);
  const [error, setError] = useState(null);
  const transcriptSaved = useRef(false);
  const sessionStarted = useRef(false);
  const lastAgentMessage = useRef('');
  const lastUserMessage = useRef('');

  const {
    startSession,
    endSession,
    status,
    isSpeaking,
    getInputByteFrequencyData,
    getOutputByteFrequencyData,
  } = useConversation({
    onConnect: () => {
      console.log('ElevenLabs: connected');
    },
    onMessage: (event) => {
      if (event.type === 'agent_response') {
        const text = event.agent_response_event?.agent_response;
        if (text && text !== lastAgentMessage.current) {
          lastAgentMessage.current = text;
          setTranscript(prev => prev + '\nQ: ' + text);
          setCurrentUserUtterance('');
        }
      } else if (event.type === 'user_transcript') {
        const text = event.user_transcription_event?.user_transcript;
        if (text && text !== lastUserMessage.current) {
          lastUserMessage.current = text;
          setTranscript(prev => prev + '\nA: ' + text);
          setCurrentUserUtterance(text);
        }
      }
    },
    onError: (err) => {
      console.error('ElevenLabs error:', err);
      setError(typeof err === 'string' ? err : err?.message || JSON.stringify(err));
    },
    onDisconnect: (details) => {
      console.log('ElevenLabs: disconnected', details);
      if (details && (details.reason || details.code || details.message)) {
        setError(`disconnect: ${details.reason || details.message || 'code=' + details.code}`);
      }
      saveTranscriptOnce();
    },
  });

  const isActive = status === 'connected';
  const isComplete = status === 'disconnected' && transcript.length > 0;

  useEffect(() => {
    if (sessionStarted.current) return;
    if (!AGENT_ID) {
      setError('NEXT_PUBLIC_ELEVENLABS_AGENT_ID is missing');
      return;
    }
    sessionStarted.current = true;
    (async () => {
      try {
        await startSession({ agentId: AGENT_ID, connectionType: 'websocket' });
      } catch (e) {
        console.error('startSession failed:', e);
        setError(e?.message || String(e));
      }
    })();
  }, [startSession]);

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
    if (isActive) endSession();
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
            <p style={{ fontSize: 12, color: DIM }}>
              {status === 'connecting' ? 'Connecting…' :
               isActive ? (isSpeaking ? 'Agent speaking' : 'Listening') :
               isComplete ? 'Session complete' : 'Starting…'}
            </p>
          </div>
        </div>

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
          <LiveTranscript
            utterance={currentUserUtterance}
            isSpeaking={isSpeaking}
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
