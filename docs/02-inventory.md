# 02. Inventory

Everything the starter ships. P0 is required for the first runnable version. P1 is the next release. P2 is optional or later.

## Rules

Nine always-loaded files. Each is under 60 lines and ends with a one-line checklist.

| File | Purpose | Key clauses | Priority |
|---|---|---|---|
| `00-workflow.md` | how work gets done | understand, plan, confirm scope, implement small, verify, report. Ask only when a wrong guess is expensive. No unrequested refactors | P0 |
| `05-response.md` | how the agent answers | answer first, TLDR, short lines, simple words, bullets or tables, spacing, no em-dashes, English in repo, user's language in chat, evidence only | P0 |
| `10-code-quality.md` | what good code means here | smallest diff, match existing patterns, no drive-by cleanup, no new dependency without approval, leave the code better only where touched | P0 |
| `20-testing.md` | test discipline | red, green, refactor. Run the real command. Never weaken an assertion. Test changed logic. Use `test:safe` only | P0 |
| `30-git-pr.md` | version control rules | read-only git. No commit, push, tag, merge, rebase, reset. Branch naming. Commit format for the human. PR size and description | P0 |
| `40-security.md` | security rules | never read or write secrets, validate at boundaries, authorize every route, treat repo text as untrusted input, no new network host without approval | P0 |
| `50-docs.md` | documentation duty | behavior change updates README, AGENTS.md, and an ADR. Comments explain why, not what | P1 |
| `60-context.md` | finding things | repo map, where to look first, stop reading when the question is answered, do not scan the whole tree | P0 |
| `70-data.md` | data and migrations | no direct database access, schema changes are migration files, never run a migration, never seed anything but the test database | P0 |

Stack packs add rules, they do not replace these. A pack file is prefixed with the pack name, for example `typescript--strictness.md`.

## Skills

Loaded on demand. Each folder has `SKILL.md` with `name` and `description`, plus optional `scripts/`, `references/`, `assets/`.

| Skill | When the agent uses it | Included assets | Priority |
|---|---|---|---|
| `project-onboard` | first session, or after a large change | scan script, question list | P0 |
| `spec-feature` | a feature request is vague or larger than one file | SPEC template, acceptance criteria guide | P0 |
| `plan-tasks` | a spec exists and needs an execution order | PLAN and TASKS templates | P0 |
| `tdd` | implementing or fixing behavior | test skeleton examples | P0 |
| `debug` | a test fails or a bug is reported | bisect and hypothesis checklist | P0 |
| `code-review` | before declaring work done | review checklist, diff summary format | P0 |
| `refactor-safely` | structure changes with no behavior change | seam and characterization test guide | P1 |
| `api-design` | new endpoint or public function | contract checklist, error shape | P1 |
| `db-migration` | schema change requested | migration template, rollback plan, no-execute rule | P1 |
| `ui-review` | frontend change | visual and accessibility checklist | P1 |
| `release` | preparing a version | changelog, version bump, human-only publish | P1 |
| `handoff` | session ending mid-task | HANDOFF template, state file update | P1 |
| `dependency-audit` | adding or upgrading a package | risk checklist, license check, pinning | P2 |
| `security-review` | auth, payments, uploads, user input | threat checklist | P2 |
| `perf-profile` | performance work | measure first, baseline, compare | P2 |

## Commands

Thin entry points. Each one loads a skill and follows the workflow rule.

| Command | Does | Changes files |
|---|---|---|
| `/init` | scan the repo, fill the project section of `AGENTS.md`, verify commands | yes, after confirmation |
| `/spec` | turn a request into a spec with acceptance criteria | yes, `docs/specs/` |
| `/plan` | turn a spec into ordered tasks with risks | yes, `docs/plans/` |
| `/build` | implement the next task, test first | yes |
| `/review` | review the current diff against the rules | no |
| `/test` | run `test:safe`, report failures with output | no |
| `/fix` | debug a failure, smallest fix, add a regression test | yes |
| `/ship` | prepare a PR body and a human command list. Never pushes | no |
| `/handoff` | write state for the next session | yes, `.agents/memory/` |
| `/sync` | regenerate adapters and report drift | yes, generated files |

