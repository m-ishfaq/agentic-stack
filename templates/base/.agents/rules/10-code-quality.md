# Code quality

## Match the codebase

Read one nearby file before writing a new one. Match its naming, imports, error style, and test layout.

The project's conventions win over your preference. If the project is inconsistent, follow the majority and do not start a cleanup.

## Keep the diff small

- One purpose per change.
- No drive-by rename, reformat, or dependency bump.
- No new abstraction for a single use.
- No commented-out code.
- Delete code only when the task requires it.

## Errors

- Handle the error where you can act on it.
- Never swallow an error to make a test pass.
- Do not catch and rethrow the same error without adding context.
- User-facing messages say what happened and what to do.

## Types and contracts

- No `any`, no unchecked cast, no non-null assertion unless the surrounding code does it.
- Validate external input at the boundary. Trust internal types.
- Return the narrowest type that is true.

## Dependencies

A new dependency needs approval. Before asking, check:

- Is it already in the lockfile?
- Does the standard library cover it?
- Is it maintained and licensed for this project?

## Comments

Explain why, not what. If the code needs a comment to say what it does, rename things first.

## Checklist

- [ ] Diff has one purpose
- [ ] Nearby patterns followed
- [ ] No new warning
- [ ] No dead code or debug output
- [ ] No unapproved dependency
