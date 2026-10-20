---
title: Implement Rate Limiting
impact: HIGH
impactDescription: Protects against abuse and ensures fair resource usage
tags: security, rate-limiting, throttler, protection
---

## Implement Rate Limiting

Use `@nestjs/throttler` to limit request rates per client, with stricter limits on endpoints that check credentials or send messages (logins, password resets, invitations).

Register `ThrottlerGuard` globally (an `APP_GUARD` after the authentication guards, see `security-use-guards`) so the tracker can use the caller's id. Health probes skip it (see `micro-use-health-checks`). Behind a load balancer, the client IP is only correct once the proxy is trusted (see `api-platform-agnostic`). In a deployment with several instances, use a shared storage (Redis) so limits apply across instances.

**Incorrect (no limits on credential endpoints, one limit for everything):**

```typescript
@Controller('sessions')
export class SessionController {
  @Public()
  @Post()
  create(@Body() dto: CreateSessionDto): Promise<SessionResponseDto> {
    return this.sessionService.create(dto); // Unlimited: credentials can be brute-forced
  }
}

@Controller('password-resets')
export class PasswordResetController {
  @Public()
  @Post()
  create(@Body() dto: CreatePasswordResetDto): Promise<void> {
    return this.passwordResetService.create(dto); // Can be used to flood a user with emails
  }
}
```

**Correct (global throttler, stricter limits on credential endpoints):**

```typescript
// app.module.ts
@Module({
  imports: [
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1_000, limit: 10 },   // Bursts
      { name: 'long', ttl: 60_000, limit: 300 },  // Sustained use
    ]),
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: UserThrottlerGuard },
  ],
})
export class AppModule {}

// shared/guards/user-throttler.guard.ts - authenticated callers are limited per user, others per IP
@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(request: AppRequest): Promise<string> {
    return request.user?.id ?? request.ip ?? 'unknown';
  }
}

// auth/controllers/session.controller.ts - POST /sessions logs in (see api-controller-conventions)
@Controller('sessions')
export class SessionController {
  @Public()
  @Throttle({ long: { limit: 5, ttl: 60_000 } }) // 5 attempts per minute
  @Post()
  create(@Body() dto: CreateSessionDto): Promise<SessionResponseDto> {
    return this.sessionService.create(dto);
  }
}

// auth/controllers/password-reset.controller.ts
@Controller('password-resets')
export class PasswordResetController {
  @Public()
  @Throttle({ long: { limit: 3, ttl: 3_600_000 } }) // 3 per hour
  @HttpCode(HttpStatus.ACCEPTED)
  @Post()
  create(@Body() dto: CreatePasswordResetDto): Promise<void> {
    return this.passwordResetService.create(dto);
  }
}
```

Reference: [NestJS Throttler](https://docs.nestjs.com/security/rate-limiting)
