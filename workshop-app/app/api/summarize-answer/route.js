// Turns one spoken answer into 1-3 short bullets for the live UI, so the
// founder sees a clean capture instead of raw speech-to-text.
//
// POST { question, answer } → { bullets: string[] }   (empty array on any failure)

import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';

const MODEL = 'claude-haiku-4-5-20251001';

const SYSTEM = `You summarise one spoken answer from a company founder in a live brand discovery interview.
Return 1 to 3 bullets, each under 12 words, that capture what they said. Use their own words and phrases where you can. Fix obvious speech-to-text errors silently. No filler, no interpretation, no praise.
If the answer has no real content (e.g. "yeah", "um okay"), return an empty list.
Respond with JSON only: {"bullets": ["...", "..."]}`;

export async function POST(request) {
  try {
    const { question = '', answer } = await request.json();
    if (!answer || typeof answer !== 'string' || answer.trim().length < 12) {
      return Response.json({ bullets: [] });
    }

    const client = new Anthropic();
    const response = await client.messages.create(
      {
        model: MODEL,
        max_tokens: 200,
        system: SYSTEM,
        messages: [{
          role: 'user',
          content: `Question asked: "${question}"\n\nFounder's answer (raw speech-to-text): "${answer}"`,
        }],
      },
      { signal: AbortSignal.timeout(8000) },
    );

    const text = response.content.find(b => b.type === 'text')?.text || '';
    let raw = text.trim();
    if (raw.startsWith('```')) raw = raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    const parsed = JSON.parse(start >= 0 && end > start ? raw.slice(start, end + 1) : raw);
    const bullets = Array.isArray(parsed.bullets)
      ? parsed.bullets.filter(b => typeof b === 'string' && b.trim()).slice(0, 3)
      : [];
    return Response.json({ bullets });
  } catch (err) {
    console.error('Answer summary error:', err?.message || err);
    return Response.json({ bullets: [] });
  }
}
