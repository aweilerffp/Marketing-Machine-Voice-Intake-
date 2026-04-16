#!/usr/bin/env node

import { createServer } from 'node:http';
import { execSync } from 'node:child_process';
import { createHmac } from 'node:crypto';

const PORT = 9000;
const BRANCH = 'claude/brand-voice-generation-Z60SB';
const REPO_DIR = process.env.REPO_DIR || '/root/Marketing-Machine-Voice-Intake-';
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || '';

function verifySignature(payload, signature) {
  if (!WEBHOOK_SECRET) return true; // skip if no secret configured
  if (!signature) return false;
  const expected = 'sha256=' + createHmac('sha256', WEBHOOK_SECRET).update(payload).digest('hex');
  return signature === expected;
}

function deploy() {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] Deploy triggered`);

  try {
    const commands = [
      `git -C ${REPO_DIR} pull origin ${BRANCH}`,
      `cd ${REPO_DIR}/workshop-app && npm install --production=false`,
      `cd ${REPO_DIR}/workshop-app && npm run build`,
      `pm2 restart workshop-app 2>/dev/null || pm2 start npm --name workshop-app --cwd ${REPO_DIR}/workshop-app -- run start -- --hostname 0.0.0.0 --port 3000`,
    ];

    for (const cmd of commands) {
      console.log(`  > ${cmd}`);
      const output = execSync(cmd, { encoding: 'utf-8', timeout: 120000 });
      if (output.trim()) console.log(`    ${output.trim()}`);
    }

    console.log(`[${timestamp}] Deploy complete`);
  } catch (err) {
    console.error(`[${timestamp}] Deploy failed:`, err.message);
  }
}

const server = createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/webhook') {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    // Verify GitHub signature
    if (!verifySignature(body, req.headers['x-hub-signature-256'])) {
      console.log('Rejected: invalid signature');
      res.writeHead(401);
      res.end('Invalid signature');
      return;
    }

    // Parse and check branch
    try {
      const payload = JSON.parse(body);
      const ref = payload.ref || '';
      if (!ref.endsWith(BRANCH)) {
        console.log(`Skipped: push to ${ref}, not ${BRANCH}`);
        res.writeHead(200);
        res.end('Skipped');
        return;
      }

      // Respond immediately, deploy in background
      res.writeHead(200);
      res.end('Deploying');
      deploy();
    } catch (err) {
      console.error('Parse error:', err.message);
      res.writeHead(400);
      res.end('Bad request');
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Deploy webhook listening on port ${PORT}`);
  console.log(`Branch: ${BRANCH}`);
  console.log(`Repo: ${REPO_DIR}`);
  console.log(`Secret: ${WEBHOOK_SECRET ? 'configured' : 'none (any request accepted)'}`);
});
