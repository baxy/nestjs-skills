---
title: Keep Data Access in Services
impact: HIGH
impactDescription: One layer owns each query, and route tests exercise the filters that scope it
tags: architecture, repository, data-access, typeorm, prisma
---

## Keep Data Access in Services

A service reads and writes its module's data. Do not add a custom repository class between the service and the ORM. Controllers never inject the data client; they call services.

### TypeORM

Inject repositories with `@InjectRepository(Entity)`. Queries live in the service method. Register entities with `TypeOrmModule.forFeature` in the module.

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
    private readonly userService: UserService,
  ) {}

  async findAll(authUser: JwtUser, query: FindAllOrdersQueryDto) {
    return this.orderRepository.find({
      where: { userId: authUser.id },
      skip: query.offset,
      take: query.limit,
    });
  }
}
```

See `db-typeorm-transactions` for multi-step writes.

### Prisma

Inject `PrismaService`. Queries live in the service method. The global `PrismaModule` provides the client (see `db-prisma-setup`).

```typescript
@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
  ) {}

  async findAll(authUser: JwtUser, query: FindAllOrdersQueryDto) {
    return this.prisma.order.findMany({
      where: { userId: authUser.id, deletedAt: null },
      skip: query.offset,
      take: query.limit,
    });
  }
}
```

See `db-prisma-transactions` for multi-step writes.

### Rules that apply to both

- A service only touches data owned by its own module. Data owned by another module is read through that module's exported service.
- A large query moves into a `private _build...()` method of the same service. When a service grows past one concern, split the service (see `arch-single-responsibility`), not the data access.
- Do not introduce a custom repository class unless the project already uses that pattern.

Reference: [NestJS Database](https://docs.nestjs.com/techniques/database#repository-pattern)
