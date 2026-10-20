---
title: Avoid the Service Locator Anti-Pattern
impact: HIGH
impactDescription: Dependencies stay visible in the constructor and replaceable in tests
tags: dependency-injection, anti-patterns, testing
---

## Avoid the Service Locator Anti-Pattern

Do not resolve dependencies at runtime with `ModuleRef.get()` or a hand-written global container. The dependency disappears from the constructor, so readers and the testing module cannot see it. Inject it in the constructor instead (see `di-prefer-constructor-injection`).

`ModuleRef` is legitimate in exactly two cases:

- **A factory that picks one of several implementations at runtime** by a value only known per call (a channel type, a provider name), where all candidates are registered providers.
- **Lazy-loaded modules** (see `perf-lazy-loading`), whose providers do not exist at startup.

**Incorrect (dependencies hidden behind a locator):**

```typescript
@Injectable()
export class OrderService {
  constructor(private readonly moduleRef: ModuleRef) {}

  async create(authUser: JwtUser, dto: CreateOrderDto): Promise<Order> {
    const inventoryService = this.moduleRef.get(InventoryService, { strict: false }); // Invisible dependency
    const paymentService = this.moduleRef.get(PaymentService, { strict: false });
    // ...
  }
}

// Global singleton container
export class ServiceContainer {
  private static instance: ServiceContainer;
  private readonly services = new Map<string, unknown>();
  // ...
}
```

**Correct (constructor injection; ModuleRef only in a factory):**

```typescript
@Injectable()
export class OrderService {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly paymentService: PaymentService,
  ) {}
}

// notification/services/notification-channel.factory.ts - the channel is known only per call
@Injectable()
export class NotificationChannelFactory {
  constructor(private readonly moduleRef: ModuleRef) {}

  forChannel(channel: NotificationChannel): NotificationSender {
    switch (channel) {
      case NotificationChannel.Email:
        return this.moduleRef.get(EmailSender);
      case NotificationChannel.Sms:
        return this.moduleRef.get(SmsSender);
    }
  }
}
```

Reference: [NestJS Module Reference](https://docs.nestjs.com/fundamentals/module-ref)
