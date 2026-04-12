#!/usr/bin/env node

import Anthropic from '@anthropic-ai/sdk';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join, basename, extname } from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 16000;

const projectRoot = join(fileURLToPath(import.meta.url), '..', '..');

async function resolveTranscriptPath(arg) {
  if (arg) {
    // If absolute path or relative path with directory, use as-is
    if (arg.includes('/') || arg.includes('\\')) {
      if (existsSync(arg)) return arg;
      throw new Error(`Transcript file not found: ${arg}`);
    }
    // Otherwise look in transcripts/
    const path = join(projectRoot, 'transcripts', arg);
    if (existsSync(path)) return path;
    throw new Error(`Transcript file not found: ${path}`);
  }

  // No arg — find first non-.gitkeep file in transcripts/
  const transcriptsDir = join(projectRoot, 'transcripts');
  const files = await readdir(transcriptsDir);
  const transcript = files.find(f => f !== '.gitkeep' && !f.startsWith('.'));
  if (!transcript) {
    throw new Error(
      'No transcript file found in transcripts/.\n' +
      'Usage: npm run generate -- <filename>\n' +
      '   or: drop a transcript file into transcripts/'
    );
  }
  return join(transcriptsDir, transcript);
}

async function readProjectFile(relativePath, description) {
  const fullPath = join(projectRoot, relativePath);
  if (!existsSync(fullPath)) {
    throw new Error(`Missing ${description}: ${fullPath}`);
  }
  return readFile(fullPath, 'utf-8');
}

async function main() {
  const transcriptArg = process.argv[2];

  // Resolve transcript path
  const transcriptPath = await resolveTranscriptPath(transcriptArg);
  console.log(`Transcript: ${transcriptPath}`);

  // Read all input files in parallel
  const [transcript, promptTemplate, questions, template, schemaRaw] = await Promise.all([
    readFile(transcriptPath, 'utf-8'),
    readProjectFile('prompts/brand-voice-generation.md', 'generation prompt'),
    readProjectFile('prompts/brand-voice-questions.md', 'discovery questions'),
    readProjectFile('prompts/brand-voice-template.md', 'deliverable template'),
    readProjectFile('schemas/brand-voice-output.json', 'output schema'),
  ]);

  // Assemble system prompt
  const systemPrompt = promptTemplate
    .replace('{{QUESTIONS}}', questions)
    .replace('{{TEMPLATE}}', template);

  // Assemble user message
  const userMessage = [
    'Here is the Brand Voice discovery session transcript to analyze:',
    '',
    '<transcript>',
    transcript,
    '</transcript>',
    '',
    'Analyze this transcript and produce the structured brand voice extraction.',
  ].join('\n');

  // Load schema
  const schema = JSON.parse(schemaRaw);

  // Call Claude API
  console.log(`\nCalling ${MODEL}...`);
  const startTime = Date.now();

  const client = new Anthropic();

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
    output_config: {
      format: {
        type: 'json_schema',
        schema: schema,
      },
    },
  });

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  // Extract result
  const textBlock = response.content.find(block => block.type === 'text');
  if (!textBlock) {
    throw new Error('No text block in response. Stop reason: ' + response.stop_reason);
  }

  const result = JSON.parse(textBlock.text);

  // Write output
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const inputName = basename(transcriptPath, extname(transcriptPath));
  const outputPath = join(projectRoot, 'outputs', `${inputName}-${timestamp}.json`);
  await writeFile(outputPath, JSON.stringify(result, null, 2));

  // Print summary
  console.log(`\nDone in ${elapsed}s`);
  console.log(`Output: ${outputPath}`);
  console.log(`Stop reason: ${response.stop_reason}`);
  console.log(`Tokens: ${response.usage.input_tokens} in / ${response.usage.output_tokens} out`);

  console.log('\n--- Theme Summary ---');
  for (const [key, section] of Object.entries(result.themes)) {
    const insights = section.insights?.length || 0;
    const quotes = section.verbatim_quotes?.length || 0;
    const donts = section.explicit_dont?.length || 0;
    console.log(`  ${section.section_title}: ${insights} insights, ${quotes} quotes, ${donts} don'ts`);
  }

  console.log('\n--- Coverage Summary ---');
  const coverage = result.coverage_check;
  const fully = coverage.filter(q => q.coverage_depth === 'fully_covered').length;
  const partial = coverage.filter(q => q.coverage_depth === 'partially_covered').length;
  const none = coverage.filter(q => q.coverage_depth === 'not_covered').length;
  console.log(`  ${coverage.length} questions: ${fully} fully covered, ${partial} partial, ${none} not covered`);

  if (none > 0) {
    console.log('  Gaps:');
    coverage
      .filter(q => q.coverage_depth === 'not_covered')
      .forEach(q => console.log(`    Q${q.question_number}: ${q.question_text}`));
  }

  console.log('\n--- Client Reflection (preview) ---');
  console.log(`  ${result.client_reflection.substring(0, 200)}...`);
}

main().catch(err => {
  console.error('\nError:', err.message);
  if (err.status) {
    console.error(`API status: ${err.status}`);
  }
  process.exit(1);
});
