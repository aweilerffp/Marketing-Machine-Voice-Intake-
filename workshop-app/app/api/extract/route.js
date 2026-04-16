import { extractFromTranscript } from '../../../lib/extract.js';

export async function POST(request) {
  try {
    const { transcript, section } = await request.json();

    if (!transcript || typeof transcript !== 'string') {
      return Response.json({ error: 'transcript is required' }, { status: 400 });
    }
    if (!['a', 'b', 'c'].includes(section)) {
      return Response.json({ error: 'section must be a, b, or c' }, { status: 400 });
    }

    const result = await extractFromTranscript(transcript, section);
    return Response.json(result);
  } catch (err) {
    console.error('Extract error:', err);
    return Response.json(
      { error: err.message || 'Extraction failed' },
      { status: err.status || 500 }
    );
  }
}
