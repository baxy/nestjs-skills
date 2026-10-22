---
title: Follow Service Conventions
impact: MEDIUM
impactDescription: Services read the same way everywhere and own all domain rules
tags: architecture, services, dependency-injection, conventions
---

## Follow Service Conventions

Services hold all business logic and domain validation. Shape validation (types, formats, required fields) belongs to DTOs and the global `ValidationPipe`; services enforce what only the domain knows: whether a resource exists, whether the caller owns it, whether a state transition is legal.

- **Naming**: the service is **singular**, named for its resource: `OrderService` in `order/services/order.service.ts`, injected as `private readonly orderService: OrderService`. A second service in the module starts with the module name too (`OrderItemService`, `OrderPricingService`). See `arch-resource-naming`.
- **Constructor injection order**: `@InjectRepository()` repositories first (own module's entities only, see `arch-data-access-in-services`), then other services and token-injected abstractions, then configuration (`ConfigService` or a namespace injected with `@Inject(xConfig.KEY)`), then `DataSource`. All injected dependencies are `private readonly`, without a `_` prefix (see `style-private-underscore-prefix`).
- **Method parameter order**: the authenticated user (`authUser: JwtUser`, see `security-auth-jwt`) first when the method acts on behalf of a caller, then resource identifiers, then the data DTO, then optional parameters. A method no caller scopes (an admin delete, a lookup another module makes by id) starts with the identifiers.
- **Private methods use the `_` prefix** (see `style-private-underscore-prefix`).
- **Static constants use `UPPER_SNAKE_CASE`**: `CANCELABLE_STATUSES`, `MAX_ITEMS_PER_ORDER`.
- **Exceptions**: `NotFoundException` for a missing resource, `BadRequestException` for a broken domain rule (including an illegal state transition), `ConflictException` for a clash with existing data such as a duplicate (see `error-throw-http-exceptions`).
- **Transactions**: `dataSource.transaction(manager => ...)` for writes that span several entities (see `db-use-transactions`).
- **Pagination** returns `PaginatedResult<T>` (`{ result, count, limit, offset }`, see `perf-optimize-database`).

**Incorrect (mixed order, mutable deps, shape checks in the service):**

```typescript
@Injectable()
export class OrderService {
  constructor(
    private config: ConfigService,                                  // Not readonly, wrong position
    private dataSource: DataSource,
    private paymentService: PaymentService,
    @InjectRepository(Order) private orderRepository: Repository<Order>,
  ) {}

  static cancelable = ['pending', 'paid'];                         // Not UPPER_SNAKE_CASE

  async cancel(id: string, dto: CancelOrderDto, authUser: JwtUser) { // authUser last
    if (typeof dto.reason !== 'string' || dto.reason.length > 500) {  // Shape validation belongs in the DTO
      throw new BadRequestException('Invalid reason');
    }
    // ...
  }

  private checkStatus(order: Order) { /* ... */ }                  // Missing _ prefix
}
```

**Correct (consistent order, domain rules only):**

```typescript
@Injectable()
export class OrderService {
  static readonly CANCELABLE_STATUSES: OrderStatus[] = [OrderStatus.Pending, OrderStatus.Paid];

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    private readonly paymentService: PaymentService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  async findById(authUser: JwtUser, id: string): Promise<Order> {
    const order = await this.orderRepository.findOne({ where: { id, userId: authUser.id } });
    if (!order) {
      throw new NotFoundException(`Order #${id} not found`);
    }
    return order;
  }

  async cancel(authUser: JwtUser, id: string, dto: CancelOrderDto): Promise<Order> {
    const order = await this.findById(authUser, id);
    this._assertCancelable(order);

    return this.dataSource.transaction(async (manager) => {
      await manager.update(Order, order.id, { status: OrderStatus.Canceled, cancelReason: dto.reason });
      await manager.delete(OrderItem, { orderId: order.id, reserved: true });
      return manager.findOneByOrFail(Order, { id: order.id });
    });
  }

  private _assertCancelable(order: Order): void {
    if (!OrderService.CANCELABLE_STATUSES.includes(order.status)) {
      throw new BadRequestException(`An order in status ${order.status} cannot be canceled`);
    }
  }
}
```

Reference: [NestJS Providers](https://docs.nestjs.com/providers)
