#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const payload = await readPayload();
const root = path.resolve(
  process.env.AGENTIC_PROJECT_ROOT || process.env.CLAUDE_PROJECT_DIR || payload.cwd || process.cwd(),
);
const input = payload.tool_input || payload.toolInput || {};
const file = input.file_path || input.filePath || input.path;
if (!file) process.exit(0);

const absolute = path.resolve(root, file);
const relative = path.relative(root, absolute);
if (relative.startsWith('..') || path.isAbsolute(relative) || !existsSync(absolute)) process.exit(0);

const ext = path.extname(absolute);
const isWindows = process.platform === 'win32';
const bin = (name) => path.join(root, 'node_modules', '.bin', isWindows ? `${name}.cmd` : name);

let command = null;
let args = [];

if (['.js', '.jsx', '.ts', '.tsx', '.json', '.css', '.scss', '.md', '.yml', '.yaml'].includes(ext)) {
  if (existsSync(bin('prettier'))) {
    command = bin('prettier');
    args = ['--write', absolute];
  }
} else if (ext === '.py') {
  const ruff = existsSync(path.join(root, '.venv', 'bin', 'ruff'))
    ? path.join(root, '.venv', 'bin', 'ruff')
    : isWindows
      ? null
      : 'ruff';
  if (ruff) {
    command = ruff;
    args = ['format', absolute];
  }
} else if (ext === '.go') {
  command = 'gofmt';
  args = ['-w', absolute];
} else if (ext === '.rs') {
  command = 'cargo';
  args = ['fmt', '--', absolute];
}

if (!command || !existsSync(command)) process.exit(0);

const result = spawnSync(command, args, {
  cwd: root,
  stdio: 'ignore',
  timeout: 10000,
  shell: false,
});

// Formatting never blocks. A failure is reported to the log only.
if (result.status !== 0) {
  console.error(`format: skipped ${relative}`);
}
process.exit(0);

async function readPayload() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}
