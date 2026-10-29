---
title: Use Prisma Migrate for Schema Changes
impact: HIGH
impactDescription: Keeps schema and database in sync without drift
tags: database, prisma, migrations
---

## Use Prisma Migrate for Schema Changes

Never use `prisma db push` in shared or production environments. Every structural change goes through `prisma migrate dev` (local) and `prisma migrate deploy` (CI/deploy). After generating a migration, run it and confirm no further drift.

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

# 3. In CI / deploy
npx prisma migrate deploy
```

- Review the generated SQL before committing.
- Data-only changes can still be written as SQL inside a migration, but structural changes must come from the schema.
- Run `prisma migrate deploy` as its own deploy step, not at application startup on every replica.

Reference: [Prisma Migrate](https://www.prisma.io/docs/orm/prisma-migrate)
