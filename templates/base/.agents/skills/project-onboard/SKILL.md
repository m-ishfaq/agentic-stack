---
name: project-onboard
description: Build a short map of an unfamiliar repository before changing it. Use on the first session or after a large structural change.
---

# Project onboarding

Goal: know where things are without reading the whole repo.

## Steps

1. Read `AGENTS.md`, `README.md`, and the package manifest.
2. List the top two levels of source folders. Do not open every file.
3. Find the entry point. Follow one request from route to handler to data.
4. Read one test per layer. Note the naming and assertion style.
5. Find the test, lint, typecheck, and build commands. Confirm they exist.
6. Write the map to `docs/onboarding.md`.

## The map

```text
Purpose: one line
Entry point: path
Layers: path -> path -> path
Data: where models and migrations live
Tests: path and command
Conventions: three patterns worth copying
Risks: two things that look easy to break
```

## Rules

- Never read `.env` or a secret file.
- Do not run the app or a database.
- Do not edit source during onboarding.
- If the map takes more than 30 minutes, stop and ask what matters.
