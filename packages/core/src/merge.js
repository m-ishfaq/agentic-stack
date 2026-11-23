import path from 'node:path';

const BEGIN = '<!-- agentic-stack:begin -->';
const END = '<!-- agentic-stack:end -->';
const TOML_BEGIN = '# agentic-stack:begin';
const TOML_END = '# agentic-stack:end';

/**
 * Files we can merge into an existing project instead of replacing.
 * Anything else that already exists is skipped and reported.
 */
export function mergeTarget(relativePath, existing, generated) {
  const posix = relativePath.split(path.sep).join('/');
  if (posix === 'AGENTS.md') return mergeManagedBlock(existing, generated, BEGIN, END);
  if (posix === 'CLAUDE.md') return mergeImport(existing, generated);
  if (posix === '.claude/settings.json') return mergeClaudeSettings(existing, generated);
  if (posix === '.mcp.json') return mergeMcp(existing, generated);
  if (posix === '.cursor/mcp.json') return mergeMcp(existing, generated);
  if (posix === '.gemini/settings.json') return mergeMcp(existing, generated);
  if (posix === '.codex/config.toml') {
    return mergeManagedBlock(existing, generated, TOML_BEGIN, TOML_END);
  }
  return null;
}

export function wrapNewManaged(relativePath, content) {
  const posix = relativePath.split(path.sep).join('/');
  if (posix === 'AGENTS.md') return mergeManagedBlock('', content);
  if (posix === '.codex/config.toml') return mergeManagedBlock('', content, TOML_BEGIN, TOML_END);
  return content;
}

export function mergeManagedBlock(existing, generated, begin = BEGIN, end = END) {
  const block = `${begin}\n${generated.trimEnd()}\n${end}\n`;
  const start = existing.indexOf(begin);
  const stop = existing.indexOf(end);
  if (start !== -1 && stop > start) {
    const before = existing.slice(0, start);
    const after = existing.slice(stop + end.length).replace(/^\n+/, '');
    return `${before}${block}${after ? `\n${after}` : ''}`;
  }
  const prefix = existing.trim() === '' ? '' : `${existing.trimEnd()}\n\n`;
  return `${prefix}${block}`;
}

export function mergeImport(existing, generated) {
  const importLine = generated
    .split('\n')
    .map((line) => line.trim())
    .find((line) => line.startsWith('@'));
  if (!importLine) return existing;
  const already = existing.split(/\r?\n/).some((line) => line.trim() === importLine);
  if (already) return existing;
  return `${existing.trimEnd()}\n\n${importLine}\n`;
}

export function mergeClaudeSettings(existingText, generatedText) {
  const existing = safeParse(existingText) ?? {};
  const generated = safeParse(generatedText) ?? {};
  const merged = structuredClone(existing);
  merged.permissions = merged.permissions ?? {};
  for (const key of ['deny', 'ask', 'allow']) {
    const current = merged.permissions[key] ?? [];
    const added = generated.permissions?.[key] ?? [];
    merged.permissions[key] = unique([...current, ...added]);
  }
  merged.hooks = merged.hooks ?? {};
  for (const [event, entries] of Object.entries(generated.hooks ?? {})) {
    const current = merged.hooks[event] ?? [];
    for (const entry of entries) {
      const duplicate = current.some((item) => JSON.stringify(item) === JSON.stringify(entry));
      if (!duplicate) current.push(entry);
    }
    merged.hooks[event] = current;
  }
  for (const [key, value] of Object.entries(generated)) {
    if (key === 'permissions' || key === 'hooks') continue;
    if (merged[key] === undefined) merged[key] = value;
  }
  return `${JSON.stringify(merged, null, 2)}\n`;
}

export function mergeMcp(existingText, generatedText) {
  const existing = safeParse(existingText) ?? {};
  const generated = safeParse(generatedText) ?? {};
  const merged = { ...generated, ...existing };
  merged.mcpServers = {
    ...(generated.mcpServers ?? {}),
    ...(existing.mcpServers ?? {}),
  };
  return `${JSON.stringify(merged, null, 2)}\n`;
}

export function safeParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function unique(list) {
  return [...new Set(list)];
}
