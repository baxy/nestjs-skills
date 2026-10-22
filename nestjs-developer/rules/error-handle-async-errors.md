---
title: Handle Async Errors Outside the Request Cycle
impact: HIGH
impactDescription: Prevents silent failures and process crashes from unhandled rejections
tags: error-handling, async, promises, events, cron
---

## Handle Async Errors Outside the Request Cycle

Nest catches errors thrown by route handlers and hands them to the exception filter. Nothing catches errors from work that runs outside a request: promises started without `await`, `@OnEvent` listeners, `@Cron` jobs. An unhandled rejection there is at best lost, at worst a crash.

- **Await every promise** inside a request. A promise you deliberately do not await gets a `.catch()` that logs it; work that must eventually succeed goes to a queue instead (see `micro-use-queues`).
- **Every listener and scheduled job catches its own errors** and logs them with the stack. It never rethrows: there is no caller to receive it.
- **Queue processors are the exception:** BullMQ catches what a processor throws and retries the job, so a processor throws instead of catching (see `micro-use-queues`).
- **Log the error, not the payload.** Identify the work by id (`order ${event.orderId}`), never by logging the whole event or DTO (see `devops-use-logging`).
- The process-level `uncaughtException`/`unhandledRejection` handlers are the last resort, defined once in `main.ts` (see `devops-use-logging`).

**Incorrect (floating promises, unguarded listeners and jobs):**

```typescript
@Injectable()
export class UserService {
  async create(dto: CreateUserDto): Promise<User> {
    const user = await this.userRepository.save(await this._toEntity(dto));
    this.mailService.sendWelcome(user.email); // Not awaited, no catch: an unhandled rejection
    return user;
  }
}

@Injectable()
export class RecommendationOrderEventsListener {
  @OnEvent('order.created')
  onOrderCreated(event: OrderCreatedEvent): void {
    this._recordPurchase(event); // Promise dropped; its failure is unhandled
  }
}

@Injectable()
export class TempFileCleanupJob {
  @Cron(CronExpression.EVERY_HOUR)
  async run(): Promise<void> {
    await this.tempFileService.deleteStale(); // A throw here is an unhandled rejection
  }
}
```

**Correct (every path ends in a handled outcome):**

```typescript
@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  async create(dto: CreateUserDto): Promise<User> {
    const user = await this.userRepository.save(await this._toEntity(dto));
    // Best effort, deliberately not awaited; a guaranteed email would be queued instead
    this.mailService.sendWelcome(user.email).catch((error: unknown) => {
      this.logger.error(`Welcome email failed for user ${user.id}`, error instanceof Error ? error.stack : error);
    });
    return user;
  }
}

@Injectable()
export class RecommendationOrderEventsListener {
  private readonly logger = new Logger(RecommendationOrderEventsListener.name);

  constructor(private readonly recommendationService: RecommendationService) {}

  @OnEvent('order.created', { async: true })
  async onOrderCreated(event: OrderCreatedEvent): Promise<void> {
    try {
      await this.recommendationService.recordPurchase(event.orderId);
    } catch (error) {
      this.logger.error(`Recording purchase failed for order ${event.orderId}`, error instanceof Error ? error.stack : error);
    }
  }
}

// Per-instance housekeeping (this instance's temp directory), so @Cron fits; a job that must
// run once across all instances is a BullMQ job scheduler (see micro-use-queues)
@Injectable()
export class TempFileCleanupJob {
  private readonly logger = new Logger(TempFileCleanupJob.name);

  constructor(private readonly tempFileService: TempFileService) {}

  @Cron(CronExpression.EVERY_HOUR)
  async run(): Promise<void> {
    try {
      const deleted = await this.tempFileService.deleteStale();
      this.logger.log(`Deleted ${deleted} stale temp files`);
    } catch (error) {
      this.logger.error('Temp file cleanup failed', error instanceof Error ? error.stack : error);
    }
  }
}
```

Reference: [Node.js unhandledRejection](https://nodejs.org/api/process.html#event-unhandledrejection) · [NestJS Events](https://docs.nestjs.com/techniques/events)
