#!/usr/bin/env node
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline/promises';

const binDir = path.dirname(fileURLToPath(import.meta.url));
const bundledTemplates = path.resolve(binDir, '..', 'templates', 'base');
if (existsSync(bundledTemplates)) process.env.AGENTIC_TEMPLATES = bundledTemplates;

let core;
try {
  core = await import('../lib/core/index.js');
} catch {
  core = await import('../../core/src/index.js');
}
const {
  addProject,
  checkProject,
  doctorProject,
  ejectProject,
  initProject,
  syncProject,
  upgradeProject,
  VALID_STRICTNESS,
  VERSION,
} = core;

const args = process.argv.slice(2);
const command = args[0];
const flags = parseFlags(args.slice(1));

function parseFlags(list) {
  const result = { _: [] };
  for (let i = 0; i < list.length; i += 1) {
    const item = list[i];
    if (!item.startsWith('--')) {
      result._.push(item);
      continue;
    }
    const key = item.slice(2);
    if (['yes', 'force', 'dry-run', 'json', 'help', 'version'].includes(key)) {
      result[key] = true;
      continue;
    }
    const value = list[i + 1];
    if (value === undefined || value.startsWith('--')) {
      result[key] = true;
      continue;
    }
    result[key] = value;
    i += 1;
  }
  return result;
}

