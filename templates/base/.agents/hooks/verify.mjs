#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(
  process.env.AGENTIC_PROJECT_ROOT || process.env.CLAUDE_PROJECT_DIR || process.cwd(),
);
const config = readConfig(root);
if (!config?.hooks?.verifyOnStop) process.exit(0);

const commands = config.project?.commands ?? {};
const order = [
  ['lint', commands.lint],
  ['typecheck', commands.typecheck],
  ['testSafe', commands.testSafe],
];

const failures = [];
for (const [name, command] of order) {
  if (!command || command === 'none') continue;
  const result = spawnSync(command, {
    cwd: root,
    shell: true,
    encoding: 'utf8',
    timeout: 240000,
  });
  if (result.status !== 0) {
    const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`.trim();
    failures.push({ name, output: tail(output, 20) });
  }
}

if (failures.length === 0) {
  console.log('verify: lint, typecheck, and tests pass.');
  process.exit(0);
}

console.error('Checks failed. Fix them before finishing:');
for (const failure of failures) {
  console.error(`\n${failure.name}:`);
  console.error(failure.output);
}
process.exit(2);

function tail(text, count) {
  return text.split('\n').slice(-count).join('\n');
}

function readConfig(dir) {
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, 'agentic.config.json'), 'utf8'));
  } catch {
    return null;
  }
}
