---
paths:
  - "**/*.rs"
---

# Rust

## Errors

- Libraries return a typed error. Binaries may use `anyhow`.
- No `unwrap` or `expect` on a path that can fail at runtime.
- Add context with `.context("...")` where available.
- No panic for user input.

## Ownership

- Clone only when the borrow checker forces it, and say why.
- Prefer `&str` and slices in function arguments.
- Return owned data at the public boundary.
- No `unsafe` without a safety comment.

## Async

- No blocking call inside an async task.
- Bound channels and task sets.
- Propagate cancellation.

## Tests

- Unit tests in the module, integration tests in `tests/`.
- Use `?` in tests that return `Result`.
- Run `cargo test` through the configured testSafe command when a database is involved.

## Checklist

- [ ] No unchecked unwrap
- [ ] No blocking in async
- [ ] No unsafe without a comment
- [ ] Error type is meaningful
