import fs from 'node:fs/promises';
import path from 'node:path';
import { pathExists, readJson } from './util.js';

const LOCKFILES = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['bun.lockb', 'bun'],
  ['bun.lock', 'bun'],
  ['yarn.lock', 'yarn'],
  ['package-lock.json', 'npm'],
];

export async function detectProject(root) {
  const packageJsonPath = path.join(root, 'package.json');
  const packageJson = (await pathExists(packageJsonPath)) ? await readJson(packageJsonPath) : null;
  const scripts = packageJson?.scripts ?? {};
  const deps = { ...(packageJson?.dependencies ?? {}), ...(packageJson?.devDependencies ?? {}) };

  let packageManager = 'npm';
  for (const [file, manager] of LOCKFILES) {
    if (await pathExists(path.join(root, file))) {
      packageManager = manager;
      break;
    }
  }

  const packs = [];
  const markers = {
    typescript: ['tsconfig.json'],
    'react-next': ['next.config.js', 'next.config.mjs', 'next.config.ts'],
    python: ['pyproject.toml', 'requirements.txt', 'uv.lock'],
    go: ['go.mod'],
    'php-laravel': ['composer.json', 'artisan'],
    java: ['pom.xml', 'build.gradle', 'build.gradle.kts'],
    rust: ['Cargo.toml'],
    docker: ['Dockerfile', 'docker-compose.yml', 'compose.yml'],
    monorepo: ['turbo.json', 'nx.json', 'pnpm-workspace.yaml', 'lerna.json'],
    mobile: ['pubspec.yaml', 'app.json'],
  };

  for (const [pack, files] of Object.entries(markers)) {
    for (const file of files) {
      if (await pathExists(path.join(root, file))) {
        if (!packs.includes(pack)) packs.push(pack);
        break;
      }
    }
  }
  if (deps.typescript && !packs.includes('typescript')) packs.push('typescript');
  if ((deps.next || deps.react) && !packs.includes('react-next')) packs.push('react-next');

  const stack = detectStack(packs);
  const run = (name) => `${packageManager} run ${name}`;
  const commands = {
    install: packageJson ? `${packageManager} install` : 'none',
    dev: scripts.dev ? run('dev') : scripts.start ? run('start') : 'none',
    test: scripts.test ? `${packageManager} test` : 'none',
    testSafe: 'node .agents/scripts/test-safe.mjs',
    lint: scripts.lint ? run('lint') : 'none',
    typecheck: scripts.typecheck ? run('typecheck') : scripts.typecheck === undefined && scripts.tsc ? run('tsc') : 'none',
    build: scripts.build ? run('build') : 'none',
  };

  return {
    name: path.basename(root),
    packageManager,
    stack,
    packs,
    commands,
    hasPackageJson: Boolean(packageJson),
    hasGit: await pathExists(path.join(root, '.git')),
    isGitRepo: await pathExists(path.join(root, '.git')),
  };
}

/**
 * Read a project file relative to root. Returns null when missing.
 */
export async function readProjectFile(root, relativePath) {
  const full = path.join(root, relativePath);
  if (!(await pathExists(full))) return null;
  return fs.readFile(full, 'utf8');
}

function detectStack(packs) {
  if (packs.includes('react-next')) return 'React / Next.js';
  if (packs.includes('typescript')) return 'TypeScript';
  if (packs.includes('python')) return 'Python';
  if (packs.includes('go')) return 'Go';
  if (packs.includes('php-laravel')) return 'PHP / Laravel';
  if (packs.includes('java')) return 'Java';
  if (packs.includes('rust')) return 'Rust';
  if (packs.includes('mobile')) return 'Mobile';
  return 'Unknown';
}
