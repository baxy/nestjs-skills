---
title: Expose Liveness and Readiness Probes with Terminus
impact: MEDIUM-HIGH
impactDescription: The orchestrator restarts a stuck instance and routes traffic only to ready ones
tags: microservices, health-checks, terminus, kubernetes
---

## Expose Liveness and Readiness Probes with Terminus

Expose two probes with `@nestjs/terminus`, in a `health` module:

- **Liveness** (`GET /health/live`): is the process able to serve at all? Check nothing external.
- **Readiness** (`GET /health/ready`): can this instance take traffic now? Check the dependencies a request needs (database, Redis), and fail while shutting down (see `devops-graceful-shutdown`).

### Database health check

**TypeORM:** use `TypeOrmHealthIndicator`.

```typescript
() => this.db.pingCheck('database').withTimeout(1_000)
```

**Prisma:** use a small custom indicator that calls `$queryRaw` or a simple model query.

```typescript
async isHealthy(key: string): Promise<HealthIndicatorResult> {
  const indicator = this.healthIndicatorService.check(key);
  try {
    await this.prisma.$queryRaw`SELECT 1`;
    return indicator.up();
  } catch (error) {
    return indicator.down({ message: error instanceof Error ? error.message : 'Database unreachable' });
  }
}
```

### Shared rules

- `@Public()` and `@SkipThrottle()` on the health controller.
- `version: VERSION_NEUTRAL` when URI versioning is enabled.
- Liveness checks nothing external. Readiness checks database and other required dependencies.

**Incorrect (static OK, or a probe that checks everything):**

```typescript
@Get()
check(): string {
  return 'OK';
}
```

**Correct:** separate `/health/live` and `/health/ready` probes as described above.

Reference: [NestJS Terminus](https://docs.nestjs.com/recipes/terminus)