function list(value) {
  if (!value || value === true) return undefined;
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

async function main() {
  if (!command || command === 'help' || flags.help) return help();
  if (command === 'version' || flags.version) return console.log(VERSION);

  if (command === 'init') return init();
  if (command === 'sync') return sync();
  if (command === 'upgrade') return upgrade();
  if (command === 'add') return add();
  if (command === 'eject') return eject();
  if (command === 'check') return check();
  if (command === 'doctor') return doctor();

  console.error(`Unknown command: ${command}`);
  help();
  process.exitCode = 2;
}

async function init() {
  const root = flags._[0] ?? process.cwd();
  const options = {
    adapters: list(flags.adapters),
    packs: list(flags.packs),
    strictness: typeof flags.strictness === 'string' ? flags.strictness : undefined,
    gitignore: !flags['no-gitignore'],
    force: Boolean(flags.force),
    dryRun: Boolean(flags['dry-run']),
  };

  if (options.strictness && !VALID_STRICTNESS.includes(options.strictness)) {
    console.error(`Unknown strictness: ${options.strictness}. Use ${VALID_STRICTNESS.join(', ')}.`);
    process.exitCode = 2;
    return;
  }

  const plan = await initProject(root, { ...options, dryRun: true });
  if (!plan.ok && plan.collisions && !options.force) {
    console.error('Files already exist and differ:\n');
    for (const file of plan.collisions) console.error(`  ${file}`);
    console.error('\nNothing was written. Re-run with --force to back up and replace.');
    process.exitCode = 3;
    return;
  }
  if (!plan.ok) {
    for (const problem of plan.problems ?? []) console.error(problem);
    process.exitCode = plan.exitCode ?? 1;
    return;
  }

  if (options.dryRun) {
    console.log('Plan only. Nothing written.\n');
    for (const file of plan.files) console.log(`  ${file.path}`);
    return;
  }

  if (!flags.yes) {
    const confirmed = await confirm(`Install agentic-stack into ${root}? [Y/n] `);
    if (!confirmed) {
      console.log('Cancelled.');
      return;
    }
  }

  const result = await initProject(root, options);
  if (!result.ok) {
    for (const problem of result.problems ?? []) console.error(problem);
    for (const file of result.collisions ?? []) console.error(`conflict: ${file}`);
    process.exitCode = result.exitCode ?? 1;
    return;
  }

  console.log(`\nInstalled ${result.written.length} files.\n`);
  console.log('Adapters: ' + result.config.adapters.join(', '));
  console.log('Rules:    .agents/rules/');
  console.log('Skills:   .agents/skills/');
  console.log('Policy:   .agents/policies/deny.json');
  console.log('\nNext, you run:');
  console.log('  git status');
  console.log('  git add .agents AGENTS.md agentic.config.json .agentic .claude .cursor .github');
  console.log('  git commit -m "chore: add agentic-stack"');
  console.log('\nAgents never commit or push. That stays with you.');
}

async function sync() {
  const root = flags._[0] ?? process.cwd();
  const result = await syncProject(root, {
    dryRun: Boolean(flags['dry-run']),
    restore: Boolean(flags.restore),
  });
  if (result.drift.length > 0) {
    console.error('Skipped files edited by hand:\n');
    for (const file of result.drift) console.error(`  ${file}`);
    console.error('\nRevert them or re-run with a reviewed diff.');
  }
  if (result.missing.length > 0) {
    console.error('Deleted since install, left alone:\n');
    for (const file of result.missing) console.error(`  ${file}`);
    console.error('\nRun agentic sync --restore to recreate them.');
  }
  if (result.written.length === 0 && result.drift.length === 0 && result.missing.length === 0) {
    console.log('Already in sync.');
  } else if (result.written.length > 0) {
    console.log(`Updated ${result.written.length} generated files:`);
    for (const file of result.written) console.log(`  ${file}`);
  }
  if (result.drift.length > 0 || result.missing.length > 0) process.exitCode = 4;
}

async function upgrade() {
  const root = flags._[0] ?? process.cwd();
  const result = await upgradeProject(root, { dryRun: Boolean(flags['dry-run']) });

  if (result.added.length > 0) {
    console.log(`Added ${result.added.length}:`);
    for (const file of result.added) console.log(`  ${file}`);
  }
  if (result.updated.length > 0) {
    console.log(`Updated ${result.updated.length}:`);
    for (const file of result.updated) console.log(`  ${file}`);
  }
  if (result.kept.length > 0) {
    console.log(`Kept ${result.kept.length} local edits.`);
  }
  if (result.conflicts.length > 0) {
    console.error(`\n${result.conflicts.length} conflicts, nothing overwritten:`);
    for (const file of result.conflicts) console.error(`  ${file}`);
    console.error(`\nNew versions are in ${result.conflictDir}`);
    console.error('Review them, merge by hand, then run agentic sync.');
    process.exitCode = 6;
  }
  if (
    result.added.length === 0 &&
    result.updated.length === 0 &&
    result.conflicts.length === 0 &&
    result.kept.length === 0
  ) {
    console.log('Already up to date.');
  }
}

async function add() {
  const root = flags._[1] ?? process.cwd();
  const pack = flags._[0] ?? flags.pack;
  if (!pack || pack === true) {
    console.error('Usage: agentic add <pack> [dir]');
    process.exitCode = 2;
    return;
  }
  const result = await addProject(root, pack, { dryRun: Boolean(flags['dry-run']) });
  if (result.already) {
    console.log(`Pack already installed: ${pack}`);
    return;
  }
  console.log(`Added ${result.added.length} files for pack ${pack}:`);
  for (const file of result.added) console.log(`  ${file}`);
  console.log('\nRun agentic sync to update the tool adapters.');
}

async function eject() {
  const root = flags._[0] ?? process.cwd();
  if (!flags.yes) {
    const confirmed = await confirm(`Remove agentic metadata from ${root}? Files stay. [y/N] `);
    if (!confirmed) {
      console.log('Cancelled.');
      return;
    }
  }
  const result = await ejectProject(root, { dryRun: Boolean(flags['dry-run']) });
  console.log(`Removed: ${result.removed.join(', ') || 'nothing'}`);
  console.log('Rules, skills, hooks, and adapters were kept. Only check, sync, and upgrade stop working.');
}

async function check() {
  const root = flags._[0] ?? process.cwd();
  const result = await checkProject(root);
  if (flags.json) {
    console.log(JSON.stringify(result, null, 2));
  } else if (result.ok) {
    console.log(`agentic check: ok (${Object.keys(result.lock?.files ?? {}).length} files)`);
  } else {
    console.error('agentic check found problems:\n');
    for (const problem of result.problems) console.error(`  ${problem}`);
  }
  if (!result.ok) process.exitCode = 1;
}

async function doctor() {
  const root = flags._[0] ?? process.cwd();
  const result = await doctorProject(root);
  for (const item of result.checks) {
    console.log(`${item.ok ? 'ok  ' : 'FAIL'}  ${item.name}  ${item.detail}`);
  }
  if (!result.ok) process.exitCode = 1;
}

async function confirm(question) {
  if (!process.stdin.isTTY) return true;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = (await rl.question(question)).trim().toLowerCase();
  rl.close();
  return answer === '' || answer === 'y' || answer === 'yes';
}

function help() {
  console.log(`agentic-stack ${VERSION}

Usage:
  agentic init [dir] [options]
  agentic sync [dir] [--restore] [--dry-run]
  agentic upgrade [dir] [--dry-run]
  agentic add <pack> [dir]
  agentic eject [dir] [--yes]
  agentic check [dir] [--json]
  agentic doctor [dir]

Options:
  --yes                 accept defaults, no prompt
  --adapters <list>     claude,cursor,copilot,codex,gemini,devin,aider
  --packs <list>        typescript,react-next,python,go,php-laravel,java,rust,docker,monorepo,mobile
  --strictness <level>  strict, balanced, loose
  --no-gitignore        do not edit .gitignore
  --restore             recreate generated files deleted by hand
  --dry-run             print the plan, write nothing
  --force               back up and replace conflicting files
  --json                machine-readable output

The agent never commits, pushes, or touches your database.
You run git yourself.`);
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
