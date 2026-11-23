---
paths:
  - "**/*.ts"
  - "**/*.tsx"
  - "**/*.mts"
  - "**/*.cts"
---

# TypeScript

## Types

- No `any`. Use `unknown` and narrow it.
- No `as` to silence a type error. Fix the type or validate the value.
- No non-null assertion unless the surrounding code already uses it.
- Prefer `type` for data, `interface` for an extensible contract.
- Use `import type` for type-only imports.
- Exhaustive switches use `never` in the default branch.

## Modules

- One public export per file where practical.
- No barrel file that re-exports a whole folder.
- Relative imports inside a package, package names across packages.

## Errors

- Do not throw strings.
- Keep the error class local to the layer that defines it.
- `catch` receives `unknown`. Narrow before reading a property.

## Commands

Use the scripts already in `package.json`. Do not add `tsc` flags that the config does not use.

## Strictness

Do not weaken `tsconfig.json`. If a compiler option blocks the task, report it instead of editing the config.

## Checklist

- [ ] No `any`
- [ ] No unchecked cast
- [ ] No weakened tsconfig
- [ ] Error handled, not swallowed
