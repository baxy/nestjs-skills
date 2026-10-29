---
title: Avoid N+1 and Prefer Select
impact: HIGH
impactDescription: Prevents extra queries and over-fetching
tags: database, prisma, queries, performance
---

## Avoid N+1 and Prefer Select

Never load a list then loop to fetch related records. Use `include` or `select` in the original query. Prefer `select` when you only need a subset of fields.

**Incorrect (N+1):**

```typescript
const orders = await this.prisma.order.findMany({ where: { userId } });
for (const order of orders) {
  order.items = await this.prisma.orderItem.findMany({ where: { orderId: order.id } });
}
```

**Correct:**

```typescript
const orders = await this.prisma.order.findMany({
  where: { userId },
  select: {
    id: true,
    status: true,
    totalCents: true,
    items: {
      select: {
        id: true,
        quantity: true,
        priceCents: true,
      },
    },
  },
});
```

- Use `include` when you need the full related model.
- Use `select` to limit columns and avoid over-fetching.
- For GraphQL resolvers that would otherwise N+1, consider a DataLoader that batches by parent ID.

Reference: [Prisma query optimization](https://www.prisma.io/docs/orm/prisma-client/queries)
