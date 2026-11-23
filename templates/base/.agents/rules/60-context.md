# Context

## Find before reading

1. Start at `AGENTS.md`, then the rule or skill that matches the task.
2. Use search to locate the symbol, not to read the repo.
3. Read the smallest window that answers the question.
4. Read tests next to the code. They show the intended behavior.
5. Stop when the question is answered.

## Do not

- Read every file in a directory to "get context".
- Open a lockfile, a build artifact, `node_modules`, or a minified bundle.
- Read a whole large file for one function.
- Assume a path from memory. Check it.
- Load a skill you do not need.

## Project map

| Need | Look at |
|---|---|
| Entry point | `{{paths.source}}`, package manifest |
| Behavior | the handler and its test |
| Config | `.env.example`, config module |
| Work already planned | `docs/specs/`, `docs/plans/` |
| Decision history | `docs/adr/` |
| Current session state | `.agents/memory/state.md` |

## Ambiguity

If two files disagree, the test and the runtime behavior win. Say which source you trusted.

If a name appears in three unrelated places, ask which one before editing.

## Budget

The always-on rules cost about 2,000 tokens. Detail is loaded on demand. If a task needs more, open the specific skill, not every rule.
