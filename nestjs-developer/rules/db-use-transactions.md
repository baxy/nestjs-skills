---
title: Use Transactions for Multi-Step Operations
impact: HIGH
impactDescription: Ensures data consistency in multi-step operations
tags: database, transactions, typeorm, consistency
---

## Use Transactions for Multi-Step Operations

When multiple database operations must succeed or fail together, wrap them in a transaction. This prevents partial updates that leave your data in an inconsistent state. Use TypeORM's transaction APIs or the DataSource query runner for complex scenarios.

**Incorrect (multiple saves without transaction):**

```typescript
// Multiple saves without transaction
@Injectable()
export class OrderService {
  async create(authUser: JwtUser, dto: CreateOrderDto): Promise<Order> {
    // If any step fails, the rows before it stay written
    const order = await this.orderRepository.save({ userId: authUser.id, status: OrderStatus.Pending });

    for (const item of dto.items) {
      await this.orderItemRepository.save({ orderId: order.id, sku: item.sku, quantity: item.quantity });
      await this.inventoryService.reserve(item.sku, item.quantity); // Commits on its own
    }

    return order;
  }
}
```

Keep calls to external systems (payment providers, email, other services) **out** of the transaction: they cannot be rolled back, and they hold the transaction and its locks open for a network round trip. Commit first, then call the provider, and record its outcome in a second write (or hand it to a queue, see `micro-use-queues`).

**Correct (one transaction for the database writes; the external call after commit):**

```typescript
@Injectable()
export class OrderService {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly paymentService: PaymentService,
    private readonly dataSource: DataSource,
  ) {}

  async create(authUser: JwtUser, dto: CreateOrderDto): Promise<Order> {
    const order = await this.dataSource.transaction(async (manager) => {
      // Every write goes through the transactional manager
      const created = await manager.save(manager.create(Order, { userId: authUser.id, status: OrderStatus.Pending })); // An instance, so @Exclude() still applies

      for (const item of dto.items) {
        await manager.save(OrderItem, { orderId: created.id, sku: item.sku, quantity: item.quantity });
        // Stock belongs to the inventory module: its service writes it, inside our transaction
        await this.inventoryService.reserve(manager, item.sku, item.quantity);
      }

      return created;
    });

    // After commit: a failed charge leaves a pending order to retry or cancel, never half-written rows
    await this.paymentService.authorize(order);
    return order;
  }
}

// inventory/services/inventory.service.ts - takes the caller's manager so the write joins its transaction
@Injectable()
export class InventoryService {
  async reserve(manager: EntityManager, sku: string, quantity: number): Promise<void> {
    const { affected } = await manager
      .createQueryBuilder()
      .update(Stock)
      .set({ quantity: () => 'quantity - :quantity' })
      .where('sku = :sku AND quantity >= :quantity', { sku, quantity })
      .execute();
    if (!affected) {
      throw new BadRequestException(`Not enough stock for ${sku}`); // Rolls back the caller's whole transaction
    }
  }
}

// QueryRunner for manual control, when the transaction spans several steps or services
@Injectable()
export class TransferService {
  constructor(private readonly dataSource: DataSource) {}

  async transfer(fromId: string, toId: string, amount: number): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const debited = await queryRunner.manager
        .createQueryBuilder()
        .update(Account)
        .set({ balance: () => 'balance - :amount' })
        .where('id = :fromId AND balance >= :amount', { fromId, amount })
        .execute();
      if (!debited.affected) {
        throw new BadRequestException('Insufficient funds');
      }

      await queryRunner.manager.increment(Account, { id: toId }, 'balance', amount);
      await queryRunner.manager.save(Transfer, { fromId, toId, amount });

      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
```

Reference: [TypeORM Transactions](https://typeorm.io/transactions)
