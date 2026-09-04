// Server-only. Builds the live interviewer's system instruction for Gemini Live
// and the prompt for the Claude "handoff brief" used when a session must be
// re-seeded after a dropped connection.

import { SECTION_CONFIG, readProjectFile } from './extract.js';

const PERSONA_PATH = 'prompts/interviewer-persona.md';

const SECTION_META = {
  a: { name: 'Brand Voice', range: '1 to 22', first: 1, last: 22, minutes: 25 },
  b: { name: 'Ideal Customer Profile', range: '23 to 33', first: 23, last: 33, minutes: 15 },
  c: { name: 'Marketing & Channels', range: '34 to 41', first: 34, last: 41, minutes: 10 },
};

// Exact opening lines per section (Section A is the ElevenLabs first message).
const FIRST_MESSAGE = {
  a: (name) => `Hey there${name ? `, ${name}` : ''}! Welcome to your Brand Voice discovery session. I'm excited to dig into what makes your brand tick. So let's start at the top. Tell me, what does your company do? Give me the elevator pitch.`,
  b: (name) => `Great, that's the brand voice covered. Now let's talk about who ${name || 'you'} actually sells to. If you could clone your best client ten times, what industry are they in?`,
  c: () => `Last section, and it's a quick one: marketing and channels. Tell me honestly, what marketing are you doing right now?`,
};

const FALLBACK_PERSONA =`You are a warm, sharp brand strategist running a spoken discovery session with a company founder. Ask one short question at a time, listen closely, ask for concrete examples when answers are thin, and use the founder's own words back to them. Never read a list of questions aloud.`;

export function sectionMeta(section) {
  const meta = SECTION_META[section];
  if (!meta) throw new Error(`Invalid section: "${section}". Must be a, b, or c.`);
  return meta;
}

export async function readPersona() {
  try {
    const raw = await readProjectFile(PERSONA_PATH);
    // Strip the HTML comment header used for instructions in the file.
    const body = raw.replace(/<!--[\s\S]*?-->/g, '').trim();
    return body || FALLBACK_PERSONA;
  } catch {
    return FALLBACK_PERSONA;
  }
}

export async function readQuestions(section) {
  const config = SECTION_CONFIG[section];
  if (!config) throw new Error(`Invalid section: "${section}". Must be a, b, or c.`);
  return readProjectFile(config.questions);
}

/**
 * Build the system instruction for a live session.
 *
 * @param {object} opts
 * @param {'a'|'b'|'c'} opts.section
 * @param {string} [opts.clientName]
 * @param {object} [opts.resume]  Fallback-rollover seed. Either
 *   { handoff: {covered, notCovered, keyFacts, nextQuestion, resumeSentence, pendingAnswerNote} }
 *   or { rawTail: string }.
 */
export async function buildSystemInstruction({ section, clientName = '', resume = null }) {
  const meta = sectionMeta(section);
  const [persona, questions] = await Promise.all([readPersona(), readQuestions(section)]);

  const who = clientName ? `The founder's company is "${clientName}".` : '';

  const parts = [
    persona,
    '',
    '## This session',
    `You are running Section ${section.toUpperCase()}: ${meta.name}. ${who}`.trim(),
    `Cover questions ${meta.range} below, roughly in order, one question per turn. Aim to finish in about ${meta.minutes} minutes, so keep the pace moving: ask a follow-up only when the answer is thin, abstract, or missing a concrete example.`,
    'Do not number the questions aloud. Rephrase them naturally in your own voice. Keep each spoken question under about 25 words.',
    'When every question has been meaningfully covered, thank the founder briefly and tell them they can press "End Section" to continue.',
    '',
    '## Question bank',
    questions.trim(),
    '',
    '## Style rules',
    "- Favour the founder's own words. Never sanitise 'we're scrappy and figure it out' into 'agile problem-solving'.",
    '- Ask for stories, specific results, and the exact phrases they would use with a client.',
    '- Keep acknowledgements to a few words. Do not summarise their answers back to them at length.',
  ];

  if (!resume) {
    parts.push(
      '',
      '## Opening',
      `Your very first message must be exactly: "${FIRST_MESSAGE[section](clientName)}"`,
      'Then continue the interview from the founder\'s answer.',
    );
  } else if (resume.handoff) {
    const h = resume.handoff;
    const coveredNums = (h.covered || []).map(c => (typeof c === 'number' ? c : c?.n)).filter(Number.isFinite);
    const covered = coveredNums.length ? coveredNums.map(n => `Q${n}`).join(', ') : '(none yet)';
    const facts = (h.keyFacts || []).map(f => `- ${f}`).join('\n') || '- (none yet)';
    const next = h.nextQuestion ? `Q${h.nextQuestion.n}: ${h.nextQuestion.text}` : `Q${meta.first}`;
    parts.push(
      '',
      '## RESUMING AFTER A TECHNICAL PAUSE',
      'This conversation is resuming after a brief connection drop. The founder has already been greeted. Do NOT greet them again, do NOT re-introduce yourself, do NOT apologise for or mention the pause, and do NOT repeat questions that were already answered.',
      '',
      `Questions already covered (do not ask again): ${covered}`,
      '',
      'Key facts the founder has shared so far:',
      facts,
      h.pendingAnswerNote ? `\nNote: ${h.pendingAnswerNote}` : '',
      '',
      `Next question to ask: ${next}`,
      '',
      `Your very first sentence must be exactly: "${h.resumeSentence}"`,
      'Then continue the interview from the next question.',
    );
  } else if (resume.rawTail) {
    parts.push(
      '',
      '## RESUMING AFTER A TECHNICAL PAUSE',
      'This conversation is resuming after a brief connection drop. The founder has already been greeted. Do NOT greet them again and do NOT repeat questions that were already answered.',
      'Here is the end of the conversation so far (Q = you, A = the founder):',
      '',
      resume.rawTail,
      '',
      'Identify the last question you asked and whether it was answered. Do not apologise or mention the pause. Open with one short sentence that bridges from what the founder last said, then continue from the next unanswered question.',
    );
  }

  return parts.filter(p => p !== null && p !== undefined).join('\n');
}

