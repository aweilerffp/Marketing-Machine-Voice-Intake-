import Anthropic from '@anthropic-ai/sdk';
import { NUGGET_SYSTEM_PROMPT } from '../../../lib/nugget-prompt.js';

const MODEL = 'claude-haiku-4-5-20251001';

export async function POST(request) {
  try {
    const { transcript_chunk, existing_nuggets = [] } = await request.json();

    if (!transcript_chunk || typeof transcript_chunk !== 'string') {
      return Response.json({ nuggets: [] });
    }

    // Skip very short chunks
    if (transcript_chunk.trim().length < 50) {
      return Response.json({ nuggets: [] });
    }

    const client = new Anthropic();
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 256,
      system: NUGGET_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Already captured nuggets (do not repeat): ${JSON.stringify(existing_nuggets)}\n\nNew transcript chunk:\n"${transcript_chunk}"`,
      }],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    if (!textBlock) {
      return Response.json({ nuggets: [] });
    }

    let raw = textBlock.text.trim();
    if (raw.startsWith('```')) {
      raw = raw.replace(/^```(?:json)?\s*/, '').replace(/\s*```$/, '');
    }
    // Haiku occasionally appends prose after the object; keep only the first {...}.
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) raw = raw.slice(start, end + 1);
    const parsed = JSON.parse(raw);
    return Response.json({ nuggets: parsed.nuggets || [] });
  } catch (err) {
    console.error('Nugget detection error:', err);
    // Non-critical — return empty rather than error
    return Response.json({ nuggets: [] });
  }
}
