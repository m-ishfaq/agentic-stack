import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  checkProject,
  initProject,
  readLock,
  syncProject,
  templatesBasePath,
  upgradeProject,
} from '../src/index.js';
import { checkCommand } from '../src/policy.js';
import { budgetProblems, render } from '../src/render.js';
import { deniedPath, globToRegExp, withinRoot } from '../src/util.js';

test('glob matching handles basenames and nested paths', () => {
  assert.equal(globToRegExp('.env').test('.env'), true);
  assert.equal(globToRegExp('.env.*').test('.env.local'), true);
  assert.equal(globToRegExp('**/*.pem').test('certs/key.pem'), true);
  assert.equal(globToRegExp('**/secrets/**').test('a/secrets/b.txt'), true);
  assert.equal(deniedPath('.env', ['.env']), '.env');
  assert.equal(deniedPath('.env.example', ['.env']), null);
});

test('scope check rejects parent and absolute escapes', () => {
  const root = path.resolve('/project');
  assert.equal(withinRoot(root, path.join(root, 'src', 'a.js')), true);
  assert.equal(withinRoot(root, path.resolve('/project-evil/a.js')), false);
  assert.equal(withinRoot(root, path.resolve('/etc/passwd')), false);
});

test('policy blocks git writes, database clients, and deploys', () => {
  const policy = {
    deny: {
      commands: [
        '^git\\s+(commit|push|tag)',
        '^(psql|mysql|mongosh)',
        '^npm\\s+publish',
      ],
      network: { ports: [5432] },
    },
  };
  assert.equal(checkCommand('git push origin main', policy).blocked, true);
  assert.equal(checkCommand('git status', policy).blocked, false);
  assert.equal(checkCommand('psql postgres://localhost/dev', policy).blocked, true);
  assert.equal(checkCommand('npm publish', policy).blocked, true);
  assert.equal(checkCommand('psql --port 5432', policy).blocked, true);
});

test('render substitutes and reports leftovers', () => {
  assert.equal(render('hi {{project.name}}', { project: { name: 'app' } }), 'hi app');
  const problems = budgetProblems(
    [{ path: 'AGENTS.md', content: 'a\nb\nc' }],
    { agentsMdLines: 2 },
  );
  assert.equal(problems.length, 1);
});

test('install writes adapters, policy, lock, and passes check', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agentic-'));
  const result = await initProject(root, {
    adapters: ['claude', 'cursor', 'copilot'],
  });
  assert.equal(result.ok, true, result.problems?.join(', '));

  const expected = [
    'AGENTS.md',
    '.agents/rules/05-response.md',
    '.agents/policies/deny.json',
    '.agents/hooks/guard.mjs',
    '.agents/scripts/test-safe.mjs',
    '.claude/settings.json',
    '.cursor/rules/05-response.mdc',
    '.github/copilot-instructions.md',
    'CLAUDE.md',
    'agentic.config.json',
    '.agentic/lock.json',
  ];
  for (const file of expected) {
    await fs.access(path.join(root, file));
  }

  const check = await checkProject(root);
  assert.equal(check.ok, true, check.problems.join(', '));

  const lock = await readLock(root);
  assert.ok(Object.keys(lock.files).length >= 38);

  const again = await initProject(root, { adapters: ['claude', 'cursor', 'copilot'] });
  assert.equal(again.ok, true);
  assert.deepEqual(again.collisions, []);
});

test('all adapters and packs install together', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agentic-all-'));
  const result = await initProject(root, {
    adapters: ['claude', 'cursor', 'copilot', 'codex', 'gemini', 'cline', 'devin', 'aider'],
    packs: ['typescript', 'python'],
    devcontainer: true,
    ci: true,
  });
  assert.equal(result.ok, true, result.problems?.join(', '));

  for (const file of [
    '.claude/skills/tdd/SKILL.md',
    '.claude/commands/spec.md',
    '.agents/rules/typescript--00-typescript.md',
    '.cursor/rules/typescript--00-typescript.mdc',
    '.devin/rules/05-response.md',
    '.clinerules/05-response.md',
    'GEMINI.md',
    '.gemini/commands/spec.toml',
    'CONVENTIONS.md',
    '.aider.conf.yml',
    '.devcontainer/devcontainer.json',
    '.github/workflows/agentic.yml',
    '.claude/rules/05-response.md',
  ]) {
    await fs.access(path.join(root, file));
  }

  const check = await checkProject(root);
  assert.equal(check.ok, true, check.problems.join(', '));
});

