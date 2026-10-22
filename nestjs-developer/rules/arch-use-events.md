---
title: Use Event-Driven Architecture for Decoupling
impact: MEDIUM-HIGH
impactDescription: Enables async processing and modularity
tags: architecture, events, decoupling
---

## Use Event-Driven Architecture for Decoupling

Use `@nestjs/event-emitter` for intra-service events and message brokers for inter-service communication. Events allow modules to react to changes without direct dependencies, improving modularity and enabling async processing.

**Event names** are lowercase and dot-separated: `{object}.{action}`, with the action in the past tense because the event reports something that already happened - `order.created`, `order.shipped`, `user.registered`. A multi-word object uses an underscore (`order_item.added`, `payment_method.removed`). The same convention applies to in-process events and to events sent through a message broker, so a name reads the same wherever it is consumed.

```typescript
// Correct
this.eventEmitter.emit('order.created', event);
this.eventEmitter.emit('order_item.added', event);

// Incorrect
this.eventEmitter.emit('OrderCreated', event);          // PascalCase, no separator
this.eventEmitter.emit('order_created', event);         // object and action not dot-separated
this.eventEmitter.emit('order.create', event);          // imperative, not past tense
this.eventEmitter.emit('order-item.added', event);       // hyphen in a multi-word object
```

**Incorrect (direct service coupling):**

```typescript
@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly recommendationService: RecommendationService,
    private readonly mailService: MailService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async create(authUser: JwtUser, dto: CreateOrderDto): Promise<Order> {
    const order = await this.orderRepository.save(this.orderRepository.create({ ...dto, userId: authUser.id }));

    // OrderService knows every consumer; adding one means changing this method
    await this.recommendationService.recordPurchase(order.id);
    await this.mailService.sendConfirmation(order);
    await this.analyticsService.trackPurchase(order.id, order.total);

    return order;
  }
}
```

**Correct (event-driven decoupling):**

```typescript
// order/events/order-created.event.ts
export class OrderCreatedEvent {
  constructor(
    public readonly orderId: string,
    public readonly userId: string,
    public readonly total: number,
  ) {}
}

// order/services/order.service.ts - emits, knows no consumer
@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(authUser: JwtUser, dto: CreateOrderDto): Promise<Order> {
    const order = await this.orderRepository.save(this.orderRepository.create({ ...dto, userId: authUser.id }));
    this.eventEmitter.emit('order.created', new OrderCreatedEvent(order.id, order.userId, order.total));
    return order;
  }
}

// recommendation/listeners/recommendation-order-events.listener.ts - each consumer listens in its own module (see arch-resource-naming)
@Injectable()
export class RecommendationOrderEventsListener {
  private readonly logger = new Logger(RecommendationOrderEventsListener.name);

  constructor(private readonly recommendationService: RecommendationService) {}

  @OnEvent('order.created', { async: true })
  async onOrderCreated(event: OrderCreatedEvent): Promise<void> {
    try {
      await this.recommendationService.recordPurchase(event.orderId);
    } catch (error) {
      // A listener's failure must not reach the emitter or crash the process (see error-handle-async-errors)
      this.logger.error(`Could not record purchase for order ${event.orderId}`, error instanceof Error ? error.stack : error);
    }
  }
}
```

In-process events are lost if the process stops before a listener finishes. A side effect that must eventually happen (an email, a charge) goes through a queue (see `micro-use-queues`). Work that must succeed or fail together with the write, such as reserving stock, is not a side effect at all: the owning service calls it inside its transaction (see `db-use-transactions`).

Reference: [NestJS Events](https://docs.nestjs.com/techniques/events)
