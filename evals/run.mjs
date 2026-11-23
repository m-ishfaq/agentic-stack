#!/usr/bin/env node
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkProject, initProject, checkCommand } from '../packages/core/src/index.js';
import { lineCount } from '../packages/core/src/util.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = path.join(root, 'templates', 'base');
const results = [];

async function check(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, error: error.message });
  }
}

await check('policy blocks the required actions', async () => {
  const policy = JSON.parse(
    await fs.readFile(path.join(base, '.agents', 'policies', 'deny.json'), 'utf8'),
  );
  const commands = policy.deny.commands;
  for (const sample of [
    'git push',
    'git commit -m x',
    'psql postgres://localhost/dev',
    'npm publish',
    'rm -rf build',
    'sudo apt install x',
  ]) {
    assert.ok(checkCommand(sample, policy).blocked, `not blocked: ${sample}`);
  }
  assert.ok(commands.some((rule) => rule.includes('.env') === false));
  assert.ok(policy.deny.paths.includes('.env'));
});

await check('response contract contains the hard rules', async () => {
  const text = await fs.readFile(path.join(base, '.agents', 'rules', '05-response.md'), 'utf8');
  for (const phrase of ['Answer first', 'em-dash', 'not verified', 'TLDR', 'English']) {
    assert.ok(text.includes(phrase), `missing: ${phrase}`);
  }
});

await check('no em-dashes in any template', async () => {
  const files = await listFiles(base);
  for (const file of files) {
    const content = await fs.readFile(file, 'utf8');
    assert.ok(!content.includes('\u2014'), `em-dash in ${path.relative(root, file)}`);
  }
});

await check('agent context stays inside budget', async () => {
  const agents = await fs.readFile(path.join(base, 'AGENTS.md'), 'utf8');
  assert.ok(lineCount(agents) <= 150, `AGENTS.md is ${lineCount(agents)} lines`);
  const rules = await fs.readdir(path.join(base, '.agents', 'rules'));
  for (const file of rules) {
    const content = await fs.readFile(path.join(base, '.agents', 'rules', file), 'utf8');
    assert.ok(lineCount(content) <= 60, `${file} is ${lineCount(content)} lines`);
  }
});

await check('every skill has valid frontmatter', async () => {
  const dir = path.join(base, '.agents', 'skills');
  for (const name of await fs.readdir(dir)) {
    const content = await fs.readFile(path.join(dir, name, 'SKILL.md'), 'utf8');
    assert.ok(content.startsWith('---\n'), `${name} has no frontmatter`);
    const [, front] = content.split('---\n');
    assert.ok(/^name: [a-z0-9-]+$/m.test(front), `${name} has an invalid name`);
    assert.ok(/^description: .+/m.test(front), `${name} has no description`);
  }
});

await check('install produces a clean project', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'agentic-eval-'));
  const result = await initProject(temp, {
    adapters: ['claude', 'cursor', 'copilot', 'gemini', 'devin', 'aider'],
    packs: ['typescript'],
  });
  assert.equal(result.ok, true, result.problems?.join(', '));
  const check = await checkProject(temp);
  assert.equal(check.ok, true, check.problems.join(', '));
});

await check('guard blocks unsafe commands and allows safe ones', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'agentic-guard-eval-'));
  await initProject(temp, { adapters: ['claude'] });
  const guard = path.join(temp, '.agents', 'hooks', 'guard.mjs');
  const run = (payload) =>
    spawnSync(process.execPath, [guard], {
      input: JSON.stringify(payload),
      env: { ...process.env, AGENTIC_PROJECT_ROOT: temp },
      encoding: 'utf8',
    }).status;

  assert.equal(run({ tool_name: 'Bash', tool_input: { command: 'git push' } }), 2);
  assert.equal(run({ tool_name: 'Bash', tool_input: { command: 'npm test' } }), 2);
  assert.equal(run({ tool_name: 'Read', tool_input: { file_path: '.env' } }), 2);
  assert.equal(run({ tool_name: 'Read', tool_input: { file_path: '.env.example' } }), 0);
  assert.equal(run({ tool_name: 'Bash', tool_input: { command: 'node .agents/scripts/test-safe.mjs' } }), 0);
});

await check('test runner refuses a dev database', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'agentic-test-eval-'));
  await initProject(temp, { adapters: ['claude'] });
  const runner = path.join(temp, '.agents', 'scripts', 'test-safe.mjs');
  const result = spawnSync(process.execPath, [runner], {
    cwd: temp,
    env: { ...process.env, TEST_DATABASE_URL: 'postgres://localhost:5432/app' },
    encoding: 'utf8',
  });
  assert.equal(result.status, 1);
});

await check('init is idempotent', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'agentic-idem-'));
  const first = await initProject(temp, { adapters: ['claude'] });
  const second = await initProject(temp, { adapters: ['claude'] });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.deepEqual(second.collisions, []);
});

const failed = results.filter((result) => !result.ok);
for (const result of results) {
  console.log(`${result.ok ? 'ok  ' : 'FAIL'}  ${result.name}`);
  if (!result.ok) console.log(`      ${result.error}`);
}
console.log(`\n${results.length - failed.length}/${results.length} evals passed`);
if (failed.length > 0) process.exitCode = 1;

async function listFiles(dir) {
  const found = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await listFiles(full)));
    else found.push(full);
  }
  return found;
}