test('init stays neutral, merges existing files, and keeps user edits', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agentic-merge-'));
  await fs.writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({ scripts: { test: 'node --test', lint: 'eslint .' } }),
  );
  await fs.writeFile(path.join(root, 'CLAUDE.md'), '# My notes\n\nKeep this.\n');
  await fs.mkdir(path.join(root, '.claude'), { recursive: true });
  await fs.writeFile(
    path.join(root, '.claude', 'settings.json'),
    JSON.stringify({ permissions: { deny: ['Bash(rm:*)'] }, theme: 'dark' }),
  );
  await fs.mkdir(path.join(root, '.cursor'), { recursive: true });

  const result = await initProject(root, {});
  assert.equal(result.ok, true, result.problems?.join(', '));
  assert.deepEqual(result.config.adapters, ['claude', 'cursor']);
  assert.equal(result.config.project.packageManager, 'npm');
  assert.equal(result.config.project.commands.test, 'npm test');
  assert.equal(result.config.project.commands.testSafe, 'node .agents/scripts/test-safe.mjs');
  assert.equal(result.config.project.commands.typecheck, null);

  const claudeMd = await fs.readFile(path.join(root, 'CLAUDE.md'), 'utf8');
  assert.match(claudeMd, /Keep this\./);
  assert.equal(claudeMd.match(/@AGENTS\.md/g).length, 1);

  const settings = JSON.parse(await fs.readFile(path.join(root, '.claude', 'settings.json'), 'utf8'));
  assert.ok(settings.permissions.deny.includes('Bash(rm:*)'));
  assert.ok(settings.permissions.deny.includes('Bash(git push:*)'));
  assert.equal(settings.theme, 'dark');
  assert.ok(settings.hooks.PreToolUse.length > 0);

  const second = await initProject(root, {});
  assert.equal(second.ok, true);
  const stable = await fs.readFile(path.join(root, 'CLAUDE.md'), 'utf8');
  assert.equal(stable, claudeMd);
  assert.equal(stable.match(/@AGENTS\.md/g).length, 1);

  const agents = await fs.readFile(path.join(root, 'AGENTS.md'), 'utf8');
  assert.match(agents, /agentic-stack:begin/);
  assert.match(agents, /npm test/);

  await fs.appendFile(path.join(root, 'AGENTS.md'), '\nHuman note after the block.\n');
  await syncProject(root);
  const synced = await fs.readFile(path.join(root, 'AGENTS.md'), 'utf8');
  assert.match(synced, /Human note after the block\./);
  assert.equal(synced.match(/agentic-stack:begin/g).length, 1);
});

test('empty project defaults to every adapter and an explicit TLDR contract', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agentic-empty-'));
  const result = await initProject(root, {});
  assert.equal(result.ok, true, result.problems?.join(', '));
  assert.deepEqual(result.config.adapters, [
    'claude',
    'cursor',
    'copilot',
    'codex',
    'gemini',
    'cline',
    'devin',
    'aider',
  ]);
  assert.equal(result.config.project.stack, null);
  assert.equal(result.config.project.packageManager, null);
  assert.equal(result.config.project.commands.test, null);
  await assert.rejects(fs.access(path.join(root, '.devcontainer')));

  for (const file of [
    'CLAUDE.md',
    'GEMINI.md',
    '.github/copilot-instructions.md',
    '.cursor/rules/05-response.mdc',
    '.clinerules/05-response.md',
    '.devin/rules/05-response.md',
    'CONVENTIONS.md',
  ]) {
    await fs.access(path.join(root, file));
  }

  for (const file of [
    'AGENTS.md',
    'CLAUDE.md',
    'GEMINI.md',
    '.github/copilot-instructions.md',
    '.cursor/rules/05-response.mdc',
    '.clinerules/05-response.md',
    '.devin/rules/05-response.md',
    'CONVENTIONS.md',
  ]) {
    const content = await fs.readFile(path.join(root, file), 'utf8');
    assert.match(content, /TLDR:/, file);
  }

  const agents = await fs.readFile(path.join(root, 'AGENTS.md'), 'utf8');
  assert.match(agents, /not configured/);
});