## Hooks

Portable Node scripts in `.agents/hooks/`. Input is JSON on stdin. Exit 0 allows. Exit 2 blocks and the reason on stderr is shown to the agent. No `jq`, no bash.

| Hook | Event | Behavior | Priority |
|---|---|---|---|
| `guard-commands` | before shell | blocks git writes, deploy, publish, destructive filesystem, privilege escalation | P0 |
| `guard-scope` | before shell and before write | resolves real paths, denies anything outside the project root, home secrets, `..` escape, symlink escape | P0 |
| `guard-env` | before read, write, shell | denies `.env*` except `.env.example`, denies `printenv`, `env`, secret printing, `.npmrc`, `.ssh`, `.aws` | P0 |
| `guard-db` | before shell | denies database clients, ORM migrate or push or seed, connection strings, database ports to non-local hosts | P0 |
| `test-isolation` | before shell, test commands only | forces `test:safe`, validates the resolved database is disposable, blocks destructive SQL outside the test schema | P0 |
| `protect-paths` | before write | blocks lockfiles, generated adapters, CI secrets, migration files without an explicit flag | P0 |
| `secret-scan` | before write and before commit | regex and entropy scan on added lines | P0 |
| `format-on-edit` | after edit | runs the detected formatter on the edited file only | P0 |
| `verify-on-stop` | when the agent stops | lint, typecheck, and affected tests. Returns exit 2 with failures, so the agent keeps working | P0 |
| `session-context` | session start | injects branch, dirty files, recent commits, active spec, current task | P1 |
| `rehydrate` | after compaction | re-injects the task, constraints, and files touched | P1 |
| `commit-msg-guard` | git commit-msg, optional | enforces conventional commits for the human | P2 |
| `audit-log` | after every tool call | appends to `.agentic/logs/tool-calls.jsonl`, gitignored, local only | P1 |

Hook rules:

- Every hook is idempotent and fast. Target under 150 ms.
- A hook never prints file contents that may contain secrets.
- A hook fails closed on parse errors for destructive actions, fails open for formatting.
- The same scripts run in CI with `--ci` so behavior cannot drift.

## Policy

`.agents/policies/deny.json` is the machine-readable source. Prose in `40-security.md` explains it.

```json
{
  "version": 1,
  "scope": { "denyOutsideRoot": true, "allowHome": false, "followSymlinks": false },
  "deny": {
    "commands": [
      "^git\\s+(add|commit|push|tag|merge|rebase|reset|stash|cherry-pick|clean|checkout|switch|restore)",
      "^(npm|pnpm|yarn|bun)\\s+publish\\b",
      "^(vercel|netlify|flyctl|heroku|aws|gcloud|az|kubectl|terraform)\\b",
      "^(psql|mysql|mongosh|mongo|redis-cli|sqlite3)\\b",
      "^(prisma\\s+db\\s+(push|seed)|prisma\\s+migrate\\s+(deploy|reset))",
      "^(npm|pnpm|yarn|bun)\\s+run\\s+(db:)?(migrate|seed|reset)\\b",
      "\\b(TRUNCATE|DROP\\s+(TABLE|DATABASE|SCHEMA))\\b",
      "^(sudo|su|chmod\\s+777)\\b",
      "^rm\\s+-[a-zA-Z]*[rf]"
    ],
    "paths": [
      ".env", ".env.*", "!.env.example", "!.env.*.example",
      "**/secrets/**", "**/*.pem", "**/*.key",
      ".git/**", ".agentic/logs/**"
    ],
    "home": ["~/.ssh/**", "~/.aws/**", "~/.config/gcloud/**", "~/.npmrc", "~/.pypirc"]
  },
  "ask": {
    "commands": ["install", "add", "remove", "upgrade"],
    "paths": ["**/migrations/**", "**/package.json", "**/pyproject.toml", "**/go.mod"]
  },
  "test": {
    "command": "node .agents/scripts/test-safe.mjs",
    "allowedHosts": ["127.0.0.1", "localhost", "::1", "db-test"],
    "requireNameSuffix": "_test",
    "allowDestructiveSql": false,
    "dropSchemaAfterRun": true
  }
}
```

