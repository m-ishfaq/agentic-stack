import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  baseRules,
  buildAdapterFiles,
  buildBaseFiles,
  buildCopilotFiles,
  buildCursorFiles,
  installedCommands,
  installedRules,
  installedSkills,
  loadPackFiles,
} from './adapters.js';
import { CONFIG_FILE, defaultConfig, loadConfig, saveConfig } from './config.js';
import { detectProject } from './detect.js';
import { readLock, writeLock } from './lock.js';
import { loadPolicy } from './policy.js';
import { budgetProblems } from './render.js';
import { pathExists, sha256, withinRoot } from './util.js';
import { VERSION } from './version.js';

const TEMPLATES_BASE = new URL('../../../templates/base/', import.meta.url);

export function templatesBasePath() {
  if (process.env.AGENTIC_TEMPLATES && existsSync(process.env.AGENTIC_TEMPLATES)) {
    return process.env.AGENTIC_TEMPLATES;
  }
  return fileURLToPath(TEMPLATES_BASE);
}

export async function planInstall(root, options = {}) {
  const detected = await detectProject(root);
  const existing = await loadConfig(root);
  const config = existing ?? defaultConfig(detected);
  if (options.adapters) config.adapters = options.adapters;
  if (options.packs) config.packs = options.packs;
  if (options.strictness) config.policy.strictness = options.strictness;
  config.project = {
    ...config.project,
    name: config.project.name || detected.name,
    stack: detected.stack,
    packageManager: detected.packageManager,
    commands: detected.commands,
  };

  const templatesBase = options.templatesBase ?? templatesBasePath();
  const baseFiles = await buildBaseFiles({
    templatesBase,
    config,
    version: VERSION,
    sourceDir: await detectSourceDir(root),
  });
  const packFiles = await loadPackFiles(templatesBase, config.packs);
  const policy = JSON.parse(
    await fs.readFile(path.join(templatesBase, '.agents', 'policies', 'deny.json'), 'utf8'),
  );
  const allBase = [...baseFiles, ...packFiles];
  const rules = baseRules(allBase);
  const skills = skillsFromFiles(baseFiles);
  const commands = commandsFromFiles(baseFiles);
  const agentsContent = baseFiles.find((file) => file.path === 'AGENTS.md')?.content ?? '';

  const files = [
    ...allBase,
    ...buildAdapterFiles({
      config,
      version: VERSION,
      rules,
      skills,
      commands,
      agentsContent,
    }),
  ];
  if (config.adapters.includes('cursor')) {
    files.push(...buildCursorFiles({ rules, policy, version: VERSION }));
  }
  if (config.adapters.includes('copilot')) {
    files.push(...buildCopilotFiles({ agentsContent, rules, policy, version: VERSION }));
  }

  return { config, files, detected, templatesBase, policy };
}

export async function initProject(root, options = {}) {
  const target = path.resolve(root);
  const { config, files, detected } = await planInstall(target, options);
  const problems = budgetProblems(files, config.budgets ?? {}).filter(
    (problem) => !problem.includes('unresolved placeholder'),
  );
  if (problems.length > 0 && !options.allowBudgetOverrun) {
    return { ok: false, exitCode: 5, problems, written: [] };
  }

  const lock = await readLock(target);
  const collisions = [];
  for (const file of files) {
    const full = path.join(target, file.path);
    if (!withinRoot(target, full)) {
      return {
        ok: false,
        exitCode: 1,
        problems: [`refusing to write outside root: ${file.path}`],
        written: [],
      };
    }
    if (!(await pathExists(full))) continue;
    const existing = await fs.readFile(full, 'utf8');
    if (existing === file.content) continue;
    const locked = lock?.files?.[file.path]?.sha256;
    if (locked && sha256(existing) === locked) continue;
    collisions.push(file.path);
  }

  if (collisions.length > 0 && !options.force) {
    return { ok: false, exitCode: 3, collisions, problems: [], written: [], config };
  }

  if (options.dryRun) {
    return { ok: true, exitCode: 0, dryRun: true, files, collisions, written: [], config };
  }

  const backupDir = path.join(target, '.agentic', 'backups', timestamp());
  const written = [];
  for (const file of files) {
    const full = path.join(target, file.path);
    if (collisions.includes(file.path) && (await pathExists(full))) {
      const backup = path.join(backupDir, file.path);
      await fs.mkdir(path.dirname(backup), { recursive: true });
      await fs.copyFile(full, backup);
    }
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, file.content, 'utf8');
    written.push(file.path);
  }

  await ensureGitignore(target);
  await saveConfig(target, config);
  await writeLock(target, files, {
    templateVersion: VERSION,
    cliVersion: VERSION,
    generatedAt: new Date().toISOString(),
    adapters: config.adapters,
    packs: config.packs,
  });

  return { ok: true, exitCode: 0, written, config, detected, collisions };
}

