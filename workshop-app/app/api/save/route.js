import { saveTranscript, saveSection, saveWorkshop } from '../../../lib/save.js';
import { postSlack } from '../../../lib/slack.js';
import { isValidSessionId } from '../../../lib/slug.js';
import { coverageSummary } from '../../../lib/render-markdown.js';
import { SECTIONS } from '../../../lib/constants.js';

const EVENTS = new Set(['transcript', 'section', 'complete']);
const LETTERS = new Set(['a', 'b', 'c']);

function bad(error) {
  return Response.json({ ok: false, error }, { status: 400 });
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return bad('Invalid JSON body');
  }

  const { event, sessionId, clientName, startedAt, section, transcript } = body || {};
  if (!EVENTS.has(event)) return bad('event must be transcript, section, or complete');
  if (typeof clientName !== 'string' || !clientName.trim()) return bad('clientName is required');
  if (!isValidSessionId(sessionId)) return bad('sessionId is invalid');

  const ctx = { clientName: clientName.trim(), sessionId, startedAt };

  try {
    if (event === 'transcript') {
      if (!LETTERS.has(section)) return bad('section must be a, b, or c');
      if (transcript != null && typeof transcript !== 'string') return bad('transcript must be a string');
      const { dir, files } = await saveTranscript(ctx, section, transcript ?? '');
      return Response.json({ ok: true, dir, files, slack: 'skipped' });
    }

    if (event === 'section') {
      if (!LETTERS.has(section)) return bad('section must be a, b, or c');
      if (transcript != null && typeof transcript !== 'string') return bad('transcript must be a string');
      const { extractedData, nuggets, completedAt } = body;
      if (!extractedData || typeof extractedData !== 'object' || Array.isArray(extractedData)) {
        return bad('extractedData must be an object');
      }
      const sectionData = {
        transcript: transcript ?? '',
        extractedData,
        nuggets: Array.isArray(nuggets) ? nuggets : [],
        completedAt: completedAt || new Date().toISOString(),
      };
      const { dir, files, existed } = await saveSection(ctx, section, sectionData);
      const meta = SECTIONS[section.toUpperCase()];
      const text = [
        `${existed ? '(re-saved) ' : ''}:white_check_mark: Section ${section.toUpperCase()} – ${meta.label} done for *${ctx.clientName}*`,
        `Coverage: ${coverageSummary(extractedData.coverage_check)}`,
        `Files: ${dir}/section-${section}.{txt,json,md}`,
      ].join('\n');
      const slack = await postSlack(text);
      return Response.json({ ok: true, dir, files, slack });
    }

    // complete
    const raw = body.sections && typeof body.sections === 'object' ? body.sections : {};
    const sections = {};
    for (const letter of ['A', 'B', 'C']) {
      const sd = raw[letter] || raw[letter.toLowerCase()] || {};
      sections[letter] = {
        transcript: typeof sd.transcript === 'string' ? sd.transcript : '',
        extractedData: sd.extractedData && typeof sd.extractedData === 'object' ? sd.extractedData : null,
        nuggets: Array.isArray(sd.nuggets) ? sd.nuggets : [],
        completedAt: sd.completedAt || null,
      };
    }
    const { dir, files } = await saveWorkshop(ctx, sections);
    const lines = [`:tada: Workshop complete for *${ctx.clientName}*`];
    for (const letter of ['A', 'B', 'C']) {
      const meta = SECTIONS[letter];
      const sd = sections[letter];
      lines.push(`• ${letter} ${meta.label} — ${sd.extractedData ? coverageSummary(sd.extractedData.coverage_check) : 'not generated'}`);
    }
    lines.push(`Combined: ${dir}/workshop.md`);
    const slack = await postSlack(lines.join('\n'));
    return Response.json({ ok: true, dir, files, slack });
  } catch (err) {
    console.error('Save error:', err);
    return Response.json({ ok: false, error: err.message || 'Save failed' }, { status: 500 });
  }
}
