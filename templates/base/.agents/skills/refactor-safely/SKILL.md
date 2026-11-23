---
name: refactor-safely
description: Change structure without changing behavior. Use only when the task asks for a refactor or a change is blocked by structure.
---

# Refactor safely

## Preconditions

- Behavior has tests, or you add characterization tests first.
- The working tree is clean apart from the task.
- The task is a refactor, not a hiding place for a feature.

## Steps

1. Run the tests. Record the baseline.
2. Add tests for any behavior that is not covered.
3. Make one mechanical change.
4. Run the tests after each change.
5. Keep the diff reviewable. Stop and split if it grows.
6. Compare the public behavior before and after.

## Allowed

- Rename for clarity.
- Extract a function or module.
- Replace a conditional with a table.
- Move code without changing it.

## Not allowed without a separate task

- Changing an API contract.
- Changing a dependency.
- Changing a database schema.
- Fixing unrelated bugs found on the way.
- Reformatting files you did not otherwise touch.

## Done

- Tests are green and unchanged in meaning.
- The diff contains moves and renames, not behavior edits.
- Public interfaces are the same, or the change is documented.
