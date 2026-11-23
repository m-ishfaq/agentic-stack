import fs from 'node:fs/promises';
import path from 'node:path';
import { pathExists, readJson } from './util.js';

const LOCKFILES = [
  ['pnpm-lock.yaml', 'pnpm'],
  ['bun.lockb', 'bun'],
  ['bun.lock', 'bun'],
  ['yarn.lock', 'yarn'],
  ['package-lock.json', 'npm'],
  ['composer.lock', 'composer'],
  ['poetry.lock', 'poetry'],
  ['uv.lock', 'uv'],
  ['Cargo.lock', 'cargo'],
  ['go.sum', 'go'],
];

// Existing tool configuration tells us which adapters this repo already uses.
const ADAPTER_MARKERS = {
  claude: ['.claude', 'CLAUDE.md'],
  cursor: ['.cursor', '.cursorrules'],
  copilot: ['.github/copilot-instructions.md', '.github/instructions'],
  codex: ['.codex'],
  gemini: ['.gemini', 'GEMINI.md'],
  cline: ['.clinerules', '.cline'],
  devin: ['.devin', '.windsurf', '.windsurfrules'],
  aider: ['.aider.conf.yml', 'CONVENTIONS.md'],
};

export async function detectProject(root) {
  const packageJsonPath = path.join(root, 'package.json');
  const composerPath = path.join(root, 'composer.json');
  const packageJson = (await pathExists(packageJsonPath)) ? await readJson(packageJsonPath) : null;
  const composer = (await pathExists(composerPath)) ? await readJson(composerPath) : null;
  const pyproject = (await pathExists(path.join(root, 'pyproject.toml')))
    ? await fs.readFile(path.join(root, 'pyproject.toml'), 'utf8')
    : '';
  const scripts = packageJson?.scripts ?? {};
  const deps = { ...(packageJson?.dependencies ?? {}), ...(packageJson?.devDependencies ?? {}) };

  let packageManager = null;
  for (const [file, manager] of LOCKFILES) {
    if (await pathExists(path.join(root, file))) {
      packageManager = manager;
      break;
    }
  }
  if (!packageManager) {
    if (packageJson) packageManager = 'npm';
    else if (composer) packageManager = 'composer';
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

  const commands = await detectCommands(root, { packageJson, composer, pyproject, packageManager });
  const adapters = await detectAdapters(root);

  return {
    name: path.basename(root),
    packageManager,
    stack: detectStack({ root, packageJson, composer, packages: packs }),
    packs,
    commands,
    adapters,
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

async function detectAdapters(root) {
  const found = [];
  for (const [adapter, markers] of Object.entries(ADAPTER_MARKERS)) {
    for (const marker of markers) {
      if (await pathExists(path.join(root, marker))) {
        found.push(adapter);
        break;
      }
    }
  }
  return found;
}

async function detectCommands(root, { packageJson, composer, pyproject, packageManager }) {
  const commands = {
    install: null,
    dev: null,
    test: null,
    testSafe: null,
    lint: null,
    typecheck: null,
    build: null,
  };

  const artisan = await pathExists(path.join(root, 'artisan'));
  const phpunit = await pathExists(path.join(root, 'phpunit.xml'));
  if (composer) {
    commands.install = 'composer install';
    const cscripts = composer.scripts ?? {};
    if (cscripts.dev) commands.dev = 'composer run dev';
    if (artisan) commands.test = 'php artisan test';
    else if (phpunit) commands.test = 'vendor/bin/phpunit';
    const devDeps = composer['require-dev'] ?? {};
    if (devDeps['laravel/pint']) commands.lint = 'vendor/bin/pint --test';
  }

  if (packageJson) {
    const scripts = packageJson.scripts ?? {};
    const pm = packageManager && packageManager !== 'composer' ? packageManager : 'npm';
    const run = (name) => `${pm} run ${name}`;
    commands.install = commands.install ?? `${pm} install`;
    if (scripts.dev && !commands.dev) commands.dev = run('dev');
    else if (scripts.start && !commands.dev) commands.dev = run('start');
    if (!commands.test && scripts.test) commands.test = `${pm} test`;
    if (scripts.lint) commands.lint = run('lint');
    if (scripts.typecheck) commands.typecheck = run('typecheck');
    else if (scripts.tsc) commands.typecheck = run('tsc');
    if (scripts.build) commands.build = run('build');
  }

  const pyMarkers = ['pyproject.toml', 'requirements.txt', 'pytest.ini', 'tox.ini'];
  const isPython = await anyExists(root, pyMarkers);
  if (isPython) {
    if (!commands.install) {
      if (await pathExists(path.join(root, 'uv.lock'))) commands.install = 'uv sync';
      else if (await pathExists(path.join(root, 'poetry.lock'))) commands.install = 'poetry install';
      else if (await pathExists(path.join(root, 'requirements.txt'))) {
        commands.install = 'pip install -r requirements.txt';
      }
    }
    commands.test = commands.test ?? 'pytest';
    if (/\[tool\.ruff|ruff-pre-commit|ruff\b/.test(pyproject)) commands.lint = commands.lint ?? 'ruff check .';
    if (/\[tool\.mypy|mypy\b/.test(pyproject)) commands.typecheck = commands.typecheck ?? 'mypy .';
  }

  if (await pathExists(path.join(root, 'go.mod'))) {
    commands.test = commands.test ?? 'go test ./...';
    commands.lint = commands.lint ?? 'go vet ./...';
    commands.build = commands.build ?? 'go build ./...';
  }

  if (await pathExists(path.join(root, 'Cargo.toml'))) {
    commands.test = commands.test ?? 'cargo test';
    commands.lint = commands.lint ?? 'cargo clippy -- -D warnings';
    commands.build = commands.build ?? 'cargo build';
  }

  if (await pathExists(path.join(root, 'mvnw'))) commands.test = commands.test ?? './mvnw test';
  else if (await pathExists(path.join(root, 'gradlew'))) commands.test = commands.test ?? './gradlew test';

  if (commands.test) commands.testSafe = 'node .agents/scripts/test-safe.mjs';

  return commands;
}

function detectStack({ root, packageJson, composer, packages }) {
  const parts = [];
  if (composer) {
    const requires = { ...(composer.require ?? {}), ...(composer['require-dev'] ?? {}) };
    parts.push(requires['laravel/framework'] ? 'Laravel (PHP)' : 'PHP');
  }
  if (packageJson) {
    const deps = { ...(packageJson.dependencies ?? {}), ...(packageJson.devDependencies ?? {}) };
    if (deps.next) parts.push('Next.js');
    else if (deps.react) parts.push('React');
    else if (deps.vue) parts.push('Vue');
    else if (deps.typescript || packages.includes('typescript')) parts.push('TypeScript');
    else parts.push('Node.js');
  }
  if (packages.includes('python')) parts.push('Python');
  if (packages.includes('go')) parts.push('Go');
  if (packages.includes('rust')) parts.push('Rust');
  if (packages.includes('java')) parts.push('Java');
  if (packages.includes('mobile')) parts.push('Mobile');
  if (parts.length === 0) return null;
  return parts.join(' + ');
}

async function anyExists(root, files) {
  for (const file of files) {
    if (await pathExists(path.join(root, file))) return true;
  }
  return false;
}
