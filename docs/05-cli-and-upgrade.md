# 05. CLI and upgrade

## Package decision

Both, in one repository.

| Part | Why |
|---|---|
| Public GitHub repo | discoverable, forkable, template button, offline install via `degit` |
| npm package `agentic-stack` | one command, versioned, upgradeable, works in CI |

A template with no CLI has no upgrade path. A CLI with no repo has no community, no packs, and no review surface.

Do not depend on `npm create agentic-stack`. That name is taken. Use `npx agentic-stack@latest init`.

## Install

```bash
# new project
npx agentic-stack@latest init my-app

# current project, interactive
npx agentic-stack@latest init

# current project, non-interactive
npx agentic-stack@latest init --yes --adapters claude,cursor,copilot --packs typescript,react
```

Requirements: Node 20 or newer. No global install. No network after the package is fetched. No telemetry.

## Commands

| Command | Reads | Writes | Exit |
|---|---|---|---|
| `init [dir]` | repo detection | source, adapters, config, lock, optional CI/devcontainer | 0, 5 on budget |
| `sync` | config, source, lock | adapters, managed AGENTS.md block, merged settings | 0, 4 on drift or missing |
| `check` | everything | nothing | 1 on drift or invalid policy |
| `upgrade` | bundled templates, lock | 3-way merge result | 6 on conflict |
| `add <pack>` | bundled packs | pack files, config | 1 if unknown |
| `doctor` | environment | nothing | 1 on failed check |
| `eject` | lock | removes `.agentic/` metadata | 0 |
| `init --dry-run` | detection | nothing, prints plan | 0 |

### `init` flags

```text
--yes                 accept detected defaults
--adapters <list>     claude, cursor, copilot, codex, gemini, cline, devin, aider
--packs <list>        stack packs
--strictness <level>  strict, balanced, loose (default strict)
--ci                  add .github/workflows/agentic.yml
--devcontainer        add .devcontainer/devcontainer.json
--no-gitignore        do not edit .gitignore
--force               overwrite, after backing up
--dry-run             print the plan and stop
```

`init` works in a non-empty repository. Existing files are merged when a safe strategy exists (managed block, import line, JSON key union) and reported as skipped otherwise. It never replaces a file just because it already exists.

`sync` rewrites generated adapter files, refreshes the managed block in `AGENTS.md`, and re-applies merges. It never touches `.agents/project.md`.

### `sync` flags

```text
--restore             recreate generated files deleted by hand
--dry-run             print what would change and stop
```

### Strictness

| Level | Denied actions | Ask list |
|---|---|---|
| `strict` | blocked | blocked |
| `balanced` | blocked | reported, allowed |
| `loose` | blocked | ignored |

The ask list covers package installs, removals, Docker, migrations, and edits to manifests and workflows. Git writes, secrets, databases, deploys, and paths outside the project are denied at every level.

### `check` output

```text
agentic check

  policy            ok
  scope             ok
  lock              v1.2.0
  generated         14 files
  drift             2

  M  .cursor/rules/20-testing.mdc
  ?? .claude/skills/tdd/SKILL.md

  2 problems. Run agentic sync, or revert the generated files.
```

Machine-readable with `--json`.

## Config

`agentic.config.json`, schema-validated. Unknown keys fail. See `01-architecture.md` for the shape.

Precedence: CLI flag, then config, then detection, then default. With no flag, adapters come from folders already in the repo. If there are none, `adapters` stays empty and the neutral core still installs. During `init` the resolved choice is written to `agentic.config.json`, so later runs reuse it. `sync` fills missing commands from detection but never overwrites a command you set. `add` updates only packs.

## Lockfile

`.agentic/lock.json`, committed.

```json
{
  "lockVersion": 1,
  "templateVersion": "1.2.0",
  "cliVersion": "1.2.0",
  "generatedAt": "2026-11-23T10:00:00Z",
  "packs": { "typescript": "1.1.0" },
  "adapters": ["claude", "cursor"],
  "files": {
    "AGENTS.md": { "sha256": "...", "source": "base/AGENTS.md", "generated": true },
    ".agents/rules/05-response.md": { "sha256": "...", "source": "base/.agents/rules/05-response.md", "generated": false },
    ".claude/settings.json": { "sha256": "...", "source": "claude/settings.json", "generated": true }
  }
}
```

`generated: false` marks source files owned by the user. The CLI never overwrites them silently.

## Drift rules

A file is drifted when its current hash differs from the lock hash.

| File kind | Drift behavior |
|---|---|
| generated, unchanged | safe to rewrite |
| generated, edited by human | skip, report. `--force` backs up first |
| source, edited by human | never rewrite. This is the expected case |
| source, unchanged, template newer | upgrade candidate |
| file deleted by human | report, do not recreate unless `sync --restore` |
| file missing, never written | report as incomplete install |

## Upgrade

```bash
npx agentic-stack@latest upgrade
```

Three inputs per file:

```text
ours    the file on disk now
locked  the hash recorded at install or the last sync
theirs  the content in the new template
```

The lock stores hashes, not content. That is enough to classify every file safely:

1. No file on disk: write theirs, record as added.
2. Ours equals theirs: nothing to do.
3. Ours still matches the lock: the template changed and the file was untouched, so take theirs.
4. Theirs still matches the lock: the template did not change, so keep ours. This is a local edit.
5. Ours and theirs both differ from the lock: conflict. Write theirs to `.agentic/conflicts/<timestamp>/<path>.new`, leave ours untouched, and exit 6.

Never overwrite a local edit. Never delete a file removed from the template; report it instead.

`upgrade --dry-run` prints the plan and touches nothing. Never auto-commit or auto-push.

```text
agentic upgrade

Added 1:
  .agents/skills/handoff/SKILL.md
Updated 3:
  .cursor/rules/20-testing.mdc
Kept 2 local edits.
1 conflict, nothing overwritten:
  .claude/settings.json

New versions are in .agentic/conflicts/2026-11-23T10-00-00Z
Review them, merge by hand, then run agentic sync.
```

## Backups

Before any overwrite:

```text
.agentic/backups/2026-11-23T10-00-00Z/
```

Backups are gitignored. `doctor` reports their size and `eject` offers to remove them.

## Doctor

Checks:

- Node version
- git present
- config parses
- policy parses
- lock present, guard hook present, test runner present

`check` is the deeper pass. It verifies every locked file hash, the `AGENTS.md` budget, the `.env` ignore rule, the guard wiring in `.claude/settings.json`, the opt-in verify hook, and that each configured pack has rules installed.

## Eject

```bash
npx agentic-stack eject
```

Removes `.agentic/`, `agentic.config.json`, and the CLI dependency if present. Keeps every generated file and every source rule. The setup keeps working. Only upgrade and check stop working.

## Distribution

- Published with npm provenance.
- `scripts/build-package.mjs` copies `packages/core/src` into `packages/cli/lib/core` and `templates/` into `packages/cli/templates` before packing.
- No postinstall scripts. That is a supply chain rule.
- Dependencies kept small: Node built-ins, one prompt library, one color library, one YAML parser if needed.
- Package `files` includes `templates/` with dotfiles. Test with `npm pack` in CI.
- Windows, macOS, and Linux tested on Node 20 and 22.

## Error codes

| Code | Meaning |
|---|---|
| 1 | general failure |
| 2 | usage error |
| 3 | unused since 0.2.0, previously collision |
| 4 | drift, run `sync` |
| 5 | policy invalid |
| 6 | conflict, resolve manually |
| 7 | unsupported environment |