/**
 * Prompt for the Claude handoff brief. Returns { system, user, schema }.
 */
export async function buildHandoffPrompt({ section, transcript, elapsedMinutes = null }) {
  const meta = sectionMeta(section);
  const questions = await readQuestions(section);

  const system = [
    'You are the facilitator of a live spoken discovery interview between an AI interviewer and a company founder.',
    'The interviewer\'s connection dropped and a fresh interviewer is about to take over. Your job is to write a precise handoff brief so the new interviewer continues seamlessly: no re-greeting, no repeated questions, no lost facts.',
    '',
    `Section ${section.toUpperCase()}: ${meta.name}. Questions ${meta.range}.`,
    '',
    '## Question bank',
    questions.trim(),
    '',
    '## Rules',
    'Be terse. This brief must be produced in a few seconds while the founder waits.',
    '- "covered": question numbers that were meaningfully answered. Numbers only.',
    '- "notCovered": the remaining question numbers in this section.',
    '- "keyFacts": at most 6 facts the new interviewer must remember (company, product, names, numbers, distinctive phrases). Each under 15 words.',
    '- "nextQuestion": the next question to ask, as {n, text} with text under 25 words. If the founder was cut off mid-answer, choose the same question so the interviewer can invite them to finish, and explain briefly in "pendingAnswerNote" (otherwise null).',
    '- "resumeSentence": the exact first sentence the new interviewer will speak. Warm, under 30 words. Do NOT apologise or mention a pause, glitch, or connection. Bridge naturally from what the founder last said into the next question. Example: "Right, you were telling me about the four pillars, so let\'s pick up with how you\'d describe your brand\'s personality."',
    '- Transcript lines: "Q:" is the interviewer, "A:" is the founder.',
    '',
    'Respond with a single JSON object only, no prose, no code fences, shaped exactly like:',
    '{"covered":[1,2],"notCovered":[3],"keyFacts":["..."],"nextQuestion":{"n":3,"text":"..."},"resumeSentence":"...","pendingAnswerNote":null}',
  ].join('\n');

  const user = [
    elapsedMinutes ? `About ${elapsedMinutes} minutes into the section.` : '',
    '',
    '<transcript>',
    transcript,
    '</transcript>',
    '',
    'Produce the handoff brief.',
  ].join('\n');

  const schema = {
    type: 'object',
    additionalProperties: false,
    properties: {
      covered: { type: 'array', items: { type: 'integer' } },
      notCovered: { type: 'array', items: { type: 'integer' } },
      keyFacts: { type: 'array', items: { type: 'string' } },
      nextQuestion: {
        type: 'object',
        additionalProperties: false,
        properties: { n: { type: 'integer' }, text: { type: 'string' } },
        required: ['n', 'text'],
      },
      resumeSentence: { type: 'string' },
      pendingAnswerNote: { anyOf: [{ type: 'string' }, { type: 'null' }] },
    },
    required: ['covered', 'notCovered', 'keyFacts', 'nextQuestion', 'resumeSentence', 'pendingAnswerNote'],
  };

  return { system, user, schema };
}
