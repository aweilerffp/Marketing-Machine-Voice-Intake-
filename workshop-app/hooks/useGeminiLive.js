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
const AUDIO_BUFFER_MAX_CHUNKS = 200; // 100 ms each → 20 s of speech kept across a reconnect
const USER_END_FINALIZE_MS = 600;    // after ACTIVITY_END, wait briefly for the transcription
const TIMER_ROLLOVER_GRACE_MS = 45000; // wait up to this long for a natural pause
const USER_SILENCE_FINALIZE_MS = 1500;
const LATE_AGENT_FRAGMENT_MS = 1500;
const MAX_RECONNECT_ATTEMPTS = 3;
const RAW_TAIL_CHARS = 2500;
const TRANSCRIPT_CONTEXT_CHARS = 40000; // ~10k tokens carried into a fresh session; context is 128k
const MAX_SILENT_RECONNECTS = 2;

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

// Ring buffer of recent events, always on, so a tester can copy it out of the
// UI without opening devtools. Console output only when DEBUG.
const LOG_MAX = 600;
const logBuf = [];
function log(...args) {
  const ts = new Date().toISOString().slice(11, 23);
  const line = args.map(a => (typeof a === 'string' ? a : safeJson(a))).join(' ');
  logBuf.push(`${ts} ${line}`);
  if (logBuf.length > LOG_MAX) logBuf.shift();
  if (DEBUG) console.log('[gemini-live]', ...args);
}
function safeJson(v) {
  try { return JSON.stringify(v); } catch { return String(v); }
}
export function getDebugLog() {
  return logBuf.join('\n');
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

export function useGeminiLive({ section, clientName, priorTranscript = '', onTranscriptCheckpoint, onUserAnswer }) {
  const [phase, setPhaseState] = useState('idle');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
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
  const userSpeakingRef = useRef(false);      // from server voiceActivity / speechState
  const audioBufferRef = useRef([]);          // PCM chunks captured while reconnecting
  const bufferingRef = useRef(false);
  const loggedHandleForConnRef = useRef(0);
  const pendingModelTurnRef = useRef(false);
  const turnAudioChunksRef = useRef(0);
  const silentReconnectsRef = useRef(0);

  const resumeHandleRef = useRef(null);
  const safetyTimerRef = useRef(null);
  const connectionOpenedAtRef = useRef(0);
  const sectionStartedAtRef = useRef(0);
  const pendingRolloverRef = useRef(null); // { reason, deadlineTimer }
  const reconnectingRef = useRef(false);
  const drainCheckRef = useRef(null);

  const onCheckpointRef = useRef(onTranscriptCheckpoint);
  onCheckpointRef.current = onTranscriptCheckpoint;
  const onUserAnswerRef = useRef(onUserAnswer);
  onUserAnswerRef.current = onUserAnswer;
  const lastQuestionRef = useRef('');
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
      // Fragments at sentence boundaries arrive without a leading space
      // ("...do?If you were..."); restore it.
      const needsSpace = buf && /[.?!,;:]$/.test(buf) && /^[^\s]/.test(text);
      bufRef.current = buf + (needsSpace ? ' ' : '') + text;
    }
  }

  function finalizeAgent(suffix = '') {
    const text = agentBufRef.current;
    agentBufRef.current = '';
    lastAgentFragRef.current = '';
    if (normalizeLine(text)) {
      appendLine('agent', text + suffix);
      lastQuestionRef.current = normalizeLine(text);
      agentFinalizedAtRef.current = Date.now();
      log('Q:', lastQuestionRef.current.slice(0, 80));
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
    const answer = normalizeLine(text);
    if (mountedRef.current) setIsUserSpeaking(false);
    if (answer) {
      appendLine('user', text);
      log('A:', answer.slice(0, 80));
      if (mountedRef.current) setCurrentUserUtterance(answer);
      try {
        onUserAnswerRef.current?.({ question: lastQuestionRef.current, answer });
      } catch (e) {
        log('onUserAnswer failed', e?.message);
      }
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
    {
      const keys = Object.keys(msg).filter(k => msg[k] !== undefined);
      const sc = msg.serverContent;
      const scKeys = sc ? Object.keys(sc).filter(k => sc[k] !== undefined && k !== 'modelTurn').join(',') : '';
      const audio = sc?.modelTurn?.parts?.some(p => p.inlineData?.data) ? '+audio' : '';
      // Skip the very chatty pure-audio / pure-fragment / handle-update messages in the buffer.
      const chatty =
        (keys.length === 1 && keys[0] === 'serverContent' && (scKeys === '' || scKeys === 'outputTranscription' || scKeys === 'inputTranscription') && !sc?.turnComplete) ||
        (keys.length === 1 && keys[0] === 'sessionResumptionUpdate');
      if (!chatty) log('msg', keys.join(','), scKeys, audio, msg.voiceActivity?.type || '');
    }

    if (msg.sessionResumptionUpdate) {
      const u = msg.sessionResumptionUpdate;
      if (u.resumable && u.newHandle) {
        resumeHandleRef.current = u.newHandle;
        if (loggedHandleForConnRef.current !== conn.id) {
          loggedHandleForConnRef.current = conn.id;
          log('resume handle available for connection', conn.id);
        }
      }
    }

    // Server-side voice activity: the only reliable "is the founder talking"
    // signal, since input transcription arrives after the utterance ends.
    const vaType = msg.voiceActivity?.type;
    const speechState = msg.serverContent?.speechState;
    if (vaType === 'ACTIVITY_START' || speechState === 'SPEECH') {
      if (!userSpeakingRef.current) log('user speech start');
      userSpeakingRef.current = true;
      if (mountedRef.current) setIsUserSpeaking(true);
      if (userSilenceTimerRef.current) {
        clearTimeout(userSilenceTimerRef.current);
        userSilenceTimerRef.current = null;
      }
    } else if (vaType === 'ACTIVITY_END' || speechState === 'NON_SPEECH') {
      if (userSpeakingRef.current) log('user speech end');
      userSpeakingRef.current = false;
      if (mountedRef.current) setIsUserSpeaking(false);
      if (userSilenceTimerRef.current) clearTimeout(userSilenceTimerRef.current);
      userSilenceTimerRef.current = setTimeout(() => {
        userSilenceTimerRef.current = null;
        finalizeUser();
        maybeRunPendingRollover();
      }, USER_END_FINALIZE_MS);
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
        turnAudioChunksRef.current++;
        silentReconnectsRef.current = 0;
        playbackRef.current?.enqueue(part.inlineData.data);
      }
    }

    if (sc.turnComplete) {
      const spokeText = normalizeLine(agentBufRef.current);
      if (spokeText && turnAudioChunksRef.current === 0 && phaseRef.current === 'live' && !reconnectingRef.current) {
        // Google returned a transcript with no audio: the founder heard
        // nothing. Drop the unheard question and reconnect so it is re-asked.
        log('SILENT TURN (no audio) discarded:', spokeText.slice(0, 80));
        agentBufRef.current = '';
        lastAgentFragRef.current = '';
        pendingModelTurnRef.current = false;
        turnAudioChunksRef.current = 0;
        if (silentReconnectsRef.current < MAX_SILENT_RECONNECTS) {
          silentReconnectsRef.current++;
          performReconnect('silent');
        } else {
          if (mountedRef.current) setError('The interviewer stopped producing audio. Press "End Section" to generate from what we have so far.');
        }
        return;
      }
      turnAudioChunksRef.current = 0;
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
    log('socket error', e?.message || String(e));
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

  // Memory for a fresh session is carried in the system instruction (the
  // token route embeds the transcript). Replaying it as client-content turns
  // made gemini-3.1-flash-live-preview answer in silent text ~30% of the time.
  function fullTranscript() {
    const full = (priorTranscriptRef.current || '') + transcriptRef.current;
    return full.length > TRANSCRIPT_CONTEXT_CHARS ? full.slice(-TRANSCRIPT_CONTEXT_CHARS) : full;
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
      !userSpeakingRef.current &&
      !userBufRef.current
    );
  }

  function lastTranscriptLine() {
    const t = transcriptRef.current;
    const idx = t.lastIndexOf('\n');
    return idx >= 0 ? t.slice(idx + 1) : t;
  }

  function flushAudioBuffer() {
    const s = sessionRef.current;
    const chunks = audioBufferRef.current;
    audioBufferRef.current = [];
    bufferingRef.current = false;
    if (!s || !chunks.length) return 0;
    let sent = 0;
    for (const buffer of chunks) {
      try {
        s.sendRealtimeInput({ audio: { data: int16ToBase64(buffer), mimeType: 'audio/pcm;rate=16000' } });
        sent++;
      } catch (e) {
        log('buffered audio send failed', e?.message);
        break;
      }
    }
    log('flushed buffered audio chunks', sent);
    return sent;
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
      const playback = playbackRef.current;

      // From here on the mic keeps running; chunks are buffered and replayed
      // into the new session so nothing the founder says is lost.
      bufferingRef.current = true;
      audioBufferRef.current = [];

      if (reason === 'unexpected' || reason === 'silent') {
        playback?.flush();
        if (pendingModelTurnRef.current) {
          finalizeAgent(' [interrupted]');
          pendingModelTurnRef.current = false;
        }
      } else {
        setPhase('draining');
        try { sessionRef.current?.sendRealtimeInput({ audioStreamEnd: true }); } catch { /* ignore */ }
        await drainPlayback(DRAIN_CAP_MS);
      }

      finalizeUser();
      finalizeAgent();
      checkpointTranscript();

      setPhase('reconnecting');
      closeCurrentSession();

      // A fresh session must speak first when the founder's last answer has
      // had no reply (last line is A:) or the last question was cut off.
      // If the last line is a complete question, it waits for the answer.
      const last = lastTranscriptLine();
      const needsNudge = last.startsWith('A:') || /\[interrupted\]\s*$/.test(last) || !last.trim();

      // Tiers: 1) resumption handle  2) fresh session + transcript in the
      // system instruction  3) fresh session + Claude handoff brief
      const canResume = !!resumeHandleRef.current && !FORCE_HANDOFF && reason !== 'silent';
      let tier = canResume ? 'handle' : 'transcript';
      let connected = false;
      let lastErr = null;

      for (let attempt = 0; attempt < MAX_RECONNECT_ATTEMPTS && mountedRef.current && !connected; attempt++) {
        try {
          if (tier === 'handle') {
            log('attempt', attempt + 1, 'resume with handle');
            await connectOnce({ resumeHandle: resumeHandleRef.current });
            connected = true;
          } else if (tier === 'transcript') {
            log('attempt', attempt + 1, 'fresh session + transcript context', needsNudge ? '(will nudge)' : '(waits for answer)');
            resumeHandleRef.current = null;
            await connectOnce({ resume: { transcript: fullTranscript() } });
            connected = true;
            if (needsNudge) sendNudge('[The connection was restored. Continue the interview now.]');
          } else {
            setPhase('handoff');
            const seed = await fetchHandoffSeed();
            setPhase('reconnecting');
            log('attempt', attempt + 1, 'fresh session + Claude brief', Object.keys(seed)[0]);
            resumeHandleRef.current = null;
            await connectOnce({ resume: seed });
            connected = true;
            sendNudge('[The connection was restored. Continue the interview now, starting with your resume sentence.]');
          }
        } catch (e) {
          lastErr = e;
          console.error('[gemini-live] reconnect attempt failed', e);
          log('reconnect attempt failed', tier, e?.message);
          closeCurrentSession();
          // Degrade one tier per failure: handle → transcript → brief.
          tier = tier === 'handle' ? 'transcript' : 'brief';
          await sleep(1000 * 2 ** attempt);
        }
      }

      if (!mountedRef.current) return;

      if (!connected) {
        bufferingRef.current = false;
        audioBufferRef.current = [];
        setPhase('error');
        if (mountedRef.current) {
          setError('Connection lost. Press "End Section" to generate from what we have so far.');
        }
        return;
      }

      setPhase('live');
      flushAudioBuffer();
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
          if (bufferingRef.current) {
            const buf = audioBufferRef.current;
            buf.push(buffer);
            if (buf.length > AUDIO_BUFFER_MAX_CHUNKS) buf.shift();
            return;
          }
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
    isUserSpeaking,
    getInputByteFrequencyData,
    getOutputByteFrequencyData,
    transcript,
    currentUserUtterance,
    error,
    rolloverCount,
  };
}
