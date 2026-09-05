import { GoogleGenAI } from '@google/genai';
const BASE = 'http://127.0.0.1:3100'; const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const apiKey = process.env.GEMINI_API_KEY;

// 1. Get ~4 s of speech audio (a model greeting) to use as fake founder speech.
const ai0 = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: 'v1alpha' } });
const audio = [];
const s0 = await ai0.live.connect({ model: 'gemini-3.1-flash-live-preview', config: { responseModalities: ['AUDIO'], systemInstruction: 'Answer in two sentences.' }, callbacks: { onmessage: (m) => { for (const p of m.serverContent?.modelTurn?.parts || []) if (p.inlineData?.data) audio.push(Buffer.from(p.inlineData.data, 'base64')); }, onerror: () => {}, onclose: () => {} } });
s0.sendClientContent({ turns: [{ role: 'user', parts: [{ text: 'Say: We are scrappy and we figure it out, and we always show up when it is hard.' }] }], turnComplete: true });
await sleep(6000); s0.close();
const all = Buffer.concat(audio); const i16 = new Int16Array(all.buffer, all.byteOffset, Math.floor(all.length / 2));
const n = Math.min(Math.floor(i16.length / 1.5), 16000 * 4); const speech = new Int16Array(n); for (let i = 0; i < n; i++) speech[i] = i16[Math.floor(i * 1.5)];
console.log('speech audio', (n / 16000).toFixed(1), 's');

const hist = [
  { role: 'model', parts: [{ text: 'Hey there! Tell me, what does your company do?' }] },
  { role: 'user', parts: [{ text: 'We are an Amazon marketplace agency. We help brands scale on Amazon.' }] },
  { role: 'model', parts: [{ text: 'Got it. What are your core values, the real ones, not the ones on the wall?' }] },
];

async function run(label, seedFn) {
  const tr = await fetch(`${BASE}/api/gemini/token`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ section: 'a', clientName: 'Seed Test Ltd', resume: { seeded: true } }) });
  const tok = await tr.json();
  const ai = new GoogleGenAI({ apiKey: tok.token, httpOptions: { apiVersion: tok.apiVersion } });
  let out = '', chunks = 0, inTx = '', err = null;
  const s = await ai.live.connect({ model: tok.model, config: tok.connectConfig, callbacks: { onmessage: (m) => { const sc = m.serverContent; if (!sc) return; if (sc.outputTranscription?.text) out += sc.outputTranscription.text; if (sc.inputTranscription?.text) inTx += sc.inputTranscription.text; for (const p of sc.modelTurn?.parts || []) if (p.inlineData?.data) chunks++; }, onerror: (e) => { err = e?.message; }, onclose: (e) => { if (e?.reason) err = err || e.reason; } } });
  try { seedFn(s); } catch (e) { err = 'seed: ' + e?.message; }
  await sleep(5000);
  const spontaneous = out; const spChunks = chunks;
  // now the founder speaks
  for (let i = 0; i < speech.length; i += 1600) { const sl = speech.subarray(i, i + 1600); s.sendRealtimeInput({ audio: { data: Buffer.from(sl.buffer, sl.byteOffset, sl.length * 2).toString('base64'), mimeType: 'audio/pcm;rate=16000' } }); await sleep(100); }
  const sil = Buffer.alloc(3200).toString('base64'); for (let i = 0; i < 60; i++) { s.sendRealtimeInput({ audio: { data: sil, mimeType: 'audio/pcm;rate=16000' } }); await sleep(100); }
  await sleep(2000);
  console.log(`\n[${label}] err=${err}\n  spontaneous (before speech): chunks=${spChunks} "${spontaneous.trim().slice(0, 120) || '(silent)'}"\n  heard: "${inTx.trim().slice(0, 80)}"\n  reply after speech: chunks=${chunks - spChunks} "${out.slice(spontaneous.length).trim().slice(0, 160) || '(silent)'}"`);
  s.close(); await sleep(300);
}

await run('A: ends-with-model, turnComplete:false', (s) => s.sendClientContent({ turns: hist, turnComplete: false }));
await run('B: ends-with-model, turnComplete:true', (s) => s.sendClientContent({ turns: hist, turnComplete: true }));
await run('C: history minus last Q (ends-with-user) turnComplete:false', (s) => s.sendClientContent({ turns: hist.slice(0, 2), turnComplete: false }));
process.exit(0);
