---
title: Keep Providers Singleton and Request Context in CLS
impact: CRITICAL
impactDescription: Prevents one request's data leaking into another and the cost of request-scoped dependency chains
tags: dependency-injection, scopes, request-context, cls
---

## Keep Providers Singleton and Request Context in CLS

Nest has three provider scopes: `DEFAULT` (one instance for the app), `REQUEST` (one per request) and `TRANSIENT` (one per consumer). Providers are singletons. Two mistakes follow from forgetting that:

- **Per-request state in a singleton field.** Concurrent requests overwrite each other, and one caller sees another's data.
- **`Scope.REQUEST` to get at the request.** Request scope bubbles up: every provider that injects a request-scoped one becomes request-scoped too, and the whole chain is rebuilt on every request.

Request context reaches code in one of two ways:

- Passed as a parameter: the caller is `authUser: JwtUser`, the first parameter of every service method that acts on behalf of a caller (see `arch-service-conventions`).
- Read from CLS (`nestjs-cls`, set up in `devops-use-logging`) for cross-cutting values such as the request ID, which the logger already adds to every line.

Use `Scope.REQUEST` only for a provider that wraps a per-request resource and cannot work otherwise, such as a GraphQL DataLoader (see `db-avoid-n-plus-one`).

**Incorrect (request state in a singleton, request scope for context):**

```typescript
@Injectable() // Singleton
export class RequestContextService {
  private userId: string; // Shared by every concurrent request

  setUser(userId: string): void {
    this.userId = userId; // Request B overwrites request A's caller
  }
}

@Injectable({ scope: Scope.REQUEST }) // Makes every consumer request-scoped too
export class AuditService {
  constructor(@Inject(REQUEST) private readonly request: AppRequest) {}

  record(action: string): void {
    // ...this.request.user
  }
}
```

**Correct (caller as a parameter, cross-cutting values from CLS):**

```typescript
@Injectable() // Stays singleton
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditEntry)
    private readonly auditEntryRepository: Repository<AuditEntry>,
    private readonly cls: ClsService,
  ) {}

  async record(authUser: JwtUser, action: string): Promise<void> {
    await this.auditEntryRepository.save({ userId: authUser.id, action, requestId: this.cls.getId() });
    this.logger.log(`Audit entry recorded: ${action}`); // requestId is added to the line by the logger mixin
  }
}
```

Reference: [NestJS Injection Scopes](https://docs.nestjs.com/fundamentals/injection-scopes) · [nestjs-cls](https://papooch.github.io/nestjs-cls/)
