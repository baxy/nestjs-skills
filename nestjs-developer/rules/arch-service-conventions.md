---
title: Follow Service Conventions
impact: MEDIUM
impactDescription: Services read the same way everywhere and own all domain rules
tags: architecture, services, dependency-injection, conventions
---

## Follow Service Conventions

Services hold all business logic and domain validation. Shape validation (types, formats, required fields) belongs to DTOs and the global `ValidationPipe`; services enforce what only the domain knows: whether a resource exists, whether the caller owns it, whether a state transition is legal.

- **Naming**: the service is **singular**, named for its resource: `OrderService` in `order/services/order.service.ts`, injected as `private readonly orderService: OrderService`. A second service in the module starts with the module name too (`OrderItemService`, `OrderPricingService`). See `arch-resource-naming`.
- **Constructor injection order**: data client first (TypeORM repositories or `PrismaService`), then other services and token-injected abstractions, then configuration (`ConfigService` or a namespace injected with `@Inject(xConfig.KEY)`). All injected dependencies are `private readonly`, without a `_` prefix (see `style-private-underscore-prefix`).
- **Method parameter order**: the authenticated user (`authUser: JwtUser`, see `security-auth-jwt`) first when the method acts on behalf of a caller, then resource identifiers, then the data DTO, then optional parameters. A method no caller scopes (an admin delete, a lookup another module makes by id) starts with the identifiers.
- **Private methods use the `_` prefix** (see `style-private-underscore-prefix`).
- **Static constants use `UPPER_SNAKE_CASE`**: `CANCELABLE_STATUSES`, `MAX_ITEMS_PER_ORDER`.
- **Exceptions**: `NotFoundException` for a missing resource, `BadRequestException` for a broken domain rule (including an illegal state transition), `ConflictException` for a clash with existing data such as a duplicate (see `error-throw-http-exceptions`).
- **Transactions**: use the ORM's transaction API for writes that span several records (see `db-typeorm-transactions` or `db-prisma-transactions`).
- **Pagination** returns `PaginatedResult<T>` (`{ result, count, limit, offset }`, see `perf-optimize-database`).

**Incorrect (mixed order, mutable deps, shape checks in the service):**

```typescript
@Injectable()
export class OrderService {
  constructor(
    private config: ConfigService,
    private paymentService: PaymentService,
    @InjectRepository(Order) private orderRepository: Repository<Order>,
  ) {}

  async cancel(id: string, dto: CancelOrderDto, authUser: JwtUser) {
    if (typeof dto.reason !== 'string' || dto.reason.length > 500) {
      throw new BadRequestException('Invalid reason');
    }
  }
}
```

**Correct (TypeORM):**

```typescript
@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly paymentService: PaymentService,
    private readonly configService: ConfigService,
  ) {}

  async cancel(authUser: JwtUser, id: string, dto: CancelOrderDto): Promise<Order> {
    const order = await this.findById(authUser, id);
    this._assertCancelable(order);
    return this.dataSource.transaction(async (manager) => {
      // ...
    });
  }

  private _assertCancelable(order: Order): void {
    if (!OrderService.CANCELABLE_STATUSES.includes(order.status)) {
      throw new BadRequestException(`An order in status ${order.status} cannot be canceled`);
    }
  }
}
```

**Correct (Prisma):**

```typescript
@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly paymentService: PaymentService,
    private readonly configService: ConfigService,
  ) {}

  async cancel(authUser: JwtUser, id: string, dto: CancelOrderDto) {
    const order = await this.findById(authUser, id);
    this._assertCancelable(order);
    return this.prisma.$transaction(async (tx) => {
      // ...
    });
  }
}
```

Reference: [NestJS Providers](https://docs.nestjs.com/providers)
