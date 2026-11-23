import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildAdapterFiles,
  buildBaseFiles,
  installedAgents,
  installedCommands,
  installedMcpServers,
  installedRules,
  installedSkills,
  loadPackFiles,
} from './adapters.js';
import { CONFIG_FILE, defaultConfig, loadConfig, saveConfig } from './config.js';
import { detectProject } from './detect.js';
import { readLock, writeLock } from './lock.js';
import { mergeTarget, wrapNewManaged } from './merge.js';
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
  else if (!existing && detected.adapters.length > 0) config.adapters = detected.adapters;

  if (options.packs) config.packs = options.packs;
  if (options.strictness) config.policy.strictness = options.strictness;
  if (options.ci !== undefined) config.extras = { ...config.extras, ci: options.ci };
  if (options.devcontainer !== undefined) {
    config.extras = { ...config.extras, devcontainer: options.devcontainer };
  }

  config.project = {
    ...config.project,
    name: config.project.name || detected.name,
    stack: config.project.stack ?? detected.stack ?? null,
    packageManager: config.project.packageManager ?? detected.packageManager ?? null,
    commands: fillNulls(config.project.commands ?? {}, detected.commands),
  };

  const templatesBase = options.templatesBase ?? templatesBasePath();
  const baseFiles = await buildBaseFiles({
    templatesBase,
    config,
    version: VERSION,
    sourceDir: await detectSourceDir(root),
    extras: config.extras ?? {},
  });
  const packFiles = await loadPackFiles(templatesBase, config.packs);
  const policy = JSON.parse(
    await fs.readFile(path.join(templatesBase, '.agents', 'policies', 'deny.json'), 'utf8'),
  );
  const allBase = [...baseFiles, ...packFiles];
  const rules = baseRulesFromFiles(allBase);
  const skills = skillsFromFiles(baseFiles);
  const commands = commandsFromFiles(baseFiles);
  const agents = agentsFromFiles(baseFiles);
  const agentsContent = stripManaged(
    baseFiles.find((file) => file.path === 'AGENTS.md')?.content ?? '',
  );
  const mcpServers = {
    ...mcpServersFromFiles(baseFiles),
    ...(existing ? await installedMcpServers(root) : {}),
  };

  const files = [
    ...allBase,
    ...buildAdapterFiles({
      config,
      version: VERSION,
      rules,
      skills,
      commands,
      agents,
      agentsContent,
      mcpServers,
    }),
  ];

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
  const plan = await planWrites(target, files, options, lock);
  if (!plan.ok) return { ...plan, written: [], config };

  if (options.dryRun) {
    return {
      ok: true,
      exitCode: 0,
      dryRun: true,
      files,
      collisions: [],
      written: [],
      merged: plan.merged,
      skipped: plan.skipped,
      config,
    };
  }

  const backupDir = path.join(target, '.agentic', 'backups', timestamp());
  const written = [];
  const entries = {};
  for (const item of plan.writes) {
    const full = path.join(target, item.file.path);
    if (item.backup && (await pathExists(full))) {
      const backup = path.join(backupDir, item.file.path);
      await fs.mkdir(path.dirname(backup), { recursive: true });
      await fs.copyFile(full, backup);
    }
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, item.content, 'utf8');
    written.push(item.file.path);
    entries[item.file.path] = {
      sha256: sha256(item.content),
      source: item.file.source,
      generated: item.file.generated,
      ...(item.file.merge ? { managed: true } : {}),
    };
  }

  for (const [filePath, meta] of Object.entries(lock?.files ?? {})) {
    if (entries[filePath]) continue;
    if (plan.skipped.includes(filePath)) continue;
    if (await pathExists(path.join(target, filePath))) {
      entries[filePath] = meta;
    }
  }

  if (options.gitignore !== false) await ensureGitignore(target);
  await saveConfig(target, config);
  await writeLock(target, [], {
    ...lockMeta(lock, config),
    files: entries,
  });

  return {
    ok: true,
    exitCode: 0,
    written,
    merged: plan.merged,
    skipped: plan.skipped,
    collisions: [],
    config,
    detected,
  };
}

function newFileContent(file) {
  return wrapNewManaged(file.path, file.content);
}

async function planWrites(target, files, options, lock) {
  const writes = [];
  const merged = [];
  const skipped = [];

  for (const file of files) {
    const full = path.join(target, file.path);
    if (!withinRoot(target, full)) {
      return { ok: false, exitCode: 1, problems: [`refusing to write outside root: ${file.path}`] };
    }
    if (!(await pathExists(full))) {
      writes.push({ file, content: newFileContent(file), backup: false });
      continue;
    }
    const existing = await fs.readFile(full, 'utf8');
    if (existing === file.content) continue;

    if (options.force) {
      writes.push({ file, content: newFileContent(file), backup: true });
      continue;
    }

    const locked = lock?.files?.[file.path]?.sha256;
    if (!file.merge && locked && sha256(existing) === locked) {
      writes.push({ file, content: newFileContent(file), backup: false });
      continue;
    }

    const mergedContent = file.merge ? mergeTarget(file.path, existing, file.content) : null;
    if (mergedContent === null) {
      skipped.push(file.path);
      continue;
    }
    if (mergedContent === existing) continue;
    merged.push(file.path);
    writes.push({ file, content: mergedContent, backup: true });
  }

  return { ok: true, writes, merged, skipped };
}

