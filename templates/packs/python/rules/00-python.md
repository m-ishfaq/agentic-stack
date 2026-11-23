---
paths:
  - "**/*.py"
  - "**/*.pyi"
---

# Python

## Types

- Annotate public functions and return values.
- No `Any` to silence a checker. Use a protocol or a union.
- Validate external data with the project's existing model library.

## Style

- Follow the configured formatter and linter. Do not hand-format.
- Use the project's import order.
- No mutable default argument.
- No bare `except`. Catch the exception you can handle.

## Environment

- Never install a package globally.
- Use the project's environment tool, lockfile, and Python version.
- Do not edit the lockfile by hand.

## Tests

- Use the project's test runner through the configured testSafe command.
- A fixture that touches a database points at the disposable one.
- No network in unit tests. Mock at the boundary the project already mocks.

## Paths

- Use `pathlib`.
- Do not build a path with string concatenation.
- Do not assume the current working directory.

## Checklist

- [ ] Public functions annotated
- [ ] No bare except
- [ ] No global install
- [ ] Test uses the disposable database
