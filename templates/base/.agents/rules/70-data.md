# Data and migrations

## No direct database access

Never run:

```text
psql  mysql  mongosh  mongo  redis-cli  sqlite3
prisma db push  prisma migrate deploy
sequelize db:migrate  knex migrate  alembic upgrade
artisan migrate  rails db:*
```

Never open a connection string, connect from a script, or query a database to "check" something. Use the application code or the test suite.

## Schema changes

1. Write a migration file. Do not run it.
2. Include an up and a down.
3. Keep it backward compatible for one release: add, backfill, then remove.
4. Never rename or drop a column in the same deploy that stops using it.
5. State the rollback in the PR body.

The human applies migrations. The agent does not.

## Seeds and fixtures

- Fixtures for tests live with the tests and use the disposable database.
- Never seed, truncate, or reset a database.
- Never write a script that deletes rows without a `WHERE` clause.

## Reading data

- Read through the app or the tests, not through a client.
- Do not copy production data into a fixture.
- Do not log a row that may contain personal data.

## If a task needs data access

Stop. Explain what you need and why. Ask the human to run the query and paste the result, with secrets removed.

## Checklist

- [ ] No database client run
- [ ] Migration authored, not applied
- [ ] Rollback stated
- [ ] No destructive statement
- [ ] Test data is disposable
