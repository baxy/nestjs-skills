---
title: Test Database Guarantees Against a Real Database
impact: MEDIUM-HIGH
impactDescription: Proves constraints, indexes and migrations exist - something mocked repositories cannot
tags: testing, database, postgres, migrations, constraints
---

## Test Database Guarantees Against a Real Database

Some guarantees exist only in the database: CHECK constraints, unique and partial unique indexes, foreign keys, and where migrations actually create tables. E2E tests mock the repositories, so they cannot prove any of these; integration tests cannot reach tables that have no HTTP route yet. The database tier (`test/db/`, see `test-organize-by-tier`) covers them: it talks to a **migrated** database through the migration datasource and needs no API.

What belongs here:

- Constraints and indexes declared on entities (`@Check`, `@Index({ unique: true, where: ... })`, foreign keys).
- Migration behavior, such as tables landing in the configured schema.
- Write paths that only mean something against real SQL (bulk updates, backfills, dry runs that must write nothing).

How each case is written:

- Run every case inside a transaction that is **rolled back** in `afterEach`, so the suite leaves no rows and test order does not matter.
- Wrap every **expected rejection in a savepoint**. Postgres aborts the whole transaction after a failed statement, so without one, everything after the first expected failure errors with "current transaction is aborted".
- Run with `--runInBand`. The tier needs a migrated database, so it is not part of the `test` script; run it before a PR that touches entities, migrations or services, and treat new specs here with the same review attention as production code.

**Incorrect (constraints asserted against mocks, or leaky real-database tests):**

```typescript
// A mocked repository cannot prove the unique index exists
it('rejects a duplicate email', async () => {
  userRepository.save.mockRejectedValue(new QueryFailedError('', [], new Error('duplicate key')));
  await expect(userService.create(dto)).rejects.toThrow();
});

// Real database, but rows are committed and the second assertion never runs
it('rejects a duplicate email, then accepts it after soft delete', async () => {
  await dataSource.query(`INSERT INTO users (email, name) VALUES ('jane@example.com', 'Jane')`);
  await expect(dataSource.query(`INSERT INTO users ...`)).rejects.toThrow(/UQ_users_email_active/);
  // Inside a transaction, this would now fail with "current transaction is aborted"
  await dataSource.query(`UPDATE users SET deleted_at = now() ...`);
});
```

**Correct (rolled-back transaction per case, savepoint per expected failure):**

```typescript
// test/db/user/user-constraints.spec.ts
import { QueryRunner } from 'typeorm';
import dataSource from '../../../migrations/type-orm/config';

describe('users and orders constraints', () => {
  let runner: QueryRunner;

  const insertUser = async (email: string): Promise<string> => {
    const rows = (await runner.query(
      `INSERT INTO users (email, name) VALUES ($1, 'Jane Doe') RETURNING id`,
      [email],
    )) as { id: string }[];
    return rows[0].id;
  };

  const insertOrder = (userId: string, total: number) =>
    runner.query(`INSERT INTO orders (user_id, total, shipping_address) VALUES ($1, $2, '{}')`, [userId, total]);

  // Savepoint per probe: assert the rejection, then keep using the transaction
  const rejects = async (pattern: RegExp, run: () => Promise<unknown>): Promise<void> => {
    await runner.query('SAVEPOINT probe');
    await expect(run()).rejects.toThrow(pattern);
    await runner.query('ROLLBACK TO SAVEPOINT probe');
  };

  beforeAll(async () => {
    if (!dataSource.isInitialized) await dataSource.initialize();
  });

  afterAll(async () => {
    if (dataSource.isInitialized) await dataSource.destroy();
  });

  beforeEach(async () => {
    runner = dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
  });

  afterEach(async () => {
    await runner.rollbackTransaction();
    await runner.release();
  });

  describe('CHK_orders_total_non_negative', () => {
    it('rejects a negative total and accepts zero', async () => {
      const userId = await insertUser('jane@example.com');
      await rejects(/CHK_orders_total_non_negative/, () => insertOrder(userId, -1));
      await expect(insertOrder(userId, 0)).resolves.toBeDefined();
    });
  });

  describe('UQ_users_email_active', () => {
    it('rejects a duplicate active email, and frees it after a soft delete', async () => {
      await insertUser('jane@example.com');
      await rejects(/UQ_users_email_active/, () => insertUser('jane@example.com'));

      await runner.query(`UPDATE users SET deleted_at = now() WHERE email = 'jane@example.com'`);
      await expect(insertUser('jane@example.com')).resolves.toBeDefined();
    });
  });
});
```

Running this tier in CI needs a throwaway database (for example a Postgres service container) migrated before the run; without that it only runs where developers run it.

Reference: [PostgreSQL SAVEPOINT](https://www.postgresql.org/docs/current/sql-savepoint.html) · [TypeORM QueryRunner](https://typeorm.io/docs/query-runner)
