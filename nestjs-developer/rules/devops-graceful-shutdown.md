---
title: Shut Down Gracefully with Nest's Lifecycle Hooks
impact: MEDIUM-HIGH
impactDescription: Deployments finish in-flight requests and jobs instead of cutting them off
tags: devops, graceful-shutdown, lifecycle, kubernetes
---

## Shut Down Gracefully with Nest's Lifecycle Hooks

Call `app.enableShutdownHooks()` in `main.ts` and let Nest drive shutdown. Do not add your own `SIGTERM`/`SIGINT` handlers or call `process.exit()` to shut down: they race Nest's handler and cut the hooks short. The crash handlers for `uncaughtException` (see `devops-use-logging`) are a different case: the process is already broken, and exiting is their job.

On `SIGTERM`, `app.close()` runs the hooks in this order, and each step belongs in its hook:

1. `onModuleDestroy`: stop taking new background work (queue workers, schedulers).
2. `beforeApplicationShutdown`: the HTTP server is **still open**. Flip readiness to failing and wait for the load balancer to stop routing to this instance.
3. Nest closes the HTTP server, which stops accepting connections and lets in-flight requests finish.
4. `onApplicationShutdown`: the server is closed. Release what is left (connections, clients); TypeORM closes its own pool.

The orchestrator's grace period (`terminationGracePeriodSeconds`, 30 s by default on Kubernetes) must exceed the drain delay plus the longest request.

**Incorrect (manual signal handling, work in the wrong hook):**

```typescript
// main.ts
app.enableShutdownHooks();
process.on('SIGTERM', async () => {  // Races Nest's own handler
  await app.close();
  process.exit(0);                   // Cuts off any hook still running
});

@Injectable()
export class ShutdownDrain implements OnApplicationShutdown {
  async onApplicationShutdown(): Promise<void> {
    this.shutdownState.begin();                         // Too late: the HTTP server is already closed
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
}
```

**Correct (Nest's hooks, each step in its place):**

```typescript
// main.ts
app.enableShutdownHooks();

// health/services/shutdown-state.ts - read by the readiness probe (see micro-use-health-checks)
@Injectable()
export class ShutdownState {
  private shuttingDown = false;

  begin(): void {
    this.shuttingDown = true;
  }

  isShuttingDown(): boolean {
    return this.shuttingDown;
  }
}

// health/services/shutdown-drain.ts - fail readiness while the server still serves, then wait
const DRAIN_DELAY_MS = 15_000; // Longer than the readiness probe's periodSeconds x failureThreshold (5 s x 2 = 10 s, see micro-use-health-checks)

@Injectable()
export class ShutdownDrain implements BeforeApplicationShutdown {
  private readonly logger = new Logger(ShutdownDrain.name);

  constructor(private readonly shutdownState: ShutdownState) {}

  async beforeApplicationShutdown(signal?: string): Promise<void> {
    this.logger.log(`Received ${signal}, draining for ${DRAIN_DELAY_MS} ms`);
    this.shutdownState.begin();
    await new Promise((resolve) => setTimeout(resolve, DRAIN_DELAY_MS));
  }
}

// search/services/search-index.service.ts - a client the app owns is closed after the server
@Injectable()
export class SearchIndexService implements OnApplicationShutdown {
  constructor(@Inject(SEARCH_CLIENT) private readonly client: SearchClient) {}

  async onApplicationShutdown(): Promise<void> {
    await this.client.close();
  }
}
```

BullMQ workers registered through `@nestjs/bullmq` close themselves on shutdown and finish the job in progress (see `micro-use-queues`).

Reference: [NestJS Lifecycle Events](https://docs.nestjs.com/fundamentals/lifecycle-events#application-shutdown)
