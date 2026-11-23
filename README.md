# agentic-stack

[![npm](https://img.shields.io/npm/v/agentic-stack.svg)](https://www.npmjs.com/package/agentic-stack)
[![ci](https://github.com/m-1shfaq/agentic-stack/actions/workflows/ci.yml/badge.svg)](https://github.com/m-1shfaq/agentic-stack/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/agentic-stack.svg)](LICENSE)

One repo plus one npm package that installs a complete AI coding setup into any project with one command. Any language, any stack.

The setup is not a prompt collection. It is a contract: how the agent answers, what it may read, what it may change, where it may work, and how it proves the change is safe.

## Status

Phase 3 MVP. The CLI installs a working setup, generates seven adapters, checks drift, blocks unsafe actions, runs tests against a disposable database, upgrades without overwriting local edits, and adds or removes packs after install.

Repo: [github.com/m-1shfaq/agentic-stack](https://github.com/m-1shfaq/agentic-stack). Package: [agentic-stack](https://www.npmjs.com/package/agentic-stack) on npm, MIT, no telemetry.

Not built yet: the pack registry, the standalone GitHub Action, and organization-level template sync. See `docs/06-roadmap.md`.

## Shape

| Part | Role |
|---|---|
| GitHub repo [m-1shfaq/agentic-stack](https://github.com/m-1shfaq/agentic-stack) | source, docs, packs, template, contributions |
| npm package [agentic-stack](https://www.npmjs.com/package/agentic-stack) | install, sync, check, upgrade. Binary: `agentic` |
| `.agentic/lock.json` | template version and file hashes, used for safe upgrades |

```bash
npx agentic-stack@latest init
```

From this repo:

```bash
node packages/cli/bin/agentic.js init . --yes
```

`create-agentic-stack` is already taken on npm, so the primary path is the `agentic` binary. Do not build the UX around `npm create`.

## What lands in a project

```text
AGENTS.md                        short router, always loaded
.agents/
  rules/                         response, workflow, quality, testing, git, security, docs, context, data
  skills/<name>/SKILL.md         procedures, loaded only when needed
  commands/                      /init /spec /plan /build /review /test /fix /ship /handoff /sync
  agents/                        subagent definitions
  hooks/                         portable Node scripts, no bash-only code
  policies/                      allow, deny, ask, scope, test database rules
  mcp.json                       one server list
  templates/                     spec, plan, ADR, PR, bug, handoff
  memory/                        decisions and current task state
agentic.config.json              adapters, packs, budgets
```

Generated adapters are committed with a "do not edit" header:

```text
CLAUDE.md  .claude/  .cursor/rules/  .github/copilot-instructions.md
.github/instructions/  GEMINI.md  .devin/rules/  CONVENTIONS.md
.mcp.json  .cursor/mcp.json  .vscode/mcp.json  .codex/config.toml
```

## Safety model

Every rule exists twice: as guidance, then as enforcement.

| Layer | Enforces |
|---|---|
| `AGENTS.md` + rules | how the agent plans, answers, and reviews its own work |
| Hooks | blocks off-limits commands and paths before they run |
| Policy file | deny, ask, and allow lists in one place, translated per tool |
| Test runner | forces a throwaway database, refuses dev or prod targets |
| CI | runs the same checks where hooks do not exist, plus secret scan |
| Sandbox | project-only file access, no home secrets, no host database |

The agent never commits, never pushes, never touches `.env`, never talks to a database directly, and never works outside the project it was installed in.

## Response contract

The agent answers in the user's chosen chat language and writes every repo file in English. It answers first, keeps lines short, uses bullets or tables, leaves spacing, avoids em-dashes, and gives deep detail only when asked. It does not claim a check passed unless it ran.

Full text: `docs/03-response-contract.md`.

## Repository layout

```text
agentic-stack/
  docs/            design documents
  templates/       files copied into target projects
    base/          stack-neutral baseline
    packs/         opt-in stack rules: typescript, react, python, go, php, java, rust, docker, monorepo, mobile
  packages/
    cli/           published package, binary agentic
    core/          generation engine, adapters, merge
  registry/        pack catalog and version metadata
  evals/           agent behavior tests
  examples/        generated sample projects
```

## Design principles

- One source of truth: `.agents/` is canonical, every tool file is generated.
- Portable first: plain Markdown and Node scripts. No bash-only hooks.
- Deny by default: an unknown command is a question, not a permission.
- Small always-on context: router under 150 lines, total budget about 2k tokens.
- No lock-in: delete the CLI and the setup still works.
- No telemetry.
- MIT.

## Release

1. Bump `version` in `packages/cli/package.json`.
2. Commit and push to `main`.
3. Push a matching tag.

```bash
git tag v0.1.0
git push origin v0.1.0
```

The `publish` workflow runs tests and evals, checks the tag against the package version, then publishes with provenance and public access. Add your npm token as the `NPM_TOKEN` repository secret first.

Manual publish from a machine that is logged in:

```bash
cd packages/cli
npm publish --access public
```

## Contributing

Issues and pull requests are welcome at [m-1shfaq/agentic-stack](https://github.com/m-1shfaq/agentic-stack). Run `npm test` and `npm run eval` before opening a pull request.

## Docs

| File | Contents |
|---|---|
| `docs/00-landscape.md` | research, tool support matrix, prior art, the gap |
| `docs/01-architecture.md` | layers, adapter model, generation and drift |
| `docs/02-inventory.md` | every rule, skill, command, hook, template |
| `docs/03-response-contract.md` | how the agent answers, verbatim |
| `docs/04-policy-and-test-safety.md` | deny matrix, scope, safe test database |
| `docs/05-cli-and-upgrade.md` | commands, config, lockfile, 3-way merge |
| `docs/06-roadmap.md` | phases, metrics, risks, open questions |
