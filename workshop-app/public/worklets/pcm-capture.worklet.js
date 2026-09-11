// AudioWorklet: converts the microphone stream to 16 kHz mono 16-bit PCM and
// posts ~100 ms chunks (1600 samples) to the main thread. Plain JS, no imports
// (worklet scope). Served statically from /worklets/pcm-capture.worklet.js.
//
// Messages in:  { type: 'mute', muted: boolean }
// Messages out: ArrayBuffer of Int16 samples (transferred)

const TARGET_RATE = 16000;
const CHUNK_SAMPLES = 1600; // 100 ms at 16 kHz

class PcmCaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.muted = false;
    this.ratio = sampleRate / TARGET_RATE; // `sampleRate` is a worklet global
    this.chunk = new Int16Array(CHUNK_SAMPLES);
    this.len = 0;
    // Resampler state carried across 128-frame blocks.
    this.t = 0;        // fractional read position relative to `carry`
    this.carry = 0;    // last input sample of the previous block
    this.lp = 0;       // one-pole low-pass state
    // Low-pass cutoff ~7 kHz to limit aliasing before decimation.
    this.alpha = this.ratio > 1 ? 1 - Math.exp((-2 * Math.PI * 7000) / sampleRate) : 1;

    this.port.onmessage = (e) => {
      if (e.data && e.data.type === 'mute') this.muted = !!e.data.muted;
    };
  }

  push(sample) {
    const s = Math.max(-1, Math.min(1, sample));
    this.chunk[this.len++] = s < 0 ? s * 0x8000 : s * 0x7fff;
    if (this.len === CHUNK_SAMPLES) {
      const out = this.chunk.buffer.slice(0);
      this.port.postMessage(out, [out]);
      this.len = 0;
    }
  }

  process(inputs) {
    const input = inputs[0];
    const ch = input && input[0];
    if (!ch || this.muted) return true;

    const n = ch.length;

    if (this.ratio === 1) {
      for (let i = 0; i < n; i++) this.push(ch[i]);
      return true;
    }

    // Low-pass in place (cheap, avoids allocation per block).
    const filtered = new Float32Array(n);
    let lp = this.lp;
    const a = this.alpha;
    for (let i = 0; i < n; i++) {
      lp += a * (ch[i] - lp);
      filtered[i] = lp;
    }
    this.lp = lp;

    // Linear interpolation over the virtual array [carry, filtered[0..n-1]].
    // Position t is measured in input samples where index 0 == carry.
    let t = this.t;
    while (t < n) {
      const k = Math.floor(t);
      const frac = t - k;
      const s0 = k === 0 ? this.carry : filtered[k - 1];
      const s1 = filtered[k];
      this.push(s0 + (s1 - s0) * frac);
      t += this.ratio;
    }
    this.t = t - n;
    this.carry = filtered[n - 1];
    return true;
  }
}

registerProcessor('pcm-capture', PcmCaptureProcessor);
