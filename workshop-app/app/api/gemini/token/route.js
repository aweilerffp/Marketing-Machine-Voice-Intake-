// Mints a single-use ephemeral Gemini Live token and returns the full connect
// config for the browser. The API key never leaves the server.
//
// POST { section: 'a'|'b'|'c', clientName?, resumeHandle?, resume? }
//   resume = { handoff } | { rawTail }   (fallback rollover seed)
// → { token, model, apiVersion, connectConfig, expiresAt }

import { GoogleGenAI } from '@google/genai';
import { buildSystemInstruction } from '../../../../lib/interviewer-prompt.js';

export const runtime = 'nodejs';

// Ephemeral tokens are only supported on v1alpha (see @google/genai Tokens.create docs).
const API_VERSION = 'v1alpha';
const DEFAULT_MODEL = 'gemini-2.5-flash-native-audio-preview-12-2025';
const DEFAULT_VOICE = 'Kore';
const DEFAULT_VAD_SILENCE_MS = 800;

export async function POST(request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'GEMINI_API_KEY is not set on the server' }, { status: 500 });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    // empty body is fine
  }

  const { section = 'a', clientName = '', resumeHandle = null, resume = null } = body;
  if (!['a', 'b', 'c'].includes(section)) {
    return Response.json({ error: `Invalid section: ${section}` }, { status: 400 });
  }

  const model = process.env.GEMINI_LIVE_MODEL || DEFAULT_MODEL;
  const voice = process.env.GEMINI_VOICE || DEFAULT_VOICE;
  const vadSilenceMs = Number(process.env.GEMINI_VAD_SILENCE_MS || DEFAULT_VAD_SILENCE_MS);

  try {
    const systemInstruction = await buildSystemInstruction({ section, clientName, resume });

    // Single source of truth for the Live config. It is both locked into the
    // token (liveConnectConstraints) and echoed to the browser, which passes it
    // verbatim to ai.live.connect(). That way it does not matter whether the
    // constrained endpoint treats the token config as "locked" or "default".
    const connectConfig = {
      responseModalities: ['AUDIO'],
      systemInstruction,
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      inputAudioTranscription: {},
      outputAudioTranscription: {},
      contextWindowCompression: { slidingWindow: {} },
      sessionResumption: resumeHandle ? { handle: resumeHandle } : {},
      realtimeInputConfig: {
        automaticActivityDetection: { silenceDurationMs: vadSilenceMs },
      },
    };

    const now = Date.now();
    const expiresAt = new Date(now + 30 * 60 * 1000).toISOString();
    const newSessionExpireTime = new Date(now + 2 * 60 * 1000).toISOString();

    const ai = new GoogleGenAI({ apiKey, httpOptions: { apiVersion: API_VERSION } });
    const token = await ai.authTokens.create({
      config: {
        uses: 1,
        expireTime: expiresAt,
        newSessionExpireTime,
        liveConnectConstraints: { model, config: connectConfig },
      },
    });

    return Response.json({
      token: token.name,
      model,
      apiVersion: API_VERSION,
      connectConfig,
      expiresAt,
    });
  } catch (err) {
    console.error('Gemini token error:', err);
    const message = err?.message || String(err);
    return Response.json({ error: `Could not create Gemini token: ${message}` }, { status: 502 });
  }
}
