# Monorepo

## Boundaries

- A package imports another package by its public name, never by a relative path into its source.
- A shared package has an explicit public API.
- No circular dependency between packages.
- The app layer does not import from another app.

## Changes

- Touch the smallest set of packages.
- A shared change needs a test in each consumer that matters.
- Run the affected tests, then the full suite before reporting.

## Commands

Use the workspace tool already configured. Do not add a second task runner.

- Install once at the root.
- Run a task with the workspace filter the project uses.
- Do not edit another package's lockfile.

## Dependencies

- A new dependency goes in the package that uses it, not the root, unless every package uses it.
- Version alignment across packages follows the existing policy.

## Checklist

- [ ] No relative import across packages
- [ ] No cycle added
- [ ] Affected tests run
- [ ] Dependency in the right package
