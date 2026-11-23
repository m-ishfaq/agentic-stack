import fs from 'node:fs/promises';
import path from 'node:path';
import { pathExists, sha256 } from './util.js';

export const LOCK_DIR = '.agentic';
export const LOCK_FILE = '.agentic/lock.json';

export async function readLock(root) {
  const file = path.join(root, LOCK_FILE);
  if (!(await pathExists(file))) return null;
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

export async function writeLock(root, files, meta) {
  const entries = {};
  for (const file of files) {
    entries[file.path] = {
      sha256: sha256(file.content),
      source: file.source,
      generated: file.generated,
    };
  }
  const lock = {
    lockVersion: 1,
    ...meta,
    files: meta.files ?? entries,
  };
  const target = path.join(root, LOCK_FILE);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, `${JSON.stringify(lock, null, 2)}\n`, 'utf8');
  return lock;
}

export async function currentHash(root, relativePath) {
  const full = path.join(root, relativePath);
  if (!(await pathExists(full))) return null;
  const content = await fs.readFile(full, 'utf8');
  return sha256(content);
}
