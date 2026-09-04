'use client';

// Gemini Live voice session hook. Public surface mirrors what the ElevenLabs
// component consumed (startSession/endSession/status/isSpeaking/frequency
// getters) plus the transcript itself, which this hook owns so the reconnect
// logic can checkpoint it synchronously.
//
// Two clocks (see plan): the WebSocket is cut at ~10 min (goAway ~60 s before)
// and audio-only sessions cap at 15 min unless context compression is on.
// Primary path: compression + sessionResumption → seamless reconnect with the
// latest handle. Fallback: fresh session seeded with a Claude handoff brief.

import { useCallback, useEffect, useRef, useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { createAudioGraph, createPlaybackQueue, int16ToBase64 } from '../lib/voice/audio';

const ROLLOVER_MINUTES = Number(process.env.NEXT_PUBLIC_GEMINI_ROLLOVER_MINUTES || 9);
const FORCE_HANDOFF = process.env.NEXT_PUBLIC_GEMINI_FORCE_HANDOFF === 'true';
const DEBUG = process.env.NEXT_PUBLIC_GEMINI_DEBUG === 'true';

const SETUP_TIMEOUT_MS = 10000;
const DRAIN_CAP_MS = 6000;
const TIMER_ROLLOVER_GRACE_MS = 45000; // wait up to this long for a natural pause
const USER_SILENCE_FINALIZE_MS = 1500;
const LATE_AGENT_FRAGMENT_MS = 1500;
const MAX_RECONNECT_ATTEMPTS = 3;
const RAW_TAIL_CHARS = 2500;

const PHASE_STATUS = {
  idle: 'disconnected',
  connecting: 'connecting',
  live: 'connected',
  draining: 'connecting',
  reconnecting: 'connecting',
  handoff: 'connecting',
  ended: 'disconnected',
  error: 'disconnected',
};

function log(...args) {
  if (DEBUG) console.log('[gemini-live]', ...args);
}

function parseDurationMs(value, fallbackMs) {
  // protobuf Duration JSON, e.g. "45s" or "12.5s"
  if (typeof value !== 'string') return fallbackMs;
  const n = parseFloat(value);
  return Number.isFinite(n) ? n * 1000 : fallbackMs;
}

function normalizeLine(text) {
  return text.replace(/\s+/g, ' ').trim();
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export function useGeminiLive({ section, clientName, priorTranscript = '', onTranscriptCheckpoint }) {
  const [phase, setPhaseState] = useState('idle');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [currentUserUtterance, setCurrentUserUtterance] = useState('');
  const [error, setError] = useState(null);
  const [rolloverCount, setRolloverCount] = useState(0);

  // --- refs: everything the message handlers need synchronously ---
  const mountedRef = useRef(true);
  const phaseRef = useRef('idle');
  const graphRef = useRef(null);
  const playbackRef = useRef(null);
  const sessionRef = useRef(null);
  const connRef = useRef(null); // { id, closingByUs }
  const connIdRef = useRef(0);

  const transcriptRef = useRef('');
  const savedCursorRef = useRef(0);
  const agentBufRef = useRef('');
  const userBufRef = useRef('');
  const lastAgentFragRef = useRef('');
  const lastUserFragRef = useRef('');
  const lastFinalizedRoleRef = useRef(null);
  const agentFinalizedAtRef = useRef(0);
  const userSilenceTimerRef = useRef(null);
  const pendingModelTurnRef = useRef(false);

  const resumeHandleRef = useRef(null);
  const safetyTimerRef = useRef(null);
  const connectionOpenedAtRef = useRef(0);
  const sectionStartedAtRef = useRef(0);
  const pendingRolloverRef = useRef(null); // { reason, deadlineTimer }
  const reconnectingRef = useRef(false);
  const drainCheckRef = useRef(null);

  const onCheckpointRef = useRef(onTranscriptCheckpoint);
  onCheckpointRef.current = onTranscriptCheckpoint;
  const sectionRef = useRef(section);
  sectionRef.current = section;
  const clientNameRef = useRef(clientName);
  clientNameRef.current = clientName;
  const priorTranscriptRef = useRef(priorTranscript);
  priorTranscriptRef.current = priorTranscript;

  function setPhase(next) {
    phaseRef.current = next;
    if (mountedRef.current) setPhaseState(next);
    log('phase →', next);
  }

  // ---------- transcript assembly ----------

  function publishTranscript() {
    if (mountedRef.current) setTranscript(transcriptRef.current);
  }

  function appendLine(role, text) {
    const line = normalizeLine(text);
    if (!line) return;
    transcriptRef.current += `\n${role === 'agent' ? 'Q' : 'A'}: ${line}`;
    lastFinalizedRoleRef.current = role;
    publishTranscript();
  }

  function absorbFragment(bufRef, lastFragRef, text) {
    if (!text) return;
    if (text === lastFragRef.current) return; // exact repeat
    lastFragRef.current = text;
    const buf = bufRef.current;
    // Cumulative delivery: the fragment restates everything so far.
    if (buf && text.length > buf.length && text.startsWith(buf)) {
      bufRef.current = text;
    } else {
      bufRef.current = buf + text;
    }
  }

  function finalizeAgent(suffix = '') {
    const text = agentBufRef.current;
    agentBufRef.current = '';
    lastAgentFragRef.current = '';
    if (normalizeLine(text)) {
      appendLine('agent', text + suffix);
      agentFinalizedAtRef.current = Date.now();
      if (mountedRef.current) setCurrentUserUtterance('');
    }
  }

  function finalizeUser() {
    if (userSilenceTimerRef.current) {
      clearTimeout(userSilenceTimerRef.current);
      userSilenceTimerRef.current = null;
    }
    const text = userBufRef.current;
    userBufRef.current = '';
    lastUserFragRef.current = '';
    if (normalizeLine(text)) {
      appendLine('user', text);
      if (mountedRef.current) setCurrentUserUtterance(normalizeLine(text));
    }
  }

  function onAgentFragment(text) {
    // A fragment trailing in just after turnComplete belongs to the line we
    // already wrote, provided the user has not spoken since.
    if (
      !agentBufRef.current &&
      lastFinalizedRoleRef.current === 'agent' &&
      Date.now() - agentFinalizedAtRef.current < LATE_AGENT_FRAGMENT_MS &&
      !userBufRef.current
    ) {
      const extra = normalizeLine(text);
      if (extra && !transcriptRef.current.endsWith(extra)) {
        transcriptRef.current += ' ' + extra;
        publishTranscript();
      }
      return;
    }
    absorbFragment(agentBufRef, lastAgentFragRef, text);
  }

  function onUserFragment(text) {
    absorbFragment(userBufRef, lastUserFragRef, text);
    if (mountedRef.current) setCurrentUserUtterance(normalizeLine(userBufRef.current));
    if (userSilenceTimerRef.current) clearTimeout(userSilenceTimerRef.current);
    userSilenceTimerRef.current = setTimeout(() => {
      userSilenceTimerRef.current = null;
      finalizeUser();
      maybeRunPendingRollover();
    }, USER_SILENCE_FINALIZE_MS);
  }

  function checkpointTranscript() {
    const full = transcriptRef.current;
    const chunk = full.slice(savedCursorRef.current);
    if (chunk) {
      savedCursorRef.current = full.length;
      try {
        onCheckpointRef.current?.(chunk);
      } catch (e) {
        console.error('checkpoint failed', e);
      }
    }
  }

  // ---------- server message handling ----------

  function handleMessage(conn, msg) {
    if (conn !== connRef.current) return; // stale connection
    if (DEBUG) {
      const keys = Object.keys(msg).filter(k => msg[k] !== undefined);
      const sc = msg.serverContent;
      log('msg', keys.join(','), sc ? Object.keys(sc).filter(k => sc[k] !== undefined).join(',') : '');
    }

    if (msg.sessionResumptionUpdate) {
      const u = msg.sessionResumptionUpdate;
      if (u.resumable && u.newHandle) {
        resumeHandleRef.current = u.newHandle;
        log('resume handle updated');
      }
    }

    if (msg.goAway) {
      const timeLeft = parseDurationMs(msg.goAway.timeLeft, 30000);
      log('goAway, timeLeft ms', timeLeft);
      requestRollover('goaway', Math.max(0, timeLeft - 3000));
    }

    const sc = msg.serverContent;
    if (!sc) return;

    if (sc.interrupted) {
      playbackRef.current?.flush();
      finalizeAgent(' [interrupted]');
      pendingModelTurnRef.current = false;
    }

    if (sc.inputTranscription?.text) {
      onUserFragment(sc.inputTranscription.text);
      if (sc.inputTranscription.finished) finalizeUser();
    } else if (sc.interimInputTranscription?.text && mountedRef.current) {
      setCurrentUserUtterance(normalizeLine(userBufRef.current + sc.interimInputTranscription.text));
    }

    if (sc.outputTranscription?.text) {
      if (userBufRef.current) finalizeUser(); // model replying ⇒ user finished
      onAgentFragment(sc.outputTranscription.text);
    }

    const parts = sc.modelTurn?.parts || [];
    for (const part of parts) {
      if (part.inlineData?.data) {
        if (userBufRef.current) finalizeUser();
        pendingModelTurnRef.current = true;
        playbackRef.current?.enqueue(part.inlineData.data);
      }
    }

    if (sc.turnComplete) {
      finalizeAgent();
      pendingModelTurnRef.current = false;
      drainCheckRef.current?.();
      maybeRunPendingRollover();
    }
  }

  function handleClose(conn, e) {
    if (conn !== connRef.current) return;
    log('close', e?.code, e?.reason, 'byUs=', conn.closingByUs);
    if (conn.closingByUs) return;
    if (phaseRef.current === 'live') {
      performReconnect('unexpected');
    }
  }

  function handleError(conn, e) {
    if (conn !== connRef.current) return;
    console.error('[gemini-live] socket error', e);
    // onclose follows and drives the reconnect.
  }

  // ---------- connection ----------

  async function connectOnce({ resumeHandle = null, resume = null } = {}) {
    const res = await fetch('/api/gemini/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        section: sectionRef.current,
        clientName: clientNameRef.current,
        resumeHandle,
        resume,
      }),
    });
    if (!res.ok) {
      let detail = '';
      try { detail = (await res.json()).error || ''; } catch { /* ignore */ }
      throw new Error(detail || `token route failed: ${res.status}`);
    }
    const { token, model, apiVersion, connectConfig } = await res.json();

    const ai = new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion } });
    const conn = { id: ++connIdRef.current, closingByUs: false };
    connRef.current = conn;

    let timeout;
    const timeoutPromise = new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error('Gemini setup timed out')), SETUP_TIMEOUT_MS);
    });

    try {
      // live.connect resolves after setupComplete; earlier messages are queued
      // and flushed to onmessage once resolved.
      const session = await Promise.race([
        ai.live.connect({
          model,
          config: connectConfig,
          callbacks: {
            onopen: () => log('socket open', conn.id),
            onmessage: (m) => handleMessage(conn, m),
            onerror: (e) => handleError(conn, e),
            onclose: (e) => handleClose(conn, e),
          },
        }),
        timeoutPromise,
      ]);
      sessionRef.current = session;
      connectionOpenedAtRef.current = Date.now();
      return session;
    } finally {
      clearTimeout(timeout);
    }
  }

  function closeCurrentSession() {
    const conn = connRef.current;
    if (conn) conn.closingByUs = true;
    try { sessionRef.current?.close(); } catch { /* ignore */ }
    sessionRef.current = null;
  }

  function sendNudge(text) {
    try {
      sessionRef.current?.sendClientContent({
        turns: [{ role: 'user', parts: [{ text }] }],
        turnComplete: true,
      });
    } catch (e) {
      log('nudge failed', e?.message);
    }
  }

  function startSafetyTimer() {
    if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    safetyTimerRef.current = setTimeout(() => {
      safetyTimerRef.current = null;
      requestRollover('timer', TIMER_ROLLOVER_GRACE_MS);
    }, ROLLOVER_MINUTES * 60 * 1000);
  }

  function clearSafetyTimer() {
    if (safetyTimerRef.current) clearTimeout(safetyTimerRef.current);
    safetyTimerRef.current = null;
  }

  // ---------- rollover ----------

  function requestRollover(reason, graceMs) {
    if (phaseRef.current !== 'live' || reconnectingRef.current) return;
    if (pendingRolloverRef.current) {
      // Keep the earlier deadline unless goAway shortens it.
      if (reason !== 'goaway') return;
      clearTimeout(pendingRolloverRef.current.deadlineTimer);
    }
    const deadlineTimer = setTimeout(() => {
      pendingRolloverRef.current = null;
      performReconnect(reason);
    }, graceMs);
    pendingRolloverRef.current = { reason, deadlineTimer };
    log('rollover requested', reason, 'grace ms', graceMs);
    maybeRunPendingRollover();
  }

  function atNaturalPause() {
    return (
      !pendingModelTurnRef.current &&
      (playbackRef.current?.isEmpty() ?? true) &&
      !userBufRef.current
    );
  }

  function maybeRunPendingRollover() {
    const pending = pendingRolloverRef.current;
    if (!pending || reconnectingRef.current) return;
    if (!atNaturalPause()) return;
    clearTimeout(pending.deadlineTimer);
    pendingRolloverRef.current = null;
    performReconnect(pending.reason);
  }

  function drainPlayback(capMs) {
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        drainCheckRef.current = null;
        clearTimeout(cap);
        resolve();
      };
      const check = () => {
        if (!pendingModelTurnRef.current && (playbackRef.current?.isEmpty() ?? true)) finish();
      };
      const cap = setTimeout(() => {
        playbackRef.current?.flush();
        if (pendingModelTurnRef.current) {
          finalizeAgent(' [interrupted]');
          pendingModelTurnRef.current = false;
        }
        finish();
      }, capMs);
      drainCheckRef.current = check;
      check();
    });
  }

  async function fetchHandoffSeed() {
    const full = (priorTranscriptRef.current || '') + transcriptRef.current;
    const elapsedMinutes = sectionStartedAtRef.current
      ? Math.round((Date.now() - sectionStartedAtRef.current) / 60000)
      : null;
    try {
      const res = await fetch('/api/handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: sectionRef.current, transcript: full, elapsedMinutes }),
      });
      if (res.ok) {
        const handoff = await res.json();
        log('handoff brief', handoff);
        return { handoff };
      }
      log('handoff route failed', res.status);
    } catch (e) {
      log('handoff route error', e?.message);
    }
    return { rawTail: full.slice(-RAW_TAIL_CHARS) };
  }

  async function performReconnect(reason) {
    if (reconnectingRef.current) return;
    if (phaseRef.current !== 'live') return;
    reconnectingRef.current = true;
    clearSafetyTimer();
    if (pendingRolloverRef.current) {
      clearTimeout(pendingRolloverRef.current.deadlineTimer);
      pendingRolloverRef.current = null;
    }
    log('reconnect start:', reason);

    try {
      const graph = graphRef.current;
      const playback = playbackRef.current;

      if (reason === 'unexpected') {
        playback?.flush();
        if (pendingModelTurnRef.current) {
          finalizeAgent(' [interrupted]');
          pendingModelTurnRef.current = false;
        }
      } else {
        setPhase('draining');
        graph?.setMuted(true);
        try { sessionRef.current?.sendRealtimeInput({ audioStreamEnd: true }); } catch { /* ignore */ }
        await drainPlayback(DRAIN_CAP_MS);
      }

      finalizeUser();
      finalizeAgent();
      checkpointTranscript();

      setPhase('reconnecting');
      graph?.setMuted(true);
      closeCurrentSession();

      let useHandle = !!resumeHandleRef.current && !FORCE_HANDOFF;
      let connected = false;
      let lastErr = null;

      for (let attempt = 0; attempt < MAX_RECONNECT_ATTEMPTS && mountedRef.current && !connected; attempt++) {
        try {
          if (useHandle) {
            log('attempt', attempt + 1, 'resume with handle');
            await connectOnce({ resumeHandle: resumeHandleRef.current });
            connected = true;
          } else {
            setPhase('handoff');
            const seed = await fetchHandoffSeed();
            setPhase('reconnecting');
            log('attempt', attempt + 1, 'fresh session with', Object.keys(seed)[0]);
            resumeHandleRef.current = null;
            await connectOnce({ resume: seed });
            connected = true;
            sendNudge('[The connection was restored. Continue the interview now, starting with your resume sentence.]');
          }
        } catch (e) {
          lastErr = e;
          console.error('[gemini-live] reconnect attempt failed', e);
          closeCurrentSession();
          if (useHandle) {
            useHandle = false; // handle rejected or stale → fall back to handoff
          }
          await sleep(1000 * 2 ** attempt);
        }
      }

      if (!mountedRef.current) return;

      if (!connected) {
        setPhase('error');
        if (mountedRef.current) {
          setError('Connection lost. Press "End Section" to generate from what we have so far.');
        }
        return;
      }

      graph?.setMuted(false);
      setPhase('live');
      startSafetyTimer();
      if (mountedRef.current) setRolloverCount(c => c + 1);
      log('reconnect done');
    } finally {
      reconnectingRef.current = false;
    }
  }

  // ---------- public controls ----------

  const startSession = useCallback(async () => {
    if (phaseRef.current === 'error' && !graphRef.current) {
      // A failed start (mic denied, token error) may be retried.
      closeCurrentSession();
      phaseRef.current = 'idle';
    }
    if (phaseRef.current !== 'idle') return;
    setError(null);
    setPhase('connecting');
    try {
      const graph = await createAudioGraph({
        onChunk: (buffer) => {
          const s = sessionRef.current;
          if (!s || graphRef.current?.muted || phaseRef.current !== 'live') return;
          try {
            s.sendRealtimeInput({
              audio: { data: int16ToBase64(buffer), mimeType: 'audio/pcm;rate=16000' },
            });
          } catch (e) {
            log('send failed', e?.message);
          }
        },
      });
      graphRef.current = graph;
      playbackRef.current = createPlaybackQueue(graph.playbackCtx, graph.outputGain, {
        onSpeakingChange: (v) => { if (mountedRef.current) setIsSpeaking(v); },
        onDrain: () => {
          drainCheckRef.current?.();
          maybeRunPendingRollover();
        },
      });

      sectionStartedAtRef.current = Date.now();
      await connectOnce({});
      graph.setMuted(false);
      setPhase('live');
      startSafetyTimer();
      sendNudge('[The founder has joined the call. Greet them and begin the interview.]');
    } catch (e) {
      console.error('[gemini-live] start failed', e);
      closeCurrentSession();
      if (mountedRef.current) setError(e?.message || String(e));
      setPhase('error');
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const teardown = useCallback(async () => {
    clearSafetyTimer();
    if (pendingRolloverRef.current) {
      clearTimeout(pendingRolloverRef.current.deadlineTimer);
      pendingRolloverRef.current = null;
    }
    if (userSilenceTimerRef.current) {
      clearTimeout(userSilenceTimerRef.current);
      userSilenceTimerRef.current = null;
    }
    finalizeUser();
    finalizeAgent();
    checkpointTranscript();
    closeCurrentSession();
    playbackRef.current?.flush();
    const graph = graphRef.current;
    graphRef.current = null;
    playbackRef.current = null;
    if (graph) await graph.destroy();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const endSession = useCallback(async () => {
    if (phaseRef.current === 'idle' || phaseRef.current === 'ended') return;
    await teardown();
    if (mountedRef.current) setIsSpeaking(false);
    setPhase('ended');
  }, [teardown]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      teardown();
    };
  }, [teardown]);

  const getInputByteFrequencyData = useCallback(
    () => graphRef.current?.getInputByteFrequencyData() || null,
    [],
  );
  const getOutputByteFrequencyData = useCallback(
    () => graphRef.current?.getOutputByteFrequencyData() || null,
    [],
  );

  return {
    startSession,
    endSession,
    status: PHASE_STATUS[phase] || 'disconnected',
    phase,
    isSpeaking,
    getInputByteFrequencyData,
    getOutputByteFrequencyData,
    transcript,
    currentUserUtterance,
    error,
    rolloverCount,
  };
}
