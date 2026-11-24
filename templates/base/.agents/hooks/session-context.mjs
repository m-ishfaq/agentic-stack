#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(
  process.env.AGENTIC_PROJECT_ROOT || process.env.CLAUDE_PROJECT_DIR || process.cwd(),
);
const lines = [];

lines.push('Session context:');
lines.push('- Response contract: start every response with `TLDR:` on its own line.');

try {
  const branch = git(['rev-parse', '--abbrev-ref', 'HEAD']);
  lines.push(`- Branch: ${branch}`);
} catch {
  lines.push('- Branch: unknown');
}

try {
  const status = git(['status', '--short']).split('\n').filter(Boolean);
  lines.push(`- Dirty files: ${status.length}`);
  for (const entry of status.slice(0, 8)) lines.push(`  ${entry}`);
} catch {
  lines.push('- Dirty files: unknown');
}

try {
  const log = git(['log', '-3', '--pretty=format:%h %s']);
  if (log) {
    lines.push('- Recent commits:');
    for (const entry of log.split('\n')) lines.push(`  ${entry}`);
  }
} catch {
  // No commits yet.
}

const state = path.join(root, '.agents', 'memory', 'state.md');
if (fs.existsSync(state)) {
  const goal = fs
    .readFileSync(state, 'utf8')
    .split('\n')
    .find((line) => line.trim().length > 0 && !line.startsWith('#'));
  if (goal) lines.push(`- State: ${goal.trim()}`);
}

const testCommand = readTestCommand(root);
if (testCommand) lines.push(`- Tests: ${testCommand}`);

lines.push('- Never commit, push, read .env, or touch a database.');

console.log(lines.join('\n'));

function git(args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: 5000,
  }).trim();
}

function readTestCommand(dir) {
  try {
    const config = JSON.parse(fs.readFileSync(path.join(dir, 'agentic.config.json'), 'utf8'));
    return config?.project?.commands?.testSafe ?? null;
  } catch {
    return null;
  }
}
