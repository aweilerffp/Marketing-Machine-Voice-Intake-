// Browser-only audio helpers for the Gemini Live session.
// - createAudioGraph: mic → analyser → PCM worklet (16 kHz Int16 chunks)
// - createPlaybackQueue: 24 kHz PCM chunks → scheduled playback → analyser
// - int16ToBase64 / base64ToInt16

const CAPTURE_RATE = 16000;
const PLAYBACK_RATE = 24000;
const WORKLET_URL = '/worklets/pcm-capture.worklet.js';

export function int16ToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const step = 0x8000;
  for (let i = 0; i < bytes.length; i += step) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + step));
  }
  return btoa(binary);
}

export function base64ToInt16(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Int16Array(bytes.buffer, 0, Math.floor(bytes.length / 2));
}

/**
 * Must be called from a user gesture (AudioContext + getUserMedia).
 * @param {{ onChunk: (buffer: ArrayBuffer) => void }} opts
 */
export async function createAudioGraph({ onChunk }) {
  const AC = window.AudioContext || window.webkitAudioContext;

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      channelCount: 1,
    },
  });

  // Capture context: request 16 kHz; Safari may ignore this, the worklet resamples.
  let captureCtx;
  try {
    captureCtx = new AC({ sampleRate: CAPTURE_RATE });
  } catch {
    captureCtx = new AC();
  }
  await captureCtx.resume();
  await captureCtx.audioWorklet.addModule(WORKLET_URL);

  const source = captureCtx.createMediaStreamSource(stream);
  const inputAnalyser = captureCtx.createAnalyser();
  inputAnalyser.fftSize = 256;
  inputAnalyser.smoothingTimeConstant = 0.8;

  const worklet = new AudioWorkletNode(captureCtx, 'pcm-capture', {
    numberOfInputs: 1,
    numberOfOutputs: 0,
    channelCount: 1,
  });
  worklet.port.onmessage = (e) => onChunk(e.data);

  source.connect(inputAnalyser);
  inputAnalyser.connect(worklet);

  // Playback context at 24 kHz for Gemini output.
  let playbackCtx;
  try {
    playbackCtx = new AC({ sampleRate: PLAYBACK_RATE });
  } catch {
    playbackCtx = new AC();
  }
  await playbackCtx.resume();

  const outputGain = playbackCtx.createGain();
  const outputAnalyser = playbackCtx.createAnalyser();
  outputAnalyser.fftSize = 256;
  outputAnalyser.smoothingTimeConstant = 0.8;
  outputGain.connect(outputAnalyser);
  outputAnalyser.connect(playbackCtx.destination);

  let muted = true;
  worklet.port.postMessage({ type: 'mute', muted });

  const inputData = new Uint8Array(inputAnalyser.frequencyBinCount);
  const outputData = new Uint8Array(outputAnalyser.frequencyBinCount);

  return {
    captureCtx,
    playbackCtx,
    outputGain,
    get muted() {
      return muted;
    },
    setMuted(value) {
      muted = !!value;
      try {
        worklet.port.postMessage({ type: 'mute', muted });
      } catch {
        // port closed
      }
    },
    getInputByteFrequencyData() {
      inputAnalyser.getByteFrequencyData(inputData);
      return inputData;
    },
    getOutputByteFrequencyData() {
      outputAnalyser.getByteFrequencyData(outputData);
      return outputData;
    },
    async destroy() {
      try { worklet.port.onmessage = null; worklet.port.close(); } catch { /* ignore */ }
      try { source.disconnect(); inputAnalyser.disconnect(); worklet.disconnect(); } catch { /* ignore */ }
      try { stream.getTracks().forEach(t => t.stop()); } catch { /* ignore */ }
      try { outputGain.disconnect(); outputAnalyser.disconnect(); } catch { /* ignore */ }
      try { await captureCtx.close(); } catch { /* ignore */ }
      try { await playbackCtx.close(); } catch { /* ignore */ }
    },
  };
}

/**
 * Schedules 24 kHz PCM chunks back to back. Reports speaking state.
 * @param {AudioContext} ctx
 * @param {AudioNode} destination
 * @param {{ onSpeakingChange: (speaking: boolean) => void, onDrain: () => void }} cb
 */
export function createPlaybackQueue(ctx, destination, { onSpeakingChange, onDrain }) {
  const active = new Set();
  let nextStartTime = 0;
  let speaking = false;
  let quietTimer = null;

  function setSpeaking(value) {
    if (value === speaking) return;
    speaking = value;
    onSpeakingChange(speaking);
  }

  function handleEnded(src) {
    active.delete(src);
    if (active.size === 0) {
      // Debounce so tiny gaps between chunks do not flicker the UI.
      if (quietTimer) clearTimeout(quietTimer);
      quietTimer = setTimeout(() => {
        if (active.size === 0) {
          setSpeaking(false);
          onDrain();
        }
      }, 150);
    }
  }

  return {
    enqueue(base64) {
      const int16 = base64ToInt16(base64);
      if (!int16.length) return;
      const float = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) float[i] = int16[i] / 32768;

      const buffer = ctx.createBuffer(1, float.length, PLAYBACK_RATE);
      buffer.copyToChannel(float, 0);

      const src = ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(destination);

      const now = ctx.currentTime;
      const startAt = Math.max(now + 0.02, nextStartTime);
      src.start(startAt);
      nextStartTime = startAt + buffer.duration;

      active.add(src);
      src.onended = () => handleEnded(src);

      if (quietTimer) {
        clearTimeout(quietTimer);
        quietTimer = null;
      }
      setSpeaking(true);
    },
    flush() {
      for (const src of active) {
        try { src.onended = null; src.stop(); } catch { /* already stopped */ }
      }
      active.clear();
      nextStartTime = 0;
      if (quietTimer) {
        clearTimeout(quietTimer);
        quietTimer = null;
      }
      setSpeaking(false);
    },
    isEmpty() {
      return active.size === 0;
    },
    get speaking() {
      return speaking;
    },
  };
}