export async function syncProject(root, options = {}) {
  const target = path.resolve(root);
  const config = await loadConfig(target);
  if (!config) throw new Error(`missing ${CONFIG_FILE}. Run agentic init first.`);
  const policy = await loadPolicy(target);
  const detected = await detectProject(target);
  config.project = { ...config.project, commands: detected.commands };

  const agentsContent = await fs.readFile(path.join(target, 'AGENTS.md'), 'utf8');
  const rules = await installedRules(target);
  const skills = await installedSkills(target);
  const commands = await installedCommands(target);

  let files = buildAdapterFiles({
    config,
    version: VERSION,
    rules,
    skills,
    commands,
    agentsContent,
  });
  if (config.adapters.includes('cursor')) {
    files = files.concat(buildCursorFiles({ rules, policy, version: VERSION }));
  }
  if (config.adapters.includes('copilot')) {
    files = files.concat(buildCopilotFiles({ agentsContent, rules, policy, version: VERSION }));
  }

  const lock = await readLock(target);
  const drift = [];
  const written = [];
  for (const file of files) {
    const full = path.join(target, file.path);
    const previous = lock?.files?.[file.path];
    const current = (await pathExists(full)) ? await fs.readFile(full, 'utf8') : null;
    if (previous && current !== null && sha256(current) !== previous.sha256) {
      drift.push(file.path);
      continue;
    }
    if (current === file.content) continue;
    if (!options.dryRun) {
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, file.content, 'utf8');
      written.push(file.path);
    }
  }

  if (!options.dryRun && written.length > 0) {
    const entries = { ...(lock?.files ?? {}) };
    for (const file of files) {
      entries[file.path] = {
        sha256: sha256(file.content),
        source: file.source,
        generated: file.generated,
      };
    }
    await writeLockEntries(target, entries, lock);
  }

  await saveConfig(target, config);
  return { ok: true, written, drift, files };
}

export async function addProject(root, pack, options = {}) {
  const target = path.resolve(root);
  const config = await loadConfig(target);
  if (!config) throw new Error(`missing ${CONFIG_FILE}. Run agentic init first.`);
  if (!pack) throw new Error('pack name is required');

  const templatesBase = options.templatesBase ?? templatesBasePath();
  const packDir = path.join(templatesBase, '..', 'packs', pack);
  if (!(await pathExists(packDir))) throw new Error(`unknown pack: ${pack}`);

  if (config.packs.includes(pack)) {
    return { already: true, added: [], config };
  }

  const files = await loadPackFiles(templatesBase, [pack]);
  const added = [];
  for (const file of files) {
    const full = path.join(target, file.path);
    if (await pathExists(full)) continue;
    if (!options.dryRun) {
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, file.content, 'utf8');
    }
    added.push(file.path);
  }

  if (!options.dryRun) {
    config.packs = [...config.packs, pack];
    await saveConfig(target, config);
    const lock = await readLock(target);
    if (lock) {
      const entries = { ...lock.files };
      for (const file of files) {
        entries[file.path] = {
          sha256: sha256(file.content),
          source: file.source,
          generated: file.generated,
        };
      }
      await writeLockEntries(target, entries, lock);
    }
  }
  return { already: false, added, config };
}

