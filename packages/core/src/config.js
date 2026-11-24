import fs from 'node:fs/promises';
import path from 'node:path';
import { pathExists } from './util.js';

export const CONFIG_FILE = 'agentic.config.json';

export const VALID_ADAPTERS = [
  'claude',
  'cursor',
  'copilot',
  'codex',
  'gemini',
  'cline',
  'devin',
  'aider',
];
export const VALID_STRICTNESS = ['strict', 'balanced', 'loose'];

export function defaultConfig(project) {
  return {
    version: 1,
    project: {
      name: project.name,
      stack: project.stack,
      packageManager: project.packageManager,
      commands: project.commands,
    },
    adapters: project.adapters?.length ? project.adapters : [...VALID_ADAPTERS],
    packs: project.packs ?? [],
    extras: {
      ci: false,
      devcontainer: false,
    },
    policy: {
      strictness: 'strict',
      scope: 'project',
      allowHome: false,
    },
    hooks: {
      verifyOnStop: false,
    },
    budgets: {
      agentsMdLines: 150,
      alwaysOnTokens: 4000,
      ruleLines: 60,
    },
  };
}

export async function loadConfig(root) {
  const file = path.join(root, CONFIG_FILE);
  if (!(await pathExists(file))) return null;
  const config = JSON.parse(await fs.readFile(file, 'utf8'));
  validateConfig(config);
  return config;
}

export function validateConfig(config) {
  if (!config || typeof config !== 'object') throw new Error('config must be an object');
  if (config.version !== 1) throw new Error(`unsupported config version: ${config.version}`);
  if (!config.project || typeof config.project.name !== 'string') {
    throw new Error('config.project.name is required');
  }
  if (!Array.isArray(config.adapters)) throw new Error('config.adapters must be an array');
  for (const adapter of config.adapters) {
    if (!VALID_ADAPTERS.includes(adapter)) throw new Error(`unknown adapter: ${adapter}`);
  }
  if (!Array.isArray(config.packs)) throw new Error('config.packs must be an array');
  for (const key of ['stack', 'packageManager']) {
    const value = config.project[key];
    if (value !== undefined && value !== null && typeof value !== 'string') {
      throw new Error(`config.project.${key} must be a string or null`);
    }
  }
  for (const [name, value] of Object.entries(config.project.commands ?? {})) {
    if (value !== null && typeof value !== 'string') {
      throw new Error(`config.project.commands.${name} must be a string or null`);
    }
  }
  const strictness = config.policy?.strictness;
  if (strictness !== undefined && !VALID_STRICTNESS.includes(strictness)) {
    throw new Error(`unknown strictness: ${strictness}. Use ${VALID_STRICTNESS.join(', ')}`);
  }
  return true;
}

export async function saveConfig(root, config) {
  validateConfig(config);
  const file = path.join(root, CONFIG_FILE);
  await fs.writeFile(file, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  return file;
}
