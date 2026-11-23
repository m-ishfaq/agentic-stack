---
name: tdd
description: Implement a behavior test first, then the smallest code that passes. Use for any change that alters observable behavior.
---

# TDD

## Loop

1. Write one failing test for the next acceptance criterion.
2. Run the configured testSafe command. Confirm it fails for the expected reason.
3. Write the smallest code that passes.
4. Run the configured testSafe command. Confirm green.
5. Refactor with the test green.
6. Repeat for the next criterion.

## Test shape

```text
Given <state>
When <action>
Then <observable result>
```

Use the project's existing test framework and helpers. Do not add a second one.

## Rules

- One behavior per test.
- The failure message must be readable.
- No implementation detail asserted unless it is the contract.
- A bug fix starts with a test that reproduces the bug.
- Never change an assertion to make it pass without saying why.
- If the test needs a database, use the disposable one through the configured testSafe command.

## Stop when

- Every acceptance criterion has a test.
- The full suite passes.
- A new test fails if the production change is reverted.
