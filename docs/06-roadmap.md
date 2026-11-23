# 06. Roadmap

## Phase 0: ground work

Done in this repo.

- landscape and tool matrix
- architecture and adapter contract
- full inventory
- response contract
- policy and safe test design
- CLI and upgrade design
- base `AGENTS.md` and deny policy drafts

Exit: the documents are consistent and implementation can start without design decisions.

## Built now

Runnable in this repository:

- zero-dependency core: detection, config, render, lock, policy, packs, adapters, upgrade
- CLI: `init`, `init --dry-run`, `sync`, `upgrade`, `check`, `doctor`
- adapters: `AGENTS.md`, `CLAUDE.md`, Claude settings, skills and commands, Cursor rules and MCP, Copilot instructions, Gemini, Devin, Aider, Codex via `AGENTS.md`
- nine rules, eight skills, ten commands, ten stack packs, three document templates
- guard hook, safe test runner, project-only devcontainer
- CI drift check and secret scan for installed projects
- publishable tarball with bundled core and templates, verified with `npm pack`
- thirteen tests covering scope, globs, policy, install, all adapters, packs, upgrade, guard, strictness, sync restore, check, and the test runner

Phase 3 additions:

- all ten stack packs: TypeScript, React and Next.js, Python, Go, PHP and Laravel, Java, Rust, Docker, monorepo, mobile
- format, session-context, and opt-in verify hooks, wired into Claude settings
- `add <pack>` and `eject`
- runnable eval suite: 9 contract, safety, and install checks
- cross-platform CI on Ubuntu, Windows, and macOS across Node 20 and 22

Remaining for Phase 3: the pack registry with checksums, the standalone `agentic-stack/check` GitHub Action, organization template sync, and policy presets.

## Phase 1: first safe install

Goal: one command gives a working, safe setup in a JavaScript or TypeScript repo.

Scope:

- `packages/core`: config, detection, render, lock
- adapters: `agents-md`, `claude`, `cursor`, `copilot`
- rules: workflow, response, code quality, testing, git, security, context, data
- policy: deny, ask, scope, test database
- hooks: guard-commands, guard-scope, guard-env, guard-db, test-isolation, protect-paths, secret-scan, format-on-edit
- `test:safe` runner for Node
- CLI: `init`, `sync`, `check`, `doctor`
- CI workflow, devcontainer
- 3 templates: SPEC, PLAN, PR
- tests: adapter fixtures, policy parser, scope resolver, merge unit tests

Exit criteria:

- `npx agentic-stack init` works on Windows, macOS, Linux
- blocked commands are blocked in Claude Code and reported in Cursor and Copilot
- `test:safe` refuses a dev database and a non-test name
- `check` fails on drift
- a sample app installs and passes lint, typecheck, tests
- no file outside the project can be written by any hook path

## Phase 2: complete the matrix

- adapters: codex, gemini, devin, aider
- skills: the five P0 plus review, debug, refactor, handoff
- commands: all ten
- hooks: verify-on-stop, session-context, rehydrate, audit-log
- packs: typescript, react-next, python
- `upgrade` with 3-way merge and conflict files
- `add`, `eject`
- documentation site generated from `docs/`
- 10 example repos, one per supported ecosystem

Exit: five agents supported, three ecosystems, upgrade safe on a repo with local edits.

## Phase 3: trust and scale

- remaining packs: go, php-laravel, java, rust, docker, monorepo, mobile
- eval harness with 50 response and safety fixtures
- registry with signed pack checksums
- GitHub Action `agentic-stack/check@v1`
- template sync bot for organizations
- policy presets: startup, regulated, open source
- telemetry: none, ever. Adoption measured by npm downloads and opt-in survey only

## Success metrics

| Metric | Target |
|---|---|
| Install success across OS matrix | 98% |
| Time from install to first blocked unsafe command | under 1 minute |
| Drift incidents in CI | 0 unresolved |
| False block rate on normal development | under 5% |
| Always-on context size | under 2,000 tokens |
| Test runs that touch a non-test database | 0 |
| Upgrade without losing local edits | 100% |
| Response eval pass rate | 90% |

## Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Tool formats change | adapters break | fixture tests per adapter, version matrix in CI |
| Hooks can be bypassed | false confidence | CI runs the same checks, devcontainer, least-privilege DB user |
| Context bloat | agent ignores rules | hard budgets, `check` enforces them, details live in skills |
| Windows gaps | broken hooks | Node-only scripts, CI on Windows |
| Supply chain | malicious release | no postinstall, provenance, pinned deps, small dependency tree |
| Policy false positives | developers disable it | `doctor` explains each block, allowlist per project |
| Maintenance load | packs go stale | community packs with owners, versioned separately |
| Name conflict | confusion | npm check done, secure the GitHub org and domain early |

## Open questions

1. Publish one package or split `agentic-stack` and `@agentic-stack/core`? Recommendation: one public package, internal core bundled.
2. Depend on `rulesync` for adapters, or keep our own? Recommendation: own adapters for the first five tools. Revisit past ten.
3. Ship a devcontainer by default, or only on request? Recommendation: default for new projects, prompt for existing ones.
4. How strict is `strictness: strict` for file deletion? Recommendation: deny deletes, allow moves inside the project after confirmation.
5. Do we support monorepos with nested `AGENTS.md` in Phase 2 or 3? Recommendation: Phase 3, with explicit per-package config.
6. Who owns the pack registry? Recommendation: repo maintainers for v1, community owners after the schema stabilizes.

## Definition of done for v1

A developer in any of the five supported agents can install once, get a repo that refuses unsafe actions, run tests without risking their database, and upgrade a year later without losing their edits.
