---
title: Optimize Database Queries
impact: HIGH
impactDescription: Database queries are typically the largest source of latency
tags: performance, database, queries, optimization
---

## Optimize Database Queries

Select only needed columns, use proper indexes, avoid over-fetching relations, and consider query performance when designing your data access. Most API slowness traces back to inefficient database queries.

### Shared rules

- Always paginate list endpoints. Return `{ result, count, limit, offset }` (see `api-dto-naming`).
- Index columns used in `WHERE`, `ORDER BY`, and joins.
- Prefer selecting only the fields you need.
- Avoid N+1 (see `db-typeorm-avoid-n-plus-one` or `db-prisma-queries`).

### TypeORM

```typescript
// Select only needed columns
const users = await this.userRepository.find({
  select: { email: true },
});

// Pagination
const [result, count] = await this.orderRepository.findAndCount({
  where: { userId: authUser.id },
  skip: query.offset,
  take: query.limit,
  order: { createdAt: 'DESC' },
});

return { result, count, limit: query.limit, offset: query.offset };
```

Index on the entity (see `db-typeorm-entity-conventions`):

```typescript
@Entity('orders')
@Index('IDX_orders_user_id_status', ['userId', 'status'])
export class Order { /* ... */ }
```

### Prisma

```typescript
// Select only needed columns
const users = await this.prisma.user.findMany({
  select: { email: true },
});

// Pagination
const [result, count] = await Promise.all([
  this.prisma.order.findMany({
    where: { userId: authUser.id, deletedAt: null },
    skip: query.offset,
    take: query.limit,
    orderBy: { createdAt: 'desc' },
  }),
  this.prisma.order.count({
    where: { userId: authUser.id, deletedAt: null },
  }),
]);

return { result, count, limit: query.limit, offset: query.offset };
```

Index in the schema (see `db-prisma-schema`):

```prisma
@@index([userId, status], map: "IDX_orders_user_id_status")
```

### Connection pool

Size the pool so that pool size × number of instances stays under the database `max_connections` (or the pooler's limit). TypeORM uses `poolSize` / `extra.max`. Prisma uses the connection string or driver adapter settings.

Reference: [TypeORM Query Builder](https://typeorm.io/select-query-builder) · [Prisma query optimization](https://www.prisma.io/docs/orm/prisma-client/queries)
