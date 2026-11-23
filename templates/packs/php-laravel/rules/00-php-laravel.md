---
paths:
  - "app/**"
  - "routes/**"
  - "database/**"
  - "resources/**"
  - "config/**"
---

# PHP and Laravel

## Structure

- Controllers stay thin. Move logic to a service or action.
- Validation lives in a Form Request.
- Authorization lives in a policy or gate, not in the controller body.
- No query in a Blade template.

## Eloquent

- No query in a loop. Eager load with `with`.
- Select only the columns needed for a list.
- `updateOrCreate` needs a unique constraint behind it.
- Never call `truncate`, `db:wipe`, or `migrate:fresh` outside a disposable database.

## Migrations

- Author the migration. Do not run it.
- Every migration has a working `down`.
- Do not edit an applied migration.

## Security

- Escape output with `{{ }}`. Use `{!! !!}` only with trusted, sanitized HTML.
- Validate every request field.
- Do not log a request body that may contain a password or token.

## Tests

- Feature test for the route, unit test for the service.
- Use factories, not raw inserts.
- Run through the configured testSafe command with a `_test` database.

## Checklist

- [ ] Form Request validates
- [ ] Policy authorizes
- [ ] No N+1 query
- [ ] Migration authored, not run
