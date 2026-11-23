import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export function toPosix(value) {
  return value.split(path.sep).join('/');
}

export function globToRegExp(glob) {
  let out = '^';
  let i = 0;
  while (i < glob.length) {
    const char = glob[i];
    if (char === '*') {
      const isDouble = glob[i + 1] === '*';
      if (isDouble) {
        const isSlash = glob[i + 2] === '/';
        out += isSlash ? '(?:.*/)?' : '.*';
        i += isSlash ? 3 : 2;
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

export function deniedPath(relativePath, patterns = []) {
  const normalized = toPosix(relativePath).replace(/^\.\//, '');
  const base = path.posix.basename(normalized);
  for (const pattern of patterns) {
    if (pattern.startsWith('!')) continue;
    const candidate = pattern.replace(/^\//, '');
    if (globToRegExp(candidate).test(normalized)) return pattern;
    if (!candidate.includes('/') && globToRegExp(candidate).test(base)) return pattern;
  }
  return null;
}

export function withinRoot(root, target) {
  const relative = path.relative(path.resolve(root), path.resolve(target));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export async function pathExists(target) {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

export async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

export async function writeFileEnsured(file, content) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, content, 'utf8');
}

export async function walk(dir, { ignore = new Set(['node_modules', '.git']) } = {}) {
  const found = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (ignore.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) found.push(...(await walk(full, { ignore })));
    else if (entry.isFile()) found.push(full);
  }
  return found;
}

export function lineCount(text) {
  if (!text) return 0;
  return text.replace(/\n$/, '').split('\n').length;
}

export function matchesAny(command, patterns) {
  for (const pattern of patterns) {
    try {
      if (new RegExp(pattern).test(command)) return pattern;
    } catch {
      continue;
    }
  }
  return null;
}
