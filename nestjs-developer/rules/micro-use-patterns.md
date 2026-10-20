---
title: Use Message and Event Patterns Correctly
impact: MEDIUM
impactDescription: Proper patterns ensure reliable microservice communication
tags: microservices, message-pattern, event-pattern, communication
---

## Use Message and Event Patterns Correctly

NestJS microservices support two communication patterns: request-response (`@MessagePattern`) and event-based (`@EventPattern`). Use a message pattern when the caller needs the answer to proceed, and an event pattern to announce something that happened.

- **Commands** (message patterns) are named `{object}.{verb}` in the imperative: `{ cmd: 'inventory.reserve' }`.
- **Events** follow the event naming of `arch-use-events`: `{object}.{action}` in the past tense (`order.created`).
- Event payloads carry ids and the fields consumers need, never whole entities.

**Incorrect (using wrong pattern for use case):**

```typescript
// Use @MessagePattern for fire-and-forget
@Controller()
export class NotificationController {
  @MessagePattern('user.created')
  async handleUserCreated(data: UserCreatedEvent) {
    // This WAITS for response, blocking the sender
    await this.emailService.sendWelcome(data.email);
    // If email fails, sender gets an error (coupling!)
  }
}

// Use @EventPattern expecting a response
@Controller()
export class OrderController {
  @EventPattern('inventory.check')
  async checkInventory(data: CheckInventoryDto) {
    const available = await this.inventory.check(data);
    return available; // This return value is IGNORED with @EventPattern!
  }
}

// Tight coupling in client
@Injectable()
export class UserService {
  async create(dto: CreateUserDto): Promise<User> {
    const user = await this.userRepository.save(await this._toEntity(dto));

    // Blocks until notification service responds
    await this.client.send('user.created', user).toPromise();
    // If notification service is down, user creation fails!

    return user;
  }
}
```

**Correct (use MessagePattern for request-response, EventPattern for fire-and-forget):**

```typescript
// MessagePattern: Request-Response (when you NEED a response)
@Controller()
export class InventoryController {
  @MessagePattern({ cmd: 'inventory.check' })
  async checkInventory(data: CheckInventoryDto): Promise<InventoryResult> {
    const result = await this.inventoryService.check(data.productId, data.quantity);
    return result; // Response sent back to caller
  }
}

// Client expects response
@Injectable()
export class OrderService {
  async create(authUser: JwtUser, dto: CreateOrderDto): Promise<Order> {
    // Check inventory - we NEED this response to proceed
    const inventory = await firstValueFrom(
      this.inventoryClient.send<InventoryResult>(
        { cmd: 'inventory.check' },
        { items: dto.items },
      ),
    );

    if (!inventory.available) {
      throw new BadRequestException('Insufficient inventory');
    }

    return this.orderRepository.save(this.orderRepository.create({ ...dto, userId: authUser.id }));
  }
}

// EventPattern: Fire-and-Forget (for notifications, side effects)
@Controller()
export class NotificationController {
  @EventPattern('user.created')
  async handleUserCreated(data: UserCreatedEvent): Promise<void> {
    try {
      await this.emailService.sendWelcome(data.email); // No return value: nobody waits for it
    } catch (error) {
      // Handled here: an event has no caller to receive the error (see error-handle-async-errors)
      this.logger.error(`Welcome email failed for user ${data.userId}`, error instanceof Error ? error.stack : error);
    }
  }
}

// Client emits event without waiting
@Injectable()
export class UserService {
  async create(dto: CreateUserDto): Promise<User> {
    const user = await this.userRepository.save(await this._toEntity(dto));

    // Fire and forget - doesn't block, doesn't wait
    this.eventClient.emit('user.created', {
      userId: user.id,
      email: user.email,
      timestamp: new Date(),
    });

    return user; // User creation succeeds regardless of event handling
  }
}

// Hybrid pattern for critical events
@Injectable()
export class OrderService {
  async create(authUser: JwtUser, dto: CreateOrderDto): Promise<Order> {
    const order = await this.orderRepository.save(this.orderRepository.create({ ...dto, userId: authUser.id }));

    // Critical: inventory reservation (use MessagePattern). Inventory is a separate service here, so it
    // cannot join our transaction (in-process modules do, see db-use-transactions): ask it, undo on refusal
    const reserved = await firstValueFrom(
      this.inventoryClient.send({ cmd: 'inventory.reserve' }, {
        orderId: order.id,
        items: dto.items,
      }),
    );

    if (!reserved.success) {
      await this.orderRepository.delete(order.id);
      throw new BadRequestException('Could not reserve inventory');
    }

    // Non-critical: notifications (use EventPattern)
    this.eventClient.emit('order.created', {
      orderId: order.id,
      userId: authUser.id,
      total: order.total,
    });

    return order;
  }
}

// Error handling patterns
// MessagePattern errors propagate to caller
@MessagePattern({ cmd: 'user.find' })
async getUser(userId: string): Promise<User> {
  const user = await this.userService.findOne(userId); // Data access stays in the service (see arch-data-access-in-services)
  if (!user) {
    throw new RpcException('User not found'); // Received by caller
  }
  return user;
}

// EventPattern errors should be handled locally
@EventPattern('order.created')
async handleOrderCreated(data: OrderCreatedEvent): Promise<void> {
  try {
    await this._processOrder(data);
  } catch (error) {
    // Log and potentially retry - don't throw
    this.logger.error(`Failed to process order.created for order ${data.orderId}`, error instanceof Error ? error.stack : error);
  }
}
```

Reference: [NestJS Microservices](https://docs.nestjs.com/microservices/basics)
