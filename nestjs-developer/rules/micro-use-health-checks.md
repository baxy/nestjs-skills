---
title: Expose Liveness and Readiness Probes with Terminus
impact: MEDIUM-HIGH
impactDescription: The orchestrator restarts a stuck instance and routes traffic only to ready ones
tags: microservices, health-checks, terminus, kubernetes
---

## Expose Liveness and Readiness Probes with Terminus

Expose two probes with `@nestjs/terminus`, in a `health` module:

- **Liveness** (`GET /health/live`): is the process able to serve at all? Check nothing external. A database outage must not make the orchestrator restart every instance.
- **Readiness** (`GET /health/ready`): can this instance take traffic now? Check the dependencies a request needs (database, Redis), and fail while shutting down (see `devops-graceful-shutdown`).

The health controller opts out of the app's global behavior that does not apply to probes:

- `@Public()`: the orchestrator sends no token (see `security-use-guards`).
- `@SkipThrottle()`: probes run every few seconds (see `security-rate-limiting`).
- `version: VERSION_NEUTRAL` when URI versioning is enabled, so the probe path stays stable (see `api-versioning`).

A dependency without a built-in indicator gets a small custom one, built with `HealthIndicatorService` and returning `up()` or `down()`. Terminus 12 removed the old `HealthIndicator` base class and `HealthCheckError`: an indicator no longer reports failure by throwing. Give a built-in check its timeout with `.withTimeout(ms)`; the `timeout` option is deprecated. On NestJS 11 (Terminus 11), checks return a promise with no `.withTimeout()`: pass `{ timeout: 1_000 }` as the second argument instead.

**Incorrect (static OK, or a probe that checks everything):**

```typescript
@Controller('health')
export class HealthController {
  @Get()
  check(): string {
    return 'OK'; // Healthy while the database is unreachable
  }

  @Get('live')
  async live(): Promise<string> {
    await this.externalApi.ping(); // A third-party outage restarts every instance
    return 'OK';
  }
}
```

**Correct (separate probes, dependency checks only on readiness):**

```typescript
// health/controllers/health.controller.ts
@Public()
@SkipThrottle()
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
    private readonly redisHealthIndicator: RedisHealthIndicator,
    private readonly shutdownState: ShutdownState,
  ) {}

  @Get('live')
  @HealthCheck()
  live(): Promise<HealthCheckResult> {
    return this.health.check([]); // The process answers: that is all liveness means
  }

  @Get('ready')
  @HealthCheck()
  ready(): Promise<HealthCheckResult> {
    if (this.shutdownState.isShuttingDown()) {
      throw new ServiceUnavailableException('Shutting down');
    }
    return this.health.check([
      () => this.db.pingCheck('database').withTimeout(1_000),
      () => this.redisHealthIndicator.isHealthy('redis'),
    ]);
  }
}

// health/services/redis-health.indicator.ts
@Injectable()
export class RedisHealthIndicator {
  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const indicator = this.healthIndicatorService.check(key);
    try {
      await this.redis.ping();
      return indicator.up();
    } catch (error) {
      return indicator.down({ message: error instanceof Error ? error.message : 'Redis unreachable' });
    }
  }
}
```

```yaml
# Kubernetes probes
livenessProbe:
  httpGet: { path: /health/live, port: 3000 }
  periodSeconds: 10
  failureThreshold: 3
readinessProbe:
  httpGet: { path: /health/ready, port: 3000 }
  periodSeconds: 5
  failureThreshold: 2
startupProbe:
  httpGet: { path: /health/live, port: 3000 }
  periodSeconds: 5
  failureThreshold: 30
```

With a global prefix (`app.setGlobalPrefix('api')`), either exclude the health routes from it or use the prefixed path in the probes.

Reference: [NestJS Terminus](https://docs.nestjs.com/recipes/terminus)
