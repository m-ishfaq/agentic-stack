import fs from 'node:fs/promises';
import path from 'node:path';
import { adapterCapabilities } from './adapters.js';
import { CONFIG_FILE, loadConfig } from './config.js';
import { currentHash, readLock } from './lock.js';
import { loadPolicy } from './policy.js';
import { lineCount, pathExists } from './util.js';

export async function checkProject(root) {
  const target = path.resolve(root);
  const problems = [];

  let config;
  try {
    config = await loadConfig(target);
    if (!config) problems.push(`missing ${CONFIG_FILE}`);
  } catch (error) {
    problems.push(`config invalid: ${error.message}`);
  }

  try {
    await loadPolicy(target);
  } catch (error) {
    problems.push(`policy invalid: ${error.message}`);
  }

  const requiredHooks = ['.agents/hooks/guard.mjs', '.agents/scripts/test-safe.mjs'];
  if (config?.hooks?.verifyOnStop) requiredHooks.push('.agents/hooks/verify.mjs');
  for (const file of requiredHooks) {
    if (!(await pathExists(path.join(target, file)))) problems.push(`missing hook: ${file}`);
  }

  if (config?.adapters?.includes('claude')) {
    const settingsFile = path.join(target, '.claude', 'settings.json');
    if (!(await pathExists(settingsFile))) {
      problems.push('missing .claude/settings.json');
    } else {
      try {
        const settings = JSON.parse(await fs.readFile(settingsFile, 'utf8'));
        const wired = (settings.hooks?.PreToolUse ?? []).some((entry) =>
          (entry.hooks ?? []).some((hook) => String(hook.command ?? '').includes('guard.mjs')),
        );
        if (!wired) problems.push('guard hook is not wired in .claude/settings.json');
      } catch (error) {
        problems.push(`.claude/settings.json invalid: ${error.message}`);
      }
    }
  }

  for (const pack of config?.packs ?? []) {
    const present = (await safeReaddir(path.join(target, '.agents', 'rules'))).some(
      (file) => file.startsWith(`${pack}--`) && file.endsWith('.md'),
    );
    if (!present) problems.push(`missing rules for pack: ${pack}`);
  }

  const lock = await readLock(target);
  if (!lock) {
    problems.push('missing .agentic/lock.json');
  } else {
    for (const [file, meta] of Object.entries(lock.files ?? {})) {
      const hash = await currentHash(target, file);
      if (hash === null) {
        problems.push(`missing generated file: ${file}`);
        continue;
      }
      const blockFile = file === 'AGENTS.md' || file === '.codex/config.toml';
      if (meta.managed && blockFile) {
        const text = await fs.readFile(path.join(target, file), 'utf8');
        if (!text.includes('agentic-stack:begin')) {
          problems.push(`missing managed block: ${file}`);
        }
      } else if (!meta.managed && hash !== meta.sha256) {
        problems.push(`drift: ${file}`);
      }
    }
  }

  if (!(await pathExists(path.join(target, '.agents', 'project.md')))) {
    problems.push('missing .agents/project.md');
  }

  const agentsFile = path.join(target, 'AGENTS.md');
  if (await pathExists(agentsFile)) {
    const content = await fs.readFile(agentsFile, 'utf8');
    const lines = lineCount(content);
    const budget = config?.budgets?.agentsMdLines ?? 150;
    if (lines > budget) problems.push(`AGENTS.md is ${lines} lines, budget is ${budget}`);
  } else {
    problems.push('missing AGENTS.md');
  }

  const gitignore = path.join(target, '.gitignore');
  if (await pathExists(gitignore)) {
    const content = await fs.readFile(gitignore, 'utf8');
    if (!content.split(/\r?\n/).includes('.env')) problems.push('.env is not ignored by git');
  } else {
    problems.push('missing .gitignore');
  }

  return { ok: problems.length === 0, problems, lock };
}

async function safeReaddir(dir) {
  try {
    return await fs.readdir(dir);
  } catch {
    return [];
  }
}

export async function doctorProject(root) {
  const target = path.resolve(root);
  const checks = [];

  const major = Number(process.versions.node.split('.')[0]);
  checks.push({ name: 'node', ok: major >= 20, detail: `v${process.versions.node}` });

  checks.push({
    name: 'git',
    ok: await pathExists(path.join(target, '.git')),
    detail: 'repository detected',
  });

  try {
    const config = await loadConfig(target);
    checks.push({ name: 'config', ok: Boolean(config), detail: config ? 'parses' : 'missing' });
  } catch (error) {
    checks.push({ name: 'config', ok: false, detail: error.message });
  }

  try {
    await loadPolicy(target);
    checks.push({ name: 'policy', ok: true, detail: 'parses' });
  } catch (error) {
    checks.push({ name: 'policy', ok: false, detail: error.message });
  }

  checks.push({
    name: 'lock',
    ok: Boolean(await readLock(target)),
    detail: 'present',
  });

  checks.push({
    name: 'guard hook',
    ok: await pathExists(path.join(target, '.agents', 'hooks', 'guard.mjs')),
    detail: '.agents/hooks/guard.mjs',
  });

  checks.push({
    name: 'test runner',
    ok: await pathExists(path.join(target, '.agents', 'scripts', 'test-safe.mjs')),
    detail: '.agents/scripts/test-safe.mjs',
  });

  let adapters = [];
  try {
    const config = await loadConfig(target);
    adapters = adapterCapabilities(config?.adapters ?? []);
  } catch {
    adapters = [];
  }

  return { ok: checks.every((check) => check.ok), checks, adapters };
}
