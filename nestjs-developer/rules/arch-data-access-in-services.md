---
title: Keep Data Access in Services Through Injected Repositories
impact: HIGH
impactDescription: One layer owns each query, and route tests exercise the filters that scope it
tags: architecture, repository, data-access, typeorm
---

## Keep Data Access in Services Through Injected Repositories

A service reads and writes its module's entities through TypeORM's repository, injected with `@InjectRepository(Entity)`. Queries, including query builders, live in the service method that needs them. Do not add custom repository classes (`OrderRepository` wrapping `Repository<Order>`) between the service and TypeORM.

Why:

- **The filters that matter stay testable.** In the e2e tier the repository is mocked at TypeORM's token (`getRepositoryToken(Order)`, see `test-use-testing-module`), so the service's own code still runs: a dropped tenant or ownership condition shows up in what reached the repository. Behind a custom repository the whole query is replaced by a canned return value, and a missing `WHERE` passes every test.
- **One layer, one place to look.** A custom repository splits each feature across two classes whose boundary nobody agrees on, and the service ends up as a pass-through.
- **Real SQL is proven in the database tier** (see `test-database-tier`), which neither layout gets for free.

Rules:

- Controllers never inject repositories; they call services (see `api-controller-conventions`).
- A service injects repositories only for its own module's entities (`TypeOrmModule.forFeature([...])` in its module). Data owned by another module is read through that module's exported service.
- Name the property for the entity: `@InjectRepository(Order) private readonly orderRepository: Repository<Order>`.
- A query that grows large moves into a `private _build...Query()` method of the same service. When a service grows past one concern, split the service (see `arch-single-responsibility`), not the data access.
- Writes across several entities use `dataSource.transaction()` in the service (see `db-use-transactions`). When the transaction must include another module's rows, that module's service exposes a method taking the `EntityManager`, so the write joins the caller's transaction without the caller touching the other module's entities.

**Incorrect (custom repository class, or another module's repository):**

```typescript
// order/repositories/order.repository.ts - an extra layer the service only forwards to
@Injectable()
export class OrderRepository {
  constructor(@InjectRepository(Order) private readonly repository: Repository<Order>) {}

  findPageForUser(userId: string, query: FindAllOrdersQueryDto): Promise<[Order[], number]> {
    return this.repository.findAndCount({ where: { userId }, skip: query.offset, take: query.limit });
  }
}

@Injectable()
export class OrderService {
  constructor(
    private readonly orderRepository: OrderRepository,
    @InjectRepository(User) private readonly userRepository: Repository<User>, // Another module's entity
  ) {}
}

// e2e test: the mock replaces the whole query, so the userId filter is never checked
{ provide: OrderRepository, useValue: { findPageForUser: jest.fn().mockResolvedValue([[order], 1]) } }
```

**Correct (repository injected into the service, query in the service):**

```typescript
// order/order.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([Order]), UserModule],
  controllers: [OrderController],
  providers: [OrderService],
})
export class OrderModule {}

// order/services/order.service.ts
@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly userService: UserService, // Another module's data, through its service
  ) {}

  async findAll(authUser: JwtUser, query: FindAllOrdersQueryDto): Promise<PaginatedResult<Order>> {
    const qb = this.orderRepository
      .createQueryBuilder('order')
      .where('order.userId = :userId', { userId: authUser.id });

    if (query.status) {
      qb.andWhere('order.status = :status', { status: query.status });
    }

    const [result, count] = await qb
      .orderBy('order.createdAt', 'DESC')
      .skip(query.offset)
      .take(query.limit)
      .getManyAndCount();

    return { result, count, limit: query.limit, offset: query.offset };
  }
}

// e2e test: TypeORM's token is mocked, the service's filters still run
{ provide: getRepositoryToken(Order), useValue: orderRepository }
```

Reference: [NestJS Database](https://docs.nestjs.com/techniques/database#repository-pattern)
