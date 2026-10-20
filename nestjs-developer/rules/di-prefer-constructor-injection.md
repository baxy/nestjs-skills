---
title: Use Constructor Injection, Never new or Property Injection
impact: CRITICAL
impactDescription: Every dependency is visible in one place, shared through the container, and replaceable in tests
tags: dependency-injection, constructor, testing
---

## Use Constructor Injection, Never new or Property Injection

Every dependency of a provider, controller, guard or interceptor arrives through its constructor as `private readonly`. Two things bypass this and are not allowed:

- **`new` for an injectable class** (`new MailService()`). The instance is outside the container: it is not shared, its own dependencies are not injected, its lifecycle hooks never run, and tests cannot replace it. Three uses of `new` are fine: `new Logger(Class.name)` (the standard Nest pattern; it delegates to the app logger), the global pipes, filter and interceptors that `configureApp()` registers with `app.useGlobal*()` (see `test-use-testing-module`), and a per-route enhancer that takes constructor arguments, such as `@UseInterceptors(new TimeoutInterceptor(10_000))` (see `api-use-interceptors`).
- **Property injection** (`@Inject()` on a field). The dependency is hidden from the constructor signature and unset if the class is constructed any other way.

An optional dependency is still a constructor parameter, marked `@Optional()`.

**Incorrect (manual instantiation and property injection):**

```typescript
@Injectable()
export class OrderService {
  private readonly mailService = new MailService(); // Outside the container: not shared, not mockable

  @Inject(PAYMENT_GATEWAY)
  private paymentGateway: PaymentGateway;           // Hidden dependency

  async create(authUser: JwtUser, dto: CreateOrderDto): Promise<Order> {
    // ...
  }
}
```

**Correct (everything through the constructor):**

```typescript
@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name); // `new Logger` is allowed

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly mailService: MailService,
    @Inject(PAYMENT_GATEWAY) private readonly paymentGateway: PaymentGateway,
    @Optional() @Inject(ANALYTICS_CLIENT) private readonly analyticsClient?: AnalyticsClient,
  ) {}

  async create(authUser: JwtUser, dto: CreateOrderDto): Promise<Order> {
    const order = await this.orderRepository.save(this.orderRepository.create({ ...dto, userId: authUser.id }));
    this.analyticsClient?.track('order.created', { orderId: order.id }); // Optional enhancement
    return order;
  }
}
```

Tests replace these dependencies in the testing module (see `test-use-testing-module`); nothing constructs the service by hand.

Reference: [NestJS Providers](https://docs.nestjs.com/providers) · [Optional providers](https://docs.nestjs.com/providers#optional-providers)
