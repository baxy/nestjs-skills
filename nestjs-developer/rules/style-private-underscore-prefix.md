---
title: Prefix Private Methods with an Underscore
impact: MEDIUM
impactDescription: Private methods are recognizable at every call site
tags: style, naming, methods, private
---

## Prefix Private Methods with an Underscore

**This rule applies only to private methods.** Every method declared `private` gets a `_` prefix, and keeps the `private` keyword: `private _assertCancelable()`, `private _calculateTotal()`. At a call site, `this._calculateTotal()` then reads as internal without jumping to the declaration.

It does **not** apply to:

- public or protected methods;
- properties and fields, including `private readonly` injected dependencies (`private readonly orderRepository`, never `_orderRepository`);
- functions, exported or not, constants, parameters or local variables.

**Incorrect (missing prefix, or prefix in the wrong places):**

```typescript
@Injectable()
export class OrderService {
  constructor(
    private readonly _orderRepository: Repository<Order>, // Prefix on an injected dependency
  ) {}

  async create(authUser: JwtUser, dto: CreateOrderDto): Promise<Order> {
    const total = this.calculateTotal(dto.items);           // Private method without prefix
    return this._orderRepository.save(this._orderRepository.create({ userId: authUser.id, total }));
  }

  _buildReference(order: Order): string {                   // Public method with a prefix
    return `ORD-${order.id.slice(0, 8)}`;
  }

  private calculateTotal(items: OrderItemDto[]): number { /* ... */ }
}
```

**Correct (prefix on private methods only):**

```typescript
@Injectable()
export class OrderService {
  constructor(private readonly orderRepository: Repository<Order>) {}

  async create(authUser: JwtUser, dto: CreateOrderDto): Promise<Order> {
    const total = this._calculateTotal(dto.items);
    return this.orderRepository.save(this.orderRepository.create({ userId: authUser.id, total }));
  }

  buildReference(order: Order): string {
    return `ORD-${order.id.slice(0, 8)}`;
  }

  private _calculateTotal(items: OrderItemDto[]): number { /* ... */ }
}
```
