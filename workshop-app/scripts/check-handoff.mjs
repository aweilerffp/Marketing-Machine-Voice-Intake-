#!/usr/bin/env node
// Dry-runs the Claude handoff brief against a running dev server using the
// checked-in Section A test transcript, cut at ~60% and again mid-answer.
//
// Usage: node scripts/check-handoff.mjs [baseUrl]

import { readFile } from 'node:fs/promises';

const BASE_URL = process.argv[2] || process.env.BASE_URL || 'http://localhost:3000';
const transcript = await readFile(new URL('../public/transcripts/test-emplicit-section-a.txt', import.meta.url), 'utf-8');

async function run(label, text) {
  const t0 = Date.now();
  const res = await fetch(`${BASE_URL}/api/handoff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ section: 'a', transcript: text, elapsedMinutes: 12 }),
  });
  const body = await res.json().catch(() => ({}));
  const ms = Date.now() - t0;
  if (!res.ok) {
    console.error(`✗ ${label}: ${res.status} in ${ms} ms`, body);
    return false;
  }
  const coveredNums = (body.covered || []).map(c => (typeof c === 'number' ? c : c?.n)).filter(Number.isFinite);
  const nextN = body.nextQuestion?.n;
  const ok =
    typeof body.resumeSentence === 'string' && body.resumeSentence.length > 0 &&
    Number.isInteger(nextN) && nextN >= 1 && nextN <= 22 &&
    // next question must be one not yet covered, unless the founder was cut off mid-answer
    (!coveredNums.includes(nextN) || !!body.pendingAnswerNote);
  console.log(`${ok ? '✓' : '✗'} ${label} (${ms} ms)`);
  console.log('   covered:', (body.covered || []).map(c => (typeof c === 'number' ? c : c?.n)).join(', ') || '(none)');
  console.log('   next:', body.nextQuestion?.n, '-', body.nextQuestion?.text);
  console.log('   resume:', body.resumeSentence);
  if (body.pendingAnswerNote) console.log('   pending:', body.pendingAnswerNote);
  console.log('   facts:', (body.keyFacts || []).length);
  return ok;
}

const cut60 = transcript.slice(0, Math.floor(transcript.length * 0.6));
// Cut mid-answer: find the last "A:" line in the 60% slice and chop it in half.
const lastA = cut60.lastIndexOf('\nA:');
const midAnswer = lastA > 0 ? cut60.slice(0, lastA + Math.floor((cut60.length - lastA) / 2)) : cut60;

const a = await run('60% of section A', cut60);
const b = await run('cut mid-answer', midAnswer);
process.exit(a && b ? 0 : 1);
