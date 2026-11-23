---
name: code-review
description: Review a diff before declaring work done. Use after implementation and before handing the change to a human.
---

# Code review

## Order

1. Correctness. Does it do what the spec says?
2. Tests. Do they fail without the change?
3. Scope. Is anything unrelated touched?
4. Safety. Secrets, input, authorization, database access.
5. Readability. Names, control flow, error messages.
6. Performance, only where the spec cares.

## Checklist

- [ ] Every acceptance criterion has code and a test
- [ ] No secret, token, or personal path in the diff
- [ ] No debug output or commented code
- [ ] No weakened assertion or skipped test
- [ ] No new dependency without approval
- [ ] No file outside the task changed
- [ ] Errors handled, not swallowed
- [ ] Migration authored and not run
- [ ] Docs updated if behavior changed

## Output

```text
Verdict: ready, or not ready
Must fix: file:line, one line each
Should fix: one line each
Spec gaps: one line each
```

Do not comment on style the project does not enforce.