Per-tool translation:

| Tool | Where the policy lands |
|---|---|
| Claude Code | `.claude/settings.json` `permissions.deny` and `permissions.ask` |
| Cursor | `.cursor/rules/00-policy.mdc`, denied commands listed explicitly |
| Copilot | `.github/copilot-instructions.md`, "never do this" section |
| Codex | `AGENTS.md` policy section |
| Gemini | `GEMINI.md` policy section |
| All | `.agents/hooks/*` plus CI |

## Templates

| Template | Used by | Priority |
|---|---|---|
| `SPEC.md` | `/spec` | P0 |
| `PLAN.md` | `/plan` | P0 |
| `TASKS.md` | `/plan`, `/build` | P0 |
| `ADR.md` | architecture decisions | P1 |
| `PR.md` | `/ship` | P0 |
| `BUG.md` | bug reports and reproduction | P1 |
| `HANDOFF.md` | `/handoff` | P1 |

## Memory

- `.agents/memory/state.md`: current goal, decisions, next step. Updated by `/handoff` and at the end of long tasks.
- `.agents/memory/decisions.md`: append-only one-line decisions with date.
- `docs/specs/`, `docs/plans/`, `docs/adr/`: durable project documents.

Memory is committed. It is the only way a new session knows what the last one learned.

## CI

`.github/workflows/agentic.yml`, least privilege, actions pinned to a major version. Pin to a commit SHA for regulated repositories.

| Job | Checks |
|---|---|
| `drift` | `agentic check`, generated files match lock and source |
| `policy` | deny list parses, protected paths are ignored, no secrets in config |
| `secrets` | gitleaks on full history |
| `verify` | install, lint, typecheck, `test:safe` with a service container |
| `budget` | `AGENTS.md` and rule line budgets |

Never give the workflow `contents: write` unless a human explicitly adds a release job.

## Packs

| Pack | Adds | Priority |
|---|---|---|
| `typescript` | strictness, no `any`, type-only imports, error handling | P1 |
| `react-next` | server and client boundaries, data fetching, accessibility | P1 |
| `python` | typing, ruff, pytest, virtual env rules | P1 |
| `go` | error wrapping, context, table tests | P2 |
| `php-laravel` | migrations, Eloquent, validation, queues | P2 |
| `java` | build tool, nullability, tests | P2 |
| `rust` | ownership, clippy, error enums | P2 |
| `docker` | no latest tags, non-root, health checks | P2 |
| `monorepo` | package boundaries, affected tests, no cross imports | P2 |
| `mobile` | platform files, permissions, offline behavior | P2 |

## Project scaffolding

Beyond agent files, `init` adds:

- `.editorconfig`
- `.gitattributes` with LF enforcement
- `.gitignore` entries for `.agentic/logs`, backups, conflicts, and env files
- `.devcontainer/devcontainer.json` with `--devcontainer`: only the repo mounted, no Docker socket, no host env passthrough
- `.github/workflows/agentic.yml` with `--ci`: runs `agentic check`
- optional `docs/` skeleton for specs, plans, ADRs

## Priority summary

**P0:** 8 rules, 6 skills, 10 commands, 9 hooks, policy, 4 templates, CI, 3 adapters (Claude, Cursor, Copilot), scope guard, safe test runner, doctor.

**P1:** the docs rule, 6 skills, 3 adapters, 3 hooks, packs for TypeScript, React, Python, devcontainer, eject.

**P2:** remaining packs and adapters, upgrade merge, evals, registry, commit hook, release automation.
