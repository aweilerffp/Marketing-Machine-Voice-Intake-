// Claude-facilitated handoff brief. Called when a Gemini Live session cannot be
// resumed with a resumption handle and must be re-seeded from the transcript.
//
// POST { section, transcript, elapsedMinutes? }
// → { covered, notCovered, keyFacts, nextQuestion, resumeSentence, pendingAnswerNote }
// Any failure returns 502 so the client falls back to a raw transcript tail.

import Anthropic from '@anthropic-ai/sdk';
import { buildHandoffPrompt } from '../../../lib/interviewer-prompt.js';

export const runtime = 'nodejs';

const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 600;
const TIMEOUT_MS = 20000;

function isValidBrief(b) {
  return (
    b && typeof b === 'object' &&
    typeof b.resumeSentence === 'string' && b.resumeSentence.trim().length > 0 &&
    b.nextQuestion && Number.isInteger(b.nextQuestion.n) && typeof b.nextQuestion.text === 'string'
  );
}

function parseJsonLoose(text) {
  let raw = text.trim();
  if (raw.startsWith('```')) {
    raw = raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
  }
  try {
    return JSON.parse(raw);
  } catch {
    // Salvage the first {...} block if the model added prose around it.
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
    throw new Error('Handoff response was not JSON');
  }
}

export async function POST(request) {
  try {
    const { section, transcript, elapsedMinutes = null } = await request.json();

    if (!['a', 'b', 'c'].includes(section)) {
      return Response.json({ error: `Invalid section: ${section}` }, { status: 400 });
    }
    if (!transcript || typeof transcript !== 'string' || transcript.trim().length < 20) {
      return Response.json({ error: 'Transcript too short for a handoff' }, { status: 400 });
    }

    const { system, user, schema } = await buildHandoffPrompt({ section, transcript, elapsedMinutes });
    const client = new Anthropic();
    const signal = AbortSignal.timeout(TIMEOUT_MS);

    // Plain JSON first (measurably faster than grammar-constrained output for
    // this size); fall back to the JSON-schema constrained call if it does not parse.
    let brief;
    try {
      const response = await client.messages.create(
        {
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system,
          messages: [{ role: 'user', content: user }],
        },
        { signal },
      );
      const text = response.content.find(b => b.type === 'text')?.text;
      if (!text) throw new Error('Empty response from Claude');
      brief = parseJsonLoose(text);
      if (!isValidBrief(brief)) {
        throw new Error('missing fields: ' + text.slice(0, 200));
      }
    } catch (err) {
      if (signal.aborted) throw err;
      console.warn('Handoff plain JSON failed, retrying with json_schema:', err?.message);
      const response = await client.messages.create(
        {
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system,
          messages: [{ role: 'user', content: user }],
          output_config: { format: { type: 'json_schema', schema } },
        },
        { signal },
      );
      const text = response.content.find(b => b.type === 'text')?.text;
      if (!text) throw new Error('Empty response from Claude');
      brief = parseJsonLoose(text);
    }

    if (!isValidBrief(brief)) {
      throw new Error('Handoff brief missing required fields');
    }

    return Response.json(brief);
  } catch (err) {
    console.error('Handoff error:', err);
    return Response.json({ error: err?.message || String(err) }, { status: 502 });
  }
}
