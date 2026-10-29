---
title: Use Prisma Migrate for Schema Changes
impact: HIGH
impactDescription: Keeps schema and database in sync without drift
tags: database, prisma, migrations, safety
---

## Use Prisma Migrate for Schema Changes

Never use `prisma db push` in shared or production environments. Every structural change goes through `prisma migrate dev` (local) and `prisma migrate deploy` (CI/deploy).

**Incorrect:**

```bash
# db push in a shared environment
npx prisma db push
```

**Correct workflow:**

```bash
# 1. Change schema.prisma
# 2. Generate and apply locally
npx prisma migrate dev --name add-order-status

# 3. Review the generated SQL
# 4. In CI / deploy
npx prisma migrate deploy
```

### Safety checklist before applying a migration

- **Review the SQL.** Look for destructive operations (`DROP COLUMN`, `DROP TABLE`, type changes that truncate data).
- **Data compatibility.** Adding a non-nullable column without a default fails if the table has rows. Prefer nullable + backfill, or a default.
- **Locks.** Large table alterations can lock the table. For big tables, consider multi-step migrations (add column, backfill, set not null, drop old).
- **Backfills.** Put data copies in the same migration only when they are small and safe; otherwise use a separate data migration or a one-off script.
- **Drift check.** After applying, run `prisma migrate dev` again. It should report no changes.

### Deploy

Run `prisma migrate deploy` as its own deploy step (init job or one-off task), not at application startup on every replica. The previous version must still work against the new schema until the rollout finishes.

Reference: [Prisma Migrate](https://www.prisma.io/docs/orm/prisma-migrate)
