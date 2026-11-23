---
paths:
  - "**/*.java"
  - "**/*.kt"
---

# Java

## Style

- Follow the existing formatter and checkstyle config.
- Use the project's build tool. Do not add a second one.
- Prefer constructor injection. No field injection.
- Return empty collections, not `null`.

## Types

- Avoid raw types and unchecked casts.
- Use `Optional` for a return that may be absent, not for a field.
- Prefer records for immutable data.
- Do not catch `Exception` unless you rethrow with context.

## Resources

- Use try-with-resources for every closeable.
- No blocking call on an event loop thread.
- Bound every queue and thread pool.

## Tests

- Use the existing test framework.
- One behavior per test, named after the behavior.
- No test that depends on execution order.
- Run through the configured testSafe command when a database is present.

## Checklist

- [ ] No raw type
- [ ] Resources closed
- [ ] Constructor injection
- [ ] Empty collection instead of null
