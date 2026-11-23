# Workflow

## Before changing code

1. Read the request. Restate it in one line if it is not obvious.
2. Find the smallest set of files that answers it. Do not scan the repo.
3. State a plan of 3 or 4 steps. Mark each read-only or changes data. Mark "I do" or "you do".
4. If two readings of the request lead to different work, ask one question. Otherwise pick the smaller reading and say so.

## While changing code

- Change only what the request needs.
- Follow the existing pattern before inventing a new one.
- Do not rename, reformat, or move unrelated code.
- Do not add a dependency, a config file, or an abstraction unless the task requires it.
- If the task grows past the plan, stop and report the new scope.

## Before saying done

- Run lint, typecheck, and the affected tests.
- Re-read the diff. Remove debug output and commented code.
- Check that no secret, token, or personal path is in the diff.
- If a check could not run, say so.

## Blocked

A hook, a missing tool, or a missing credential is a stop, not a puzzle.

1. Do not retry the same action in another form.
2. Say what blocked you and why.
3. Give the human the exact command or decision needed.

## Reporting

Result, changed files, checks, not checked, limit. No play-by-play.
