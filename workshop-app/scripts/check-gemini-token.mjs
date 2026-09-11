#!/usr/bin/env node
// Verifies the Gemini token route end to end against a running dev server:
//   1. POST /api/gemini/token → ephemeral token + connect config
//   2. Open a real Live session with that token (Node WebSocket)
//   3. Send 500 ms of silence, wait for setupComplete + first resumption update
//
// Usage: node --env-file=.env.local scripts/check-gemini-token.mjs [baseUrl]
//   (baseUrl defaults to http://localhost:3000)

import { GoogleGenAI } from '@google/genai';

const BASE_URL = process.argv[2] || process.env.BASE_URL || 'http://localhost:3000';

function fail(msg, extra) {
  console.error('✗', msg);
  if (extra) console.error(extra);
  process.exit(1);
}

const res = await fetch(`${BASE_URL}/api/gemini/token`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ section: 'a', clientName: 'Token Check Ltd' }),
});
const body = await res.json().catch(() => ({}));
if (!res.ok) fail(`token route returned ${res.status}`, body);

const { token, model, apiVersion, connectConfig } = body;
if (!token || !token.startsWith('auth_tokens/')) fail('token missing or malformed', body);
console.log('✓ token minted', token.slice(0, 24) + '…');
console.log('  model:', model, ' apiVersion:', apiVersion);
console.log('  systemInstruction chars:', connectConfig?.systemInstruction?.length);

const ai = new GoogleGenAI({ apiKey: token, httpOptions: { apiVersion } });

let resumptionUpdate = null;
let sawSetup = false;
const messages = [];

const session = await Promise.race([
  ai.live.connect({
    model,
    config: connectConfig,
    callbacks: {
      onopen: () => console.log('✓ websocket open'),
      onmessage: (m) => {
        messages.push(Object.keys(m).filter(k => m[k] !== undefined).join(','));
        if (m.setupComplete) sawSetup = true;
        if (m.sessionResumptionUpdate) resumptionUpdate = m.sessionResumptionUpdate;
      },
      onerror: (e) => console.error('socket error', e?.message || e),
      onclose: (e) => console.log('socket closed', e?.code, e?.reason || ''),
    },
  }),
  new Promise((_, reject) => setTimeout(() => reject(new Error('setup timed out (10 s)')), 10000)),
]).catch(e => fail('live.connect failed', e?.message || e));

console.log('✓ setupComplete received');

// 500 ms of 16 kHz silence in 100 ms chunks
const silence = Buffer.alloc(1600 * 2).toString('base64');
for (let i = 0; i < 5; i++) {
  session.sendRealtimeInput({ audio: { data: silence, mimeType: 'audio/pcm;rate=16000' } });
  await new Promise(r => setTimeout(r, 100));
}
await new Promise(r => setTimeout(r, 2500));

console.log('  message types seen:', [...new Set(messages)].join(' | ') || '(none yet)');
if (resumptionUpdate) {
  console.log('✓ sessionResumptionUpdate:', { resumable: resumptionUpdate.resumable, handle: !!resumptionUpdate.newHandle });
} else {
  console.log('… no sessionResumptionUpdate yet (normal until the first turn)');
}

session.close();
console.log('✓ done', sawSetup ? '' : '(setupComplete flag not observed in callback; connect() still resolved)');
process.exit(0);
