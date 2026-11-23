---
description: Run the safe test suite and report failures
argument-hint: [path or pattern]
---

Run `node .agents/scripts/test-safe.mjs` with the project's test runner.

If a path is given, narrow the run only if the runner supports it.

Report the command, the exit code, and the first real failure. Do not edit code.
