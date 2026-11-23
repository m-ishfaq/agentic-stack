---
name: plan-tasks
description: Turn an approved spec into ordered, verifiable tasks with file targets and risks.
---

# Plan tasks

## Steps

1. Read the spec and the files it names.
2. List the tasks in dependency order.
3. For each task: files, change, test, done signal.
4. Mark the task that carries the most risk.
5. Write to `docs/plans/YYYY-MM-DD-<slug>.md`.
6. Stop for approval before `/build`.

## Task format

```markdown
## Task 1: <verb phrase>

- Files: path, path
- Change: one sentence
- Test: what proves it
- Done when: an observable result
- Risk: low, medium, high. Why.
```

## Rules

- One task produces one reviewable diff.
- Every task has a test or a stated reason it cannot have one.
- No task says "refactor everything".
- Put the migration or schema task before the code that depends on it.
- If a task needs a dependency, mark it for human approval.
- Keep the plan under ten tasks. Split the spec if it does not fit.