test('explicit empty adapter list keeps a neutral install', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agentic-neutral-'));
  const result = await initProject(root, { adapters: [] });
  assert.equal(result.ok, true, result.problems?.join(', '));
  assert.deepEqual(result.config.adapters, []);
  await assert.rejects(fs.access(path.join(root, 'CLAUDE.md')));
  await assert.rejects(fs.access(path.join(root, '.cursor')));
  assert.match(await fs.readFile(path.join(root, 'AGENTS.md'), 'utf8'), /TLDR:/);
});

test('detects Laravel commands without assuming npm', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agentic-laravel-'));
  await fs.writeFile(
    path.join(root, 'composer.json'),
    JSON.stringify({ require: { 'laravel/framework': '^11.0' }, scripts: { dev: 'vite' } }),
  );
  await fs.writeFile(path.join(root, 'artisan'), '');

  const result = await initProject(root, {});
  assert.equal(result.ok, true, result.problems?.join(', '));
  assert.equal(result.config.project.stack, 'Laravel (PHP)');
  assert.equal(result.config.project.packageManager, 'composer');
  assert.equal(result.config.project.commands.test, 'php artisan test');
  assert.equal(result.config.project.commands.install, 'composer install');
  assert.equal(result.config.project.commands.dev, 'composer run dev');
  assert.equal(result.config.project.commands.build, null);
  assert.deepEqual(result.config.packs, ['php-laravel']);
});

test('upgrade keeps local edits and reports conflicts', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agentic-upgrade-'));
  await initProject(root, { adapters: ['cursor'] });

  const generated = path.join(root, '.cursor', 'rules', '10-code-quality.mdc');
  await fs.appendFile(generated, '\nlocal note\n');

  const first = await upgradeProject(root);
  assert.ok(first.kept.includes('.cursor/rules/10-code-quality.mdc'));
  assert.equal(first.conflicts.length, 0);

  const copy = await fs.mkdtemp(path.join(os.tmpdir(), 'agentic-tpl-'));
  await fs.cp(templatesBasePath(), copy, { recursive: true });
  await fs.appendFile(path.join(copy, '.agents', 'rules', '10-code-quality.md'), '\nnew rule\n');

  const second = await upgradeProject(root, { templatesBase: copy });
  assert.ok(second.conflicts.includes('.cursor/rules/10-code-quality.mdc'));
  const unchanged = await fs.readFile(generated, 'utf8');
  assert.ok(unchanged.includes('local note'));
});

test('guard hook blocks unsafe actions and allows safe ones', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agentic-guard-'));
  await fs.writeFile(
    path.join(root, 'package.json'),
    JSON.stringify({ scripts: { test: 'node --test' } }),
  );
  await initProject(root, { adapters: ['claude'] });
  const guard = path.join(root, '.agents', 'hooks', 'guard.mjs');

  const run = (payload, projectRoot = root) =>
    spawnSync(process.execPath, [guard], {
      input: JSON.stringify(payload),
      env: { ...process.env, AGENTIC_PROJECT_ROOT: projectRoot },
      encoding: 'utf8',
    });

  assert.equal(run({ tool_name: 'Bash', tool_input: { command: 'git push' } }).status, 2);
  assert.equal(run({ tool_name: 'Bash', tool_input: { command: 'git add .' } }).status, 2);
  assert.equal(run({ tool_name: 'Bash', tool_input: { command: 'npm test' } }).status, 2);
  assert.equal(
    run({ tool_name: 'Bash', tool_input: { command: 'node .agents/scripts/test-safe.mjs' } }).status,
    0,
  );
  assert.equal(run({ tool_name: 'Read', tool_input: { file_path: '.env' } }).status, 2);
  assert.equal(run({ tool_name: 'Read', tool_input: { file_path: '.env.example' } }).status, 0);

  const linkedRoot = path.join(root, 'linked-root');
  try {
    await fs.symlink(root, linkedRoot, 'junction');
    assert.equal(
      run({ tool_name: 'Read', tool_input: { file_path: '.env.example' } }, linkedRoot).status,
      0,
    );
  } catch {
    // Some Windows setups disallow symlinks. The realpath fix still applies.
  }
  assert.equal(run({ tool_name: 'Write', tool_input: { file_path: '../x' } }).status, 2);
  assert.equal(
    run({ tool_name: 'Bash', tool_input: { command: 'npm run test:safe' } }).status,
    0,
  );
});

