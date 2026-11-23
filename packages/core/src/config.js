import fs from 'node:fs/promises';
import path from 'node:path';
import { pathExists } from './util.js';

export const CONFIG_FILE = 'agentic.config.json';

export const VALID_ADAPTERS = ['claude', 'cursor', 'copilot', 'codex', 'gemini', 'devin', 'aider'];

export function defaultConfig(project) {
  return {
    version: 1,
    project: {
      name: project.name,
      stack: project.stack,
      packageManager: project.packageManager,
      commands: project.commands,
    },
    adapters: ['claude', 'cursor', 'copilot'],
    packs: project.packs ?? [],
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
  return true;
}

export async function saveConfig(root, config) {
  validateConfig(config);
  const file = path.join(root, CONFIG_FILE);
  await fs.writeFile(file, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  return file;
}
