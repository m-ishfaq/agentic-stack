---
name: debug
description: Find the cause of a failure before changing code. Use when a test fails, a bug is reported, or behavior does not match the spec.
---

# Debug

## Rule

A fix without a cause is a guess. Find the cause first.

## Steps

1. Reproduce. Run the smallest command that fails. Quote the real error.
2. Locate. Find the line that produces the failing value.
3. Hypothesize. Write one sentence: "X happens because Y".
4. Test the hypothesis with one change or one log. Prefer a failing test.
5. Fix the cause, not the symptom.
6. Add a regression test that fails without the fix.
7. Run the configured testSafe command, then the related suite.

## Rules

- Change one thing at a time.
- Do not add a retry or a sleep to hide a race.
- Do not catch and ignore the error.
- Do not rewrite the module to avoid understanding it.
- Remove every debug log before finishing.
- If the cause is outside the repo, say so and stop.

## Report

```text
Cause: one line with file:line
Fix: one line
Proof: the test that now fails without the fix
```