test('init leaves .gitignore alone when gitignore is disabled', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agentic-gitignore-'));
  const result = await initProject(root, { adapters: ['claude'], gitignore: false });
  assert.equal(result.ok, true);
  await assert.rejects(fs.access(path.join(root, '.gitignore')));

  const second = await initProject(root, { adapters: ['claude'], gitignore: false });
  assert.equal(second.ok, true);
});

test('sync reports deleted files and restores them only when asked', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agentic-restore-'));
  await initProject(root, { adapters: ['claude'] });

  const removed = '.claude/commands/spec.md';
  await fs.rm(path.join(root, removed));

  const reported = await syncProject(root);
  assert.ok(reported.missing.includes(removed));
  await assert.rejects(fs.access(path.join(root, removed)));

  const restored = await syncProject(root, { restore: true });
  assert.ok(restored.written.includes(removed));
  await fs.access(path.join(root, removed));
  assert.equal(await checkProject(root).then((result) => result.ok), true);
});

test('strictness controls how the ask list is enforced', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agentic-strict-'));
  await initProject(root, { adapters: ['claude'], strictness: 'strict' });
  const guard = path.join(root, '.agents', 'hooks', 'guard.mjs');
  const configFile = path.join(root, 'agentic.config.json');

  const run = () =>
    spawnSync(process.execPath, [guard], {
      input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'npm install left-pad' } }),
      env: { ...process.env, AGENTIC_PROJECT_ROOT: root },
      encoding: 'utf8',
    });

  const strict = run();
  assert.equal(strict.status, 2);
  assert.match(strict.stderr, /needs review/);

  const setLevel = async (level) => {
    const config = JSON.parse(await fs.readFile(configFile, 'utf8'));
    config.policy.strictness = level;
    await fs.writeFile(configFile, `${JSON.stringify(config, null, 2)}\n`);
  };

  await setLevel('balanced');
  const balanced = run();
  assert.equal(balanced.status, 0);
  assert.match(balanced.stderr, /Ask first/);

  await setLevel('loose');
  const loose = run();
  assert.equal(loose.status, 0);
  assert.equal(loose.stderr, '');
});

test('check reports missing hooks and pack rules', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agentic-check-'));
  await initProject(root, { adapters: ['claude'], packs: ['typescript'] });

  await fs.rm(path.join(root, '.agents', 'hooks', 'guard.mjs'));
  await fs.rm(path.join(root, '.agents', 'rules', 'typescript--00-typescript.md'));

  const result = await checkProject(root);
  assert.equal(result.ok, false);
  assert.ok(result.problems.includes('missing hook: .agents/hooks/guard.mjs'));
  assert.ok(result.problems.includes('missing rules for pack: typescript'));
});

test('safe test runner refuses foreign, dev, and wrongly named databases', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agentic-test-'));
  await initProject(root, { adapters: ['claude'] });
  await fs.writeFile(
    path.join(root, 'agentic.config.json'),
    JSON.stringify({
      version: 1,
      project: { name: 'x', commands: { test: 'node -e "process.exit(0)"' } },
      adapters: ['claude'],
      packs: [],
      policy: {},
      budgets: {},
    }),
  );
  const runner = path.join(root, '.agents', 'scripts', 'test-safe.mjs');
  const run = (env) =>
    spawnSync(process.execPath, [runner], {
      cwd: root,
      env: { ...process.env, ...env },
      encoding: 'utf8',
    });

  assert.equal(run({ TEST_DATABASE_URL: 'postgres://db.example.com/app_test' }).status, 1);
  assert.equal(run({ TEST_DATABASE_URL: 'postgres://localhost:5432/app' }).status, 1);
  assert.equal(
    run({
      TEST_DATABASE_URL: 'postgres://localhost:5432/app_test',
      DEV_DATABASE_URL: 'postgres://localhost:5432/app_test',
    }).status,
    1,
  );
  assert.equal(run({ TEST_DATABASE_URL: 'postgres://localhost:5432/app_test' }).status, 0);
});
