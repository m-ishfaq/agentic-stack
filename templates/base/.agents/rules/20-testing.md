# Testing

## The only command

```bash
node .agents/scripts/test-safe.mjs
```

The exact `testSafe` command is in `agentic.config.json`. Never run the project test command, or a test file, directly.

`testSafe` checks the database target before it runs. It refuses a non-local host, a database without a `_test` suffix, and a URL that matches the development database.

If the runner refuses, do not change the database URL to get past it. Report the refusal.

## Test discipline

- Write the failing test first when behavior changes.
- Red, green, refactor. Do not refactor while red.
- Test the public behavior, not the implementation detail.
- One behavior per test. Name the test after the behavior.
- Cover the empty, error, and boundary case when they are reachable.
- A bug fix gets a regression test that fails without the fix.

## Never

- Delete or skip a failing test to finish.
- Loosen an assertion without a stated reason.
- Add a sleep to fix flakiness.
- Hit a real network service, a payment provider, or a production API.
- Write to a database that is not disposable.
- Commit a snapshot you did not inspect.

## When a test is wrong

Say which test is wrong, why, and what it should assert. Change it only if the request includes that change.

## Checklist

- [ ] New behavior has a test
- [ ] Bug has a regression test
- [ ] `testSafe` passes
- [ ] No skipped test added
- [ ] No real external service called
