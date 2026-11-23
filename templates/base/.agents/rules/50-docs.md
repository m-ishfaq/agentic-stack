# Documentation

## When behavior changes

Update the nearest document that describes it:

| Change | Update |
|---|---|
| Public command or API | `README.md` |
| Setup, env var, or workflow | `AGENTS.md` |
| Architecture decision | `docs/adr/` |
| User-visible feature | the feature doc in `docs/` |

Do not update three files when one is the source of truth. Link instead of copying.

## How to write

- Short sentences. One idea per paragraph.
- Commands in code blocks, runnable as written.
- A table for options. Prose for reasons.
- No marketing adjectives.
- English only.

## Comments

Comments explain why. They do not narrate the code, and they do not restate the function name.

Delete a comment that is now false. A stale comment is worse than none.

## ADR

An architecture decision gets one page:

```text
Title, date, status
Context: what forced a choice
Decision: what was chosen
Alternatives: what was rejected and why
Consequences: what gets easier, what gets harder
```

## Checklist

- [ ] Behavior change is documented once
- [ ] Commands are copy-paste correct
- [ ] No stale comment left behind
- [ ] English only
