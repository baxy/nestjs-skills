---
title: Single Responsibility for Services
impact: CRITICAL
impactDescription: Services stay small enough to read, test and change without touching unrelated features
tags: architecture, services, single-responsibility
---

## Single Responsibility for Services

Each service owns one domain concern. Avoid "god services" that handle several unrelated concerns: a name with "And" in it, a constructor with dependencies from many modules, or methods that share no state are the signs.

When a use case spans several concerns (create an order, charge it, notify the customer), the service that owns the use case orchestrates it: it calls the other modules' services, or emits an event for side effects that need not succeed together (see `arch-use-events`). Controllers never orchestrate; they call one service method and return its result (see `api-controller-conventions`).

**Incorrect (god service, or orchestration in the controller):**

```typescript
@Injectable()
export class UserAndOrderService {
  async createUser(dto: CreateUserDto) { /* ... */ }
  async createOrder(userId: string, dto: CreateOrderDto) { /* ... */ }
  async calculateOrderStats(userId: string) { /* ... */ }
  async validatePayment(orderId: string) { /* ... */ }
}

@Controller('orders')
export class OrderController {
  @Post()
  async create(@AuthUser() authUser: JwtUser, @Body() dto: CreateOrderDto) {
    const order = await this.orderService.create(authUser, dto);
    await this.paymentService.charge(order);                    // Business flow in the controller
    await this.notificationService.sendOrderConfirmation(order);
    return order;
  }
}
```

**Correct (focused services; the owning service orchestrates):**

```typescript
// order/services/order.service.ts - owns the "place an order" use case
@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly paymentService: PaymentService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(authUser: JwtUser, dto: CreateOrderDto): Promise<Order> {
    const order = await this.orderRepository.save(
      this.orderRepository.create({ ...dto, userId: authUser.id, status: OrderStatus.Pending }),
    );
    await this.paymentService.authorize(order);          // After the save: a failed authorization leaves the order pending (see db-use-transactions)
    this.eventEmitter.emit('order.created', new OrderCreatedEvent(order.id, authUser.id)); // Side effects
    return order;
  }
}

// order/services/order-stats.service.ts - a separate concern of the same module
@Injectable()
export class OrderStatsService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  async calculateForUser(authUser: JwtUser): Promise<OrderStats> { /* ... */ }
}

// order/controllers/order.controller.ts - one call, result returned
@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  create(@AuthUser() authUser: JwtUser, @Body() dto: CreateOrderDto): Promise<Order> {
    return this.orderService.create(authUser, dto);
  }
}
```

Reference: [NestJS Providers](https://docs.nestjs.com/providers)