export async function syncProject(root, options = {}) {
  const target = path.resolve(root);
  const config = await loadConfig(target);
  if (!config) throw new Error(`missing ${CONFIG_FILE}. Run agentic init first.`);
  const policy = await loadPolicy(target);
  const detected = await detectProject(target);

  config.project = { ...config.project, stack: config.project.stack ?? detected.stack ?? null };
  config.project.packageManager =
    config.project.packageManager ?? detected.packageManager ?? null;
  config.project.commands = fillNulls(config.project.commands ?? {}, detected.commands);

  const currentAgents = (await pathExists(path.join(target, 'AGENTS.md')))
    ? await fs.readFile(path.join(target, 'AGENTS.md'), 'utf8')
    : '';
  const agentsContent = stripManaged(currentAgents);
  const rules = await installedRules(target);
  const skills = await installedSkills(target);
  const commands = await installedCommands(target);
  const agents = await installedAgents(target);
  const mcpServers = await installedMcpServers(target);

  let files = buildAdapterFiles({
    config,
    version: VERSION,
    rules,
    skills,
    commands,
    agents,
    agentsContent,
    mcpServers,
  });

  const templatesBase = options.templatesBase ?? templatesBasePath();
  const baseFiles = await buildBaseFiles({
    templatesBase,
    config,
    version: VERSION,
    sourceDir: await detectSourceDir(target),
    extras: {},
  });
  const agentsFile = baseFiles.find((file) => file.path === 'AGENTS.md');
  if (agentsFile) files = [agentsFile, ...files];

  const lock = await readLock(target);
  const entries = { ...(lock?.files ?? {}) };
  const drift = [];
  const missing = [];
  const written = [];

  for (const file of files) {
    const full = path.join(target, file.path);
    const previous = lock?.files?.[file.path];
    const current = (await pathExists(full)) ? await fs.readFile(full, 'utf8') : null;

    if (current === null && previous) {
      if (!options.restore) {
        missing.push(file.path);
        continue;
      }
    } else if (file.merge && current !== null) {
      const merged = mergeTarget(file.path, current, file.content);
      if (merged === null || merged === current) continue;
      if (!options.dryRun) {
        await fs.writeFile(full, merged, 'utf8');
        written.push(file.path);
      }
      entries[file.path] = lockEntry(file, merged);
      continue;
    } else if (previous && current !== null && sha256(current) !== previous.sha256) {
      drift.push(file.path);
      continue;
    }

    const content = newFileContent(file);
    if (current === content) continue;
    if (!options.dryRun) {
      await fs.mkdir(path.dirname(full), { recursive: true });
      await fs.writeFile(full, content, 'utf8');
      written.push(file.path);
    }
    entries[file.path] = lockEntry(file, content);
  }

  if (!options.dryRun && written.length > 0) {
    await writeLock(target, [], { ...lockMeta(lock, config), files: entries });
  }

  await saveConfig(target, config);
  return { ok: true, written, drift, missing, files };
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
      const content = newFileContent(file);
      if (!options.dryRun) {
        await fs.mkdir(path.dirname(full), { recursive: true });
        await fs.writeFile(full, content, 'utf8');
      }
      entries[file.path] = lockEntry(file, content);
      added.push(file.path);
      continue;
    }

    if (current === file.content) continue;

    if (file.merge) {
      const merged = mergeTarget(file.path, current, file.content) ?? file.content;
      if (merged === current) continue;
      if (!options.dryRun) await fs.writeFile(full, merged, 'utf8');
      entries[file.path] = lockEntry(file, merged);
      updated.push(file.path);
      continue;
    }

    const currentHash = sha256(current);

    if (!previous) {
      conflicts.push(file.path);
      await saveConflict(conflictDir, file, options);
      continue;
    }

    if (currentHash === previous.sha256) {
      if (!options.dryRun) await fs.writeFile(full, file.content, 'utf8');
      entries[file.path] = lockEntry(file, file.content);
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

  if (!options.dryRun) await writeLock(target, [], { ...lockMeta(lock), files: entries });
  return { added, updated, conflicts, kept, conflictDir };
}

function lockMeta(lock, config) {
  return {
    templateVersion: lock?.templateVersion ?? VERSION,
    cliVersion: VERSION,
    generatedAt: new Date().toISOString(),
    adapters: config?.adapters ?? lock?.adapters ?? [],
    packs: config?.packs ?? lock?.packs ?? [],
  };
}

function lockEntry(file, content) {
  return {
    sha256: sha256(content),
    source: file.source,
    generated: file.generated,
    ...(file.merge ? { managed: true } : {}),
  };
}

function fillNulls(current, detected) {
  const result = { ...current };
  for (const [key, value] of Object.entries(detected ?? {})) {
    if (result[key] == null) result[key] = value;
  }
  return result;
}

async function saveConflict(dir, file, options) {
  if (options.dryRun) return;
  const target = path.join(dir, `${file.path}.new`);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, file.content, 'utf8');
}

function baseRulesFromFiles(files) {
  return files
    .filter((file) => file.path.startsWith('.agents/rules/') && file.path.endsWith('.md'))
    .map((file) => ({ name: path.basename(file.path, '.md'), content: file.content }));
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

function agentsFromFiles(files) {
  const agents = [];
  for (const file of files) {
    const match = file.path.match(/^\.agents\/agents\/([^/]+)\.md$/);
    if (match) agents.push({ name: match[1], content: file.content });
  }
  return agents;
}

function mcpServersFromFiles(files) {
  const file = files.find((item) => item.path === '.agents/mcp.json');
  if (!file) return {};
  try {
    return JSON.parse(file.content).mcpServers ?? {};
  } catch {
    return {};
  }
}

function stripManaged(text) {
  return text
    .replace(/<!-- agentic-stack:begin -->\r?\n?/g, '')
    .replace(/<!-- agentic-stack:end -->\r?\n?/g, '');
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