export async function ejectProject(root, options = {}) {
  const target = path.resolve(root);
  const removed = [];
  for (const item of ['.agentic', CONFIG_FILE]) {
    const full = path.join(target, item);
    if (await pathExists(full)) {
      if (!options.dryRun) await fs.rm(full, { recursive: true, force: true });
      removed.push(item);
    }
  }
  return { removed };
}

export async function upgradeProject(root, options = {}) {
  const target = path.resolve(root);
  const { files } = await planInstall(target, options);
  const lock = await readLock(target);
  if (!lock) throw new Error('missing lock. Run agentic init first.');

  const entries = { ...lock.files };
  const added = [];
  const updated = [];
  const conflicts = [];
  const kept = [];
  const conflictDir = path.join(target, '.agentic', 'conflicts', timestamp());

  for (const file of files) {
    const full = path.join(target, file.path);
    const newHash = sha256(file.content);
    const previous = entries[file.path];
    const current = (await pathExists(full)) ? await fs.readFile(full, 'utf8') : null;

    if (current === null) {
      if (!options.dryRun) {
        await fs.mkdir(path.dirname(full), { recursive: true });
        await fs.writeFile(full, file.content, 'utf8');
      }
      entries[file.path] = entry(file, newHash);
      added.push(file.path);
      continue;
    }

    if (current === file.content) continue;
    const currentHash = sha256(current);

    if (!previous) {
      conflicts.push(file.path);
      await saveConflict(conflictDir, file, options);
      continue;
    }

    if (currentHash === previous.sha256) {
      if (!options.dryRun) await fs.writeFile(full, file.content, 'utf8');
      entries[file.path] = entry(file, newHash);
      updated.push(file.path);
      continue;
    }

    if (newHash === previous.sha256) {
      kept.push(file.path);
      continue;
    }

    conflicts.push(file.path);
    await saveConflict(conflictDir, file, options);
  }

  if (!options.dryRun) await writeLockEntries(target, entries, lock);
  return { added, updated, conflicts, kept, conflictDir };
}

function entry(file, hash) {
  return { sha256: hash, source: file.source, generated: file.generated };
}

async function saveConflict(dir, file, options) {
  if (options.dryRun) return;
  const target = path.join(dir, `${file.path}.new`);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, file.content, 'utf8');
}

function skillsFromFiles(files) {
  const skills = [];
  for (const file of files) {
    const match = file.path.match(/^\.agents\/skills\/([^/]+)\/SKILL\.md$/);
    if (match) skills.push({ name: match[1], content: file.content });
  }
  return skills;
}

function commandsFromFiles(files) {
  const commands = [];
  for (const file of files) {
    const match = file.path.match(/^\.agents\/commands\/([^/]+)\.md$/);
    if (match) commands.push({ name: match[1], content: file.content });
  }
  return commands;
}

export async function detectSourceDir(root) {
  for (const candidate of ['src', 'app', 'lib', 'packages', 'internal']) {
    if (await pathExists(path.join(root, candidate))) return candidate;
  }
  return '.';
}

async function ensureGitignore(root) {
  const file = path.join(root, '.gitignore');
  const required = [
    '.env',
    '.env.*',
    '!.env.example',
    '.agentic/logs/',
    '.agentic/backups/',
    '.agentic/conflicts/',
  ];
  let content = '';
  if (await pathExists(file)) content = await fs.readFile(file, 'utf8');
  const lines = content.split(/\r?\n/);
  const missing = required.filter((item) => !lines.includes(item));
  if (missing.length === 0) return;
  const prefix = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
  await fs.writeFile(file, `${content}${prefix}\n# agentic-stack\n${missing.join('\n')}\n`, 'utf8');
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

async function writeLockEntries(root, entries, previous) {
  const lock = {
    lockVersion: 1,
    templateVersion: previous?.templateVersion ?? VERSION,
    cliVersion: VERSION,
    generatedAt: new Date().toISOString(),
    adapters: previous?.adapters ?? [],
    packs: previous?.packs ?? [],
    files: entries,
  };
  const target = path.join(root, '.agentic', 'lock.json');
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(lock, null, 2)}\n`, 'utf8');
}
