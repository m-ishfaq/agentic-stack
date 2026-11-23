import fs from 'node:fs/promises';
import path from 'node:path';
import { deniedPath, matchesAny, pathExists, withinRoot } from './util.js';

export const POLICY_FILE = '.agents/policies/deny.json';

export async function loadPolicy(root) {
  const file = path.join(root, POLICY_FILE);
  if (!(await pathExists(file))) throw new Error(`missing policy file: ${POLICY_FILE}`);
  const policy = JSON.parse(await fs.readFile(file, 'utf8'));
  if (policy.version !== 1) throw new Error(`unsupported policy version: ${policy.version}`);
  if (!policy.deny || !Array.isArray(policy.deny.commands)) {
    throw new Error('policy.deny.commands must be an array');
  }
  return policy;
}

export function checkCommand(command, policy) {
  const matched = matchesAny(command, policy.deny?.commands ?? []);
  if (matched) return { blocked: true, reason: `matches denied pattern: ${matched}` };
  for (const port of policy.deny?.network?.ports ?? []) {
    if (new RegExp(`(^|[^0-9])${port}([^0-9]|$)`).test(command)) {
      return { blocked: true, reason: `references denied database port: ${port}` };
    }
  }
  return { blocked: false, reason: null };
}

export function checkReadPath(root, target, policy) {
  if (!withinRoot(root, target)) {
    return { blocked: true, reason: 'path is outside the project root' };
  }
  const relative = path.relative(path.resolve(root), path.resolve(target));
  const matched = deniedPath(relative, policy.deny?.paths ?? []);
  if (matched && !relative.endsWith('.example')) {
    return { blocked: true, reason: `matches protected path: ${matched}` };
  }
  return { blocked: false, reason: null };
}

export function checkWritePath(root, target, policy) {
  const base = checkReadPath(root, target, policy);
  if (base.blocked) return base;
  const relative = path.relative(path.resolve(root), path.resolve(target)).split(path.sep).join('/');
  const protectedWrite = deniedPath(relative, policy.protectedWrites ?? []);
  if (protectedWrite) {
    return { blocked: true, reason: `protected file, require human approval: ${protectedWrite}` };
  }
  return { blocked: false, reason: null };
}

export function checkHomePath(target, policy) {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  if (!home || !path.resolve(target).startsWith(path.resolve(home))) return { blocked: false };
  const relative = path.relative(home, path.resolve(target)).split(path.sep).join('/');
  for (const pattern of policy.deny?.home ?? []) {
    const cleaned = pattern.replace(/^~[\\/]/, '');
    if (deniedPath(relative, [cleaned])) {
      return { blocked: true, reason: `protected home path: ${pattern}` };
    }
  }
  return { blocked: false };
}

const CLAUDE_DENY = [
  'Bash(git commit:*)',
  'Bash(git push:*)',
  'Bash(git tag:*)',
  'Bash(git merge:*)',
  'Bash(git rebase:*)',
  'Bash(git reset:*)',
  'Bash(git stash:*)',
  'Bash(git clean:*)',
  'Bash(gh pr create:*)',
  'Bash(npm publish:*)',
  'Bash(pnpm publish)',
  'Bash(yarn publish)',
  'Bash(bun publish)',
  'Bash(psql:*)',
  'Bash(mysql:*)',
  'Bash(mongosh:*)',
  'Bash(redis-cli:*)',
  'Bash(sqlite3:*)',
  'Bash(prisma db push:*)',
  'Bash(prisma migrate deploy:*)',
  'Bash(sudo:*)',
  'Read(./.env)',
  'Read(./.env.*)',
  'Edit(./.env)',
  'Edit(./.env.*)',
  'Write(./.env)',
  'Write(./.env.*)',
];

export function claudeSettings(policy) {
  return {
    permissions: {
      deny: CLAUDE_DENY,
      ask: ['Bash(npm install:*)', 'Bash(pnpm add:*)', 'Bash(yarn add:*)', 'Bash(pip install:*)'],
    },
    hooks: {
      PreToolUse: [
        {
          matcher: 'Bash|Read|Write|Edit|MultiEdit',
          hooks: [
            {
              type: 'command',
              command: 'node "$CLAUDE_PROJECT_DIR"/.agents/hooks/guard.mjs',
            },
          ],
        },
      ],
    },
  };
}

export function policyMarkdown(policy) {
  const lines = [
    '# Policy',
    '',
    'These actions are blocked by hooks and CI.',
    '',
    '## Never run',
    '',
  ];
  for (const pattern of policy.deny?.commands ?? []) {
    lines.push(`- \`${pattern}\``);
  }
  lines.push('');
  lines.push('## Never read or write');
  lines.push('');
  for (const pattern of policy.deny?.paths ?? []) {
    lines.push(`- \`${pattern}\``);
  }
  lines.push('');
  lines.push('## Tests');
  lines.push('');
  lines.push('Run tests only with the `test:safe` command. It refuses a non-test database.');
  lines.push('');
  return lines.join('\n');
}
