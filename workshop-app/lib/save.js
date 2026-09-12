// Server-only. Writes workshop transcripts and deliverables to
// <repo root>/outputs/<client-slug>/<session-id>/ (gitignored).
import { mkdir, writeFile, readFile, access } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { slugify, isValidSessionId, sectionFileBase } from './slug.js';
import { renderSectionMarkdown, renderWorkshopMarkdown } from './render-markdown.js';

// Mirrors PROJECT_ROOT in lib/extract.js: cwd is workshop-app/ under pm2.
export const OUTPUTS_ROOT = process.env.WORKSHOP_OUTPUTS_DIR
  ? resolve(process.env.WORKSHOP_OUTPUTS_DIR)
  : resolve(process.cwd(), '..', 'outputs');

async function exists(path) {
  try { await access(path); return true; } catch { return false; }
}

export async function sessionDir({ clientName, sessionId }) {
  if (!isValidSessionId(sessionId)) throw new Error('Invalid sessionId');
  const dir = resolve(OUTPUTS_ROOT, slugify(clientName), sessionId);
  if (!dir.startsWith(OUTPUTS_ROOT + sep)) throw new Error('Refusing to write outside outputs/');
  await mkdir(dir, { recursive: true });
  return dir;
}

async function updateSessionJson(dir, ctx, patch) {
  const path = resolve(dir, 'session.json');
  let current = {};
  try { current = JSON.parse(await readFile(path, 'utf-8')); } catch { /* new session */ }
  const next = {
    ...current,
    clientName: ctx.clientName,
    sessionId: ctx.sessionId,
    startedAt: current.startedAt || ctx.startedAt || null,
    updatedAt: new Date().toISOString(),
    sections: { ...(current.sections || {}), ...(patch.sections || {}) },
    ...(patch.completedAt ? { completedAt: patch.completedAt } : {}),
  };
  await writeFile(path, JSON.stringify(next, null, 2));
}

export async function saveTranscript(ctx, letter, transcript) {
  const dir = await sessionDir(ctx);
  const base = sectionFileBase(letter);
  await writeFile(resolve(dir, `${base}.txt`), String(transcript ?? ''));
  await updateSessionJson(dir, ctx, {
    sections: { [letter.toLowerCase()]: { transcriptSavedAt: new Date().toISOString() } },
  });
  return { dir, files: [`${base}.txt`] };
}

export async function saveSection(ctx, letter, sectionData) {
  const dir = await sessionDir(ctx);
  const base = sectionFileBase(letter);
  const upper = letter.toUpperCase();
  const jsonPath = resolve(dir, `${base}.json`);
  const existed = await exists(jsonPath);

  const md = renderSectionMarkdown({
    clientName: ctx.clientName,
    sessionId: ctx.sessionId,
    letter: upper,
    sectionData,
  });

  await Promise.all([
    writeFile(resolve(dir, `${base}.txt`), String(sectionData.transcript ?? '')),
    writeFile(jsonPath, JSON.stringify(sectionData.extractedData, null, 2)),
    writeFile(resolve(dir, `${base}.md`), md),
  ]);
  await updateSessionJson(dir, ctx, {
    sections: {
      [letter.toLowerCase()]: {
        transcriptSavedAt: new Date().toISOString(),
        savedAt: new Date().toISOString(),
        completedAt: sectionData.completedAt || null,
        hasExtraction: true,
      },
    },
  });
  return { dir, files: [`${base}.txt`, `${base}.json`, `${base}.md`], existed };
}

export async function saveWorkshop(ctx, sections) {
  const dir = await sessionDir(ctx);
  const md = renderWorkshopMarkdown({
    clientName: ctx.clientName,
    sessionId: ctx.sessionId,
    startedAt: ctx.startedAt,
    sections,
  });
  await writeFile(resolve(dir, 'workshop.md'), md);
  await updateSessionJson(dir, ctx, { completedAt: new Date().toISOString() });
  return { dir, files: ['workshop.md'] };
}
