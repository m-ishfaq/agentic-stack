#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const root = path.resolve(process.env.AGENTIC_PROJECT_ROOT || process.cwd());
const config = await readConfig();
const testCommand = config?.project?.commands?.test;

if (!testCommand || testCommand === 'none') {
  fail('No test command is configured. Set project.commands.test in agentic.config.json.');
}

const unsafe = /\b(TRUNCATE|DROP\s+(TABLE|DATABASE|SCHEMA))\b|delete\s+from\s+\w+\s*(;|$)/i;
if (unsafe.test(testCommand)) {
  fail('The test command contains a destructive SQL statement.');
}

const url = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL_TEST || '';
if (url) {
  const check = validateDatabase(url);
  if (!check.ok) fail(check.reason);
  const dev = process.env.DEV_DATABASE_URL;
  if (dev && normalize(dev) === normalize(url)) {
    fail('The test database URL matches DEV_DATABASE_URL.');
  }
  console.log(`test-safe: database target accepted (${check.kind}).`);
} else {
  console.log('test-safe: no test database URL set, running without a database check.');
  console.log('test-safe: set TEST_DATABASE_URL for any test that touches a database.');
}

console.log(`test-safe: ${testCommand}`);

const child = spawn(testCommand, {
  shell: true,
  stdio: 'inherit',
  cwd: root,
  env: {
    ...process.env,
    NODE_ENV: 'test',
    AGENTIC_TEST: '1',
  },
});

child.on('exit', (code, signal) => {
  if (signal) {
    console.error(`test-safe: stopped by ${signal}`);
    process.exit(1);
  }
  process.exit(code ?? 1);
});

child.on('error', (error) => {
  fail(`Could not start the test command: ${error.message}`);
});

function validateDatabase(value) {
  if (value === ':memory:' || value.startsWith('file::memory:')) {
    return { ok: true, kind: 'sqlite memory' };
  }
  if (value.startsWith('file:')) {
    return value.includes('_test')
      ? { ok: true, kind: 'sqlite file' }
      : { ok: false, reason: 'SQLite file must include _test in its name.' };
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return { ok: false, reason: 'The test database URL cannot be parsed.' };
  }

  const allowedHosts = ['127.0.0.1', 'localhost', '::1', 'db-test'];
  const host = parsed.hostname.replace(/^\[|\]$/g, '');
  if (!allowedHosts.includes(host)) {
    return { ok: false, reason: `Database host must be local, got ${host}.` };
  }

  const kind = parsed.protocol.replace(/:$/, '');
  const name = parsed.pathname.replace(/^\//, '');
  if (kind === 'redis') return { ok: true, kind: 'redis' };
  if (!name.endsWith('_test')) {
    return { ok: false, reason: `Database name must end with _test, got ${name || 'empty'}.` };
  }
  return { ok: true, kind };
}

function normalize(value) {
  try {
    const parsed = new URL(value);
    return `${parsed.hostname}:${parsed.port}/${parsed.pathname}`;
  } catch {
    return value;
  }
}

async function readConfig() {
  try {
    return JSON.parse(await fs.readFile(path.join(root, 'agentic.config.json'), 'utf8'));
  } catch {
    return null;
  }
}

function fail(message) {
  console.error(`test-safe refused: ${message}`);
  console.error('Do not change the database target to get past this check.');
  process.exit(1);
}
