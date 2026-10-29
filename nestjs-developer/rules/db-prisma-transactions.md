---
title: Use Transactions for Multi-Step Writes
impact: HIGH
impactDescription: Ensures data consistency in multi-step operations
tags: database, prisma, transactions
---

## Use Transactions for Multi-Step Writes

When multiple database operations must succeed or fail together, wrap them in `prisma.$transaction`. Keep external calls (payment providers, email, other services) outside the transaction.

**Incorrect (separate writes):**

```typescript
async create(dto: CreateOrderDto) {
  const order = await this.prisma.order.create({ data: { ... } });
  for (const item of dto.items) {
    await this.prisma.orderItem.create({ data: { orderId: order.id, ...item } });
  }
  return order;
}
```

**Correct:**

```typescript
async create(dto: CreateOrderDto) {
  const order = await this.prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        userId: dto.userId,
        status: 'pending',
        items: {
          create: dto.items,
        },
      },
    });
    return created;
  });

  // External side effects after commit
  await this.paymentService.authorize(order);
  return order;
}
```

Use the interactive transaction callback so all writes share the same transaction client. For nested relations, prefer Prisma's nested writes inside the transaction when possible.

Reference: [Prisma transactions](https://www.prisma.io/docs/orm/prisma-client/queries/transactions)
