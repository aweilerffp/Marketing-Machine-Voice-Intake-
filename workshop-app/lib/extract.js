import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 16000;

const SECTION_CONFIG = {
  a: {
    name: 'Brand Voice',
    prompt: 'prompts/brand-voice-generation.md',
    questions: 'prompts/brand-voice-questions.md',
    template: 'prompts/brand-voice-template.md',
    schema: 'schemas/brand-voice-output.json',
  },
  b: {
    name: 'ICP',
    prompt: 'prompts/icp-generation.md',
    questions: 'prompts/icp-questions.md',
    template: 'prompts/icp-template.md',
    schema: 'schemas/icp-output.json',
  },
  c: {
    name: 'Channels',
    prompt: 'prompts/channels-generation.md',
    questions: 'prompts/channels-questions.md',
    template: 'prompts/channels-template.md',
    schema: 'schemas/channels-output.json',
  },
};

// The prompts/schemas live in the parent directory (repo root)
const PROJECT_ROOT = join(process.cwd(), '..');

async function readProjectFile(relativePath) {
  return readFile(join(PROJECT_ROOT, relativePath), 'utf-8');
}

export async function extractFromTranscript(transcript, section) {
  const config = SECTION_CONFIG[section];
  if (!config) {
    throw new Error(`Invalid section: "${section}". Must be a, b, or c.`);
  }

  const [promptTemplate, questions, template, schemaRaw] = await Promise.all([
    readProjectFile(config.prompt),
    readProjectFile(config.questions),
    readProjectFile(config.template),
    readProjectFile(config.schema),
  ]);

  const systemPrompt = promptTemplate
    .replace('{{QUESTIONS}}', questions)
    .replace('{{TEMPLATE}}', template);

  const userMessage = [
    `Here is the ${config.name} discovery session transcript to analyze:`,
    '',
    '<transcript>',
    transcript,
    '</transcript>',
    '',
    `Analyze this transcript and produce the structured ${config.name.toLowerCase()} extraction.`,
  ].join('\n');

  const schema = JSON.parse(schemaRaw);

  const client = new Anthropic();
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
    output_config: {
      format: {
        type: 'json_schema',
        schema,
      },
    },
  });

  const textBlock = response.content.find(block => block.type === 'text');
  if (!textBlock) {
    throw new Error('No text block in response. Stop reason: ' + response.stop_reason);
  }

  return JSON.parse(textBlock.text);
}
