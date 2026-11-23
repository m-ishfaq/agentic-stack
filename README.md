# agentic-stack

[![npm](https://img.shields.io/npm/v/agentic-stack.svg)](https://www.npmjs.com/package/agentic-stack)
[![ci](https://github.com/m-ishfaq/agentic-stack/actions/workflows/ci.yml/badge.svg)](https://github.com/m-ishfaq/agentic-stack/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/agentic-stack.svg)](LICENSE)

One command gives any project a safe, consistent AI coding setup: rules, skills, hooks, policies, and tool adapters.

<img src="docs/demo.gif" alt="Terminal demo: install agentic-stack, npm test is blocked, npm run test:safe passes" width="880">

```bash
npx agentic-stack@latest init
```

Node 20 or newer. No global install. No telemetry.

Works with Claude Code, Cursor, Copilot, Codex, Gemini, Devin, and Aider.

## Why

AI agents are fast, but they are not careful by default. They commit, push, read `.env`, run migrations, and reach outside the project.

Prompt files alone do not stop that. `agentic-stack` adds enforcement, so safety does not depend on the model remembering a rule.

The agent can still do normal work. It cannot do the things that lose data or leak secrets.

## Quick start

```bash
# inside your project
npx agentic-stack@latest init

# non-interactive
npx agentic-stack@latest init --yes

# pick adapters and a stack pack
npx agentic-stack@latest init --adapters claude,cursor --packs typescript

# see the plan first
npx agentic-stack@latest init --dry-run
```

Then commit the setup:

```bash
git add .agents AGENTS.md agentic.config.json .agentic .claude .cursor .github
git commit -m "chore: add agentic-stack"
```

The agent never commits or pushes. You keep git.

## What lands in your project

```text
AGENTS.md                  short always-on router
.agents/
  rules/                   response, workflow, quality, testing, git, security, docs, context, data
  skills/<name>/SKILL.md   procedures, loaded only when needed
  commands/                /spec /plan /build /review /test /fix /ship /handoff
  hooks/                   portable Node scripts, no bash-only code
  policies/deny.json       deny, ask, scope, and test database rules
  scripts/test-safe.mjs    test runner that refuses dev and prod databases
  templates/               spec, plan, ADR, PR, bug, handoff
  memory/                  decisions and current task state
agentic.config.json        adapters, packs, budgets
.agentic/lock.json         template version and file hashes
```

`AGENTS.md` and `.agents/` are the source of truth. Tool files are generated from them and carry a "do not edit" header.

| Tool | Files |
|---|---|
| Claude Code | `CLAUDE.md`, `.claude/settings.json`, skills, commands |
| Cursor | `.cursor/rules/`, `.cursor/mcp.json` |
| GitHub Copilot | `.github/copilot-instructions.md`, `.github/instructions/` |
| Codex | `AGENTS.md`, `CLAUDE.md` |
| Gemini | `GEMINI.md` |
| Devin | `.devin/rules/` |
| Aider | `CONVENTIONS.md`, `.aider.conf.yml` |

## Safety model

Every rule exists twice: as guidance, then as enforcement.

| Layer | What it does |
|---|---|
| Rules | how the agent plans, answers, and reviews its own work |
| Hooks | block off-limits commands and paths before they run |
| Policy file | one deny, ask, and allow list, translated per tool |
| Test runner | throwaway database only, refuses dev or prod targets |
| CI | runs the same checks where hooks do not exist, plus a secret scan |
| Devcontainer | project-only access, no home secrets, no host database |

Denied at every strictness level:

- git writes: add, commit, push, tag, merge, rebase, reset, checkout, stash, branch delete
- `.env` and secret files: `.env`, `.env.*`, `*.pem`, `*.key`, `**/secrets/**`
- databases: `psql`, `mysql`, `mongosh`, `redis-cli`, `sqlite3`, and database ports
- migrations and seeds, including `prisma db push` and `npm run migrate`
- deploys and publishes: `vercel`, `flyctl`, `npm publish`, `docker push`
- destructive shell: `sudo`, `rm -rf`, `chmod 777`
- any path outside the project root

## Strictness

Set once in `agentic.config.json`. It controls what happens when the policy says "ask", such as `npm install` or edits to `package.json`.

| Level | Ask list |
|---|---|
| `strict` (default) | blocked |
| `balanced` | reported, then allowed |
| `loose` | ignored |

Hard denials above never change with the level.

## Commands

```bash
agentic init [dir]        install into a project
agentic sync [dir]        regenerate tool files after editing .agents/
agentic sync --restore    recreate generated files you deleted
agentic upgrade [dir]     take template updates without losing local edits
agentic add <pack> [dir]  add a stack pack later
agentic check [dir]       verify hashes, policy, hooks, and budgets
agentic doctor [dir]      check Node, git, config, and hook files
agentic eject [dir]       remove CLI metadata, keep every installed file
```

`init` flags: `--yes`, `--adapters`, `--packs`, `--strictness`, `--no-gitignore`, `--force`, `--dry-run`.

Exit codes: `0` ok, `2` usage, `3` collision, `4` drift or missing files, `5` budget overrun, `6` upgrade conflict.

## Stack packs

Packs add rules for one ecosystem. Install with `--packs`, or later with `agentic add`.

`typescript` `react-next` `python` `go` `php-laravel` `java` `rust` `docker` `monorepo` `mobile`

## Configuration

`agentic.config.json` holds adapters, packs, strictness, budgets, and the commands detected in your project.

```json
{
  "version": 1,
  "adapters": ["claude", "cursor", "copilot"],
  "packs": ["typescript"],
  "policy": { "strictness": "strict", "scope": "project" },
  "budgets": { "agentsMdLines": 150, "alwaysOnTokens": 4000 }
}
```

Precedence: CLI flag, config, detection, default. `init` writes the result, so later runs reuse it.

## Upgrading

```bash
npx agentic-stack@latest upgrade
```

Local edits are never overwritten. If you and the template both changed a file, the new version goes to `.agentic/conflicts/<timestamp>/` and the CLI exits `6`. Merge by hand, then run `agentic sync`.

Backups from `--force` and upgrades live in `.agentic/backups/`, which is gitignored.

## Status

Phase 3 MVP. Working today: install, seven adapters, ten packs, drift checks, guard hooks, safe test runner, upgrade with conflict files, `add`, `eject`, a devcontainer, and CI for installed projects.

Planned: a pack registry with checksums, a standalone `agentic-stack/check` GitHub Action, organization template sync, and policy presets. See `docs/06-roadmap.md`.

## The name

`create-agentic-stack` was already taken on npm, so `npm create` was not an option.

`agentic-stack` was free. It says what it is: a stack of agent rules, skills, policies, and adapters for a project. The package is `agentic-stack`, the binary is `agentic`, so the command stays short.

## Repository layout

```text
agentic-stack/
  docs/            design documents
  templates/
    base/          stack-neutral baseline
    packs/         opt-in stack rules
  packages/
    cli/           published package, binary agentic
    core/          detection, generation, adapters, merge
  evals/           agent behavior tests
```

## Development

```bash
git clone https://github.com/m-ishfaq/agentic-stack.git
cd agentic-stack
npm test
npm run eval
node packages/cli/bin/agentic.js init .tmp/demo --yes
```

`npm run demo` rebuilds `docs/demo.gif` from `scripts/demo.html`. It needs Chrome and ffmpeg.

## Design principles

- One source of truth: `.agents/` is canonical, every tool file is generated.
- Portable first: plain Markdown and Node scripts. No bash-only hooks.
- Deny by default: an unknown command is a question, not a permission.
- Small always-on context: router under 150 lines.
- No lock-in: delete the CLI and the setup still works.
- No telemetry. MIT.

## Release

1. Bump `version` in `packages/cli/package.json`.
2. Commit and push to `main`.
3. Push a matching tag.

```bash
git tag v0.1.0
git push origin v0.1.0
```

The `publish` workflow runs tests and evals, checks the tag against the package version, then publishes with provenance. Add `NPM_TOKEN` as a repository secret first.

Manual publish:

```bash
cd packages/cli
npm publish --access public
```

## Contributing

Issues and pull requests are welcome at [m-ishfaq/agentic-stack](https://github.com/m-ishfaq/agentic-stack).

Please run `npm test` and `npm run eval` before opening a pull request, and keep changes small and focused.

## Docs

| File | Contents |
|---|---|
| `docs/00-landscape.md` | research, tool support matrix, prior art |
| `docs/01-architecture.md` | layers, adapter model, generation and drift |
| `docs/02-inventory.md` | every rule, skill, command, hook, template |
| `docs/03-response-contract.md` | how the agent answers, verbatim |
| `docs/04-policy-and-test-safety.md` | deny matrix, scope, safe test database |
| `docs/05-cli-and-upgrade.md` | commands, config, lockfile, 3-way merge |
| `docs/06-roadmap.md` | phases, metrics, risks, open questions |

MIT licensed. Copyright (c) 2026 m-ishfaq.
