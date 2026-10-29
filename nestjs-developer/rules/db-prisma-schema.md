---
title: Prisma Schema Conventions
impact: MEDIUM-HIGH
impactDescription: Consistent models, snake_case columns, named indexes
tags: database, prisma, schema, conventions
---

## Prisma Schema Conventions

Models are singular; tables are plural via `@@map`. Fields stay camelCase in the schema and map to snake_case columns with `@map`. Always declare timestamps, soft-delete columns, and named indexes/constraints explicitly.

**Incorrect (default naming, missing maps):**

```prisma
model Order {
  id        String   @id @default(uuid())
  userId    String
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id])
}
```

**Correct:**

```prisma
model Order {
  id             String    @id @default(uuid())
  userId         String    @map("user_id")
  status         String    @default("pending")
  totalCents     Int       @map("total_cents")
  shippingAddress Json     @map("shipping_address")
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")
  deletedAt      DateTime? @map("deleted_at")

  user  User        @relation(fields: [userId], references: [id])
  items OrderItem[]

  @@map("orders")
  @@index([userId, status], map: "IDX_orders_user_id_status")
}
```

- Singular model names, plural table names via `@@map`.
- Explicit `@map` for snake_case columns so the database matches the rest of the project.
- Named indexes with the same `IDX_` / `UQ_` / `CHK_` convention used by the TypeORM rules.
- Soft deletes use a nullable `deletedAt` and are filtered in queries (Prisma has no automatic soft-delete).
- Do not put API/Swagger concerns in the schema; those belong in DTOs.

Reference: [Prisma schema reference](https://www.prisma.io/docs/orm/prisma-schema/data-model)
