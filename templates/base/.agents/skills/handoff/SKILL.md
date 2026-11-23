---
name: handoff
description: Write state so the next session can continue without guessing. Use when a task is unfinished or the session is ending.
---

# Handoff

## Write to `.agents/memory/state.md`

```markdown
# State

Updated: YYYY-MM-DD HH:MM

## Goal
One sentence.

## Done
- What changed, with file paths.

## Next
1. The next concrete action.
2. The one after that.

## Decisions
- Decision and why.

## Open questions
- Question and who can answer it.

## Do not
- Things the next session might try that are wrong.
```

## Rules

- Keep it under 40 lines.
- File paths, not descriptions of file paths.
- Include the exact failing command and its error if the build is red.
- Do not paste logs or diffs.
- Append one line to `.agents/memory/decisions.md` for each durable decision.

## Next session

Read this file first, then `AGENTS.md`. Do not re-scan the repo.
