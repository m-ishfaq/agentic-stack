---
name: spec-feature
description: Turn a vague feature request into a spec with acceptance criteria before any code is written.
---

# Feature spec

## When

Use when the request spans more than one file, changes behavior, or uses words like "should" without a definition.

Skip for a typo, a copy change, or a one-line fix.

## Steps

1. Restate the request in one sentence. Ask one question only if two readings change the work.
2. Find the current behavior. Name the file and the test.
3. Write the spec to `docs/specs/YYYY-MM-DD-<slug>.md`.
4. List what is out of scope.
5. Stop. Wait for approval before planning.

## Spec format

```markdown
# <Title>

## Problem
One paragraph, plain words.

## Users and outcome
Who benefits and what changes for them.

## Acceptance criteria
- [ ] Given ..., when ..., then ...
- [ ] Given ..., when ..., then ...

## Out of scope
- ...

## Risks
- ...

## Open questions
- ...
```

## Rules

- Acceptance criteria are testable. No "works well".
- Every criterion maps to at least one test.
- No implementation detail in the spec.
- No code in this step.
