#!/usr/bin/env node
import fs from 'node:fs/promises';
import { realpathSync } from 'node:fs';
import path from 'node:path';

const payload = await readPayload();
const projectRoot = path.resolve(
  process.env.AGENTIC_PROJECT_ROOT || process.env.CLAUDE_PROJECT_DIR || payload.cwd || process.cwd(),
);
// macOS and Linux temp dirs are often symlinks. Compare real paths on both sides.
const root = realPathSyncSafe(projectRoot) || projectRoot;
const tool = payload.tool_name || payload.toolName || '';
const input = payload.tool_input || payload.toolInput || {};

let policy;
try {
  policy = JSON.parse(
    await fs.readFile(path.join(root, '.agents', 'policies', 'deny.json'), 'utf8'),
  );
} catch {
  // No policy means no guard. Init must run first.
  process.exit(0);
}

const command = input.command || input.cmd || '';
const filePath = input.file_path || input.filePath || input.path || input.notebook_path || '';
const config = await readConfig();
const strictness = strictnessOf(config);
const testSafe = config?.project?.commands?.testSafe || '';

if (tool === 'Bash' || command) {
  const block = checkCommand(command, policy, testSafe);
  if (block) deny(block);
  const question = checkAskCommand(command, policy);
  if (question) handleAsk(question, strictness);
}

if (filePath) {
  const block = checkPath(filePath, tool, policy);
  if (block) deny(block);
  const question = checkAskPath(filePath, tool, policy);
  if (question) handleAsk(question, strictness);
}

process.exit(0);

function checkCommand(value, policy, testSafe = '') {
  if (!value) return null;

  for (const pattern of policy.deny?.commands ?? []) {
    try {
      if (new RegExp(pattern).test(value)) {
        return `command matches denied rule: ${pattern}`;
      }
    } catch {
      // A broken pattern must not disable the rest of the policy.
    }
  }

  if (/\b(printenv|\benv\b|set\s*$)/.test(value) && !/^\s*env\s+[A-Z_]+=/.test(value)) {
    return 'printing the environment can leak secrets';
  }
  if (
    /\b(cat|less|more|head|tail|grep|rg|awk|sed)\b[^|;]*\.env(\b|\.)/.test(value) &&
    !/\.env[^\s|;]*\.example/.test(value)
  ) {
    return 'reading .env is not allowed, use .env.example';
  }
  if (/\b(cat|less|more|head|tail)\b[^|;]*(\.ssh|\.aws|\.npmrc|\.pypirc)/.test(value)) {
    return 'reading credential files is not allowed';
  }

  if (/\bcd\s+(\.\.|~|\/|[A-Za-z]:[\\/])/.test(value)) {
    return 'changing directory outside the project is not allowed';
  }
  if (/(^|[\s"'`])(~\/|\.\.\/)/.test(value)) {
    return 'path traversal outside the project is not allowed';
  }

  const testPattern =
    /\b(npm|pnpm|yarn|bun)\s+(run\s+)?test\b|\b(pytest|go\s+test|cargo\s+test|phpunit|rspec|jest|vitest|php\s+artisan\s+test|node\s+--test|dotnet\s+test|mvn\s+test|gradlew?\s+test)\b/;
  if (testPattern.test(value)) {
    const normalized = value.replace(/\s+/g, ' ').trim();
    const allowed =
      (testSafe && normalized.includes(testSafe.replace(/\s+/g, ' ').trim())) ||
      /test-safe\.mjs|test:safe/.test(normalized);
    if (!allowed) {
      return testSafe
        ? `run tests only with: ${testSafe}`
        : 'no test command is configured, do not run tests directly';
    }
  }

  return null;
}

function checkAskCommand(value, policy) {
  if (!value) return null;
  for (const pattern of policy.ask?.commands ?? []) {
    try {
      if (new RegExp(pattern).test(value)) return `command needs review: ${pattern}`;
    } catch {
      // Ignore broken patterns.
    }
  }
  return null;
}

function checkAskPath(value, tool, policy) {
  if (tool === 'Read' || tool === 'Glob' || tool === 'Grep') return null;
  const relative = path.relative(root, path.resolve(root, value)).split(path.sep).join('/');
  const matched = (policy.ask?.paths ?? []).find((pattern) => glob(pattern).test(relative));
  return matched ? `write needs review: ${matched}` : null;
}

function handleAsk(reason, level) {
  if (level === 'loose') return;
  if (level === 'strict') deny(reason);
  console.error(`Ask first: ${reason}. Continue only if this is intended.`);
}

function checkPath(value, tool, policy) {
  const absolute = path.resolve(root, value);
  const real = realPathSyncSafe(absolute);

  if (!within(root, absolute) || (real && !within(root, real))) {
    return 'path is outside the project root';
  }

  const home = process.env.HOME || process.env.USERPROFILE || '';
  if (home) {
    const relativeHome = path.relative(home, absolute).split(path.sep).join('/');
    for (const pattern of policy.deny?.home ?? []) {
      if (glob(pattern.replace(/^~[\\/]/, '')).test(relativeHome)) {
        return `protected home path: ${pattern}`;
      }
    }
  }

  const relative = path.relative(root, absolute).split(path.sep).join('/');
  const matched = (policy.deny?.paths ?? []).find((pattern) => {
    if (pattern.startsWith('!')) return false;
    const cleaned = pattern.replace(/^\//, '');
    return glob(cleaned).test(relative) || (!cleaned.includes('/') && glob(cleaned).test(path.basename(relative)));
  });
  if (matched) {
    if (relative.endsWith('.env.example') || relative.endsWith('.example')) return null;
    return `protected path: ${matched}`;
  }

  if (tool !== 'Read' && (policy.protectedWrites ?? []).length > 0) {
    const protectedMatch = policy.protectedWrites.find((pattern) => glob(pattern).test(relative));
    if (protectedMatch) return `protected file, ask the human: ${protectedMatch}`;
  }

  return null;
}

function within(root, target) {
  const relative = path.relative(root, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function realPathSyncSafe(target) {
  try {
    return realpathSync(target);
  } catch {
    try {
      return path.join(realpathSync(path.dirname(target)), path.basename(target));
    } catch {
      return null;
    }
  }
}

function glob(pattern) {
  let out = '^';
  let i = 0;
  while (i < pattern.length) {
    const char = pattern[i];
    if (char === '*') {
      if (pattern[i + 1] === '*') {
        const slash = pattern[i + 2] === '/';
        out += slash ? '(?:.*/)?' : '.*';
        i += slash ? 3 : 2;
        continue;
      }
      out += '[^/]*';
      i += 1;
      continue;
    }
    if (char === '?') {
      out += '[^/]';
      i += 1;
      continue;
    }
    out += char.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    i += 1;
  }
  return new RegExp(`${out}$`);
}

function deny(reason) {
  console.error(`Blocked: ${reason}.`);
  console.error('Do not retry another way. Report it and let the human decide.');
  process.exit(2);
}

async function readConfig() {
  try {
    return JSON.parse(await fs.readFile(path.join(root, 'agentic.config.json'), 'utf8'));
  } catch {
    return null;
  }
}

function strictnessOf(config) {
  const level = config?.policy?.strictness;
  return level === 'balanced' || level === 'loose' ? level : 'strict';
}

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
