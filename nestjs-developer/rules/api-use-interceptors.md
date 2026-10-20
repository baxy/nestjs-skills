---
title: Shape Responses and Cross-Cutting Concerns with Interceptors
impact: MEDIUM-HIGH
impactDescription: Every success response has one shape, and handlers stay free of logging and wrapping code
tags: api, interceptors, response-envelope, logging, timeout
---

## Shape Responses and Cross-Cutting Concerns with Interceptors

Controllers return the service result as-is. Everything that applies to every route (the response envelope, request logging, timeouts) lives in an interceptor registered once in `configureApp()` (see `test-use-testing-module`), so tests run it too.

### The response envelope

Every successful JSON response has the same shape, produced by `ResponseEnvelopeInterceptor`. Errors get the matching shape from the global exception filter (see `error-use-exception-filters`):

```json
{ "success": true,  "statusCode": 200, "data": { "id": "..." } }
{ "success": true,  "statusCode": 200, "data": [ ... ], "meta": { "totalCount": 42, "limit": 20, "offset": 0 } }
{ "success": false, "statusCode": 404, "error": "Not Found", "message": "Order #... not found" }
```

- A paginated service result (`PaginatedResult<T>`, `{ result, count, limit, offset }`, see `perf-optimize-database`) becomes `data` + `meta`.
- `StreamableFile` (downloads, see `api-controller-conventions`) passes through unwrapped, and so does an empty body (`204`).
- Never build `{ data: ... }` or `{ success: ... }` in a controller or service.

### Where interceptors sit in a request

Nest runs every request in this order: middleware, guards, interceptors (before the handler), pipes, the handler, interceptors (after, innermost first), exception filters. Within each kind, global runs before controller-level, which runs before route-level. Other rules rely on this:

- Guards run before pipes, so a guard sees raw, unvalidated params and body. It decides from the caller and the route metadata, never from the input (see `security-use-guards`).
- An exception thrown by a guard skips every interceptor, and a request to an unknown route never reaches one, so `LoggingInterceptor` never sees a 401, 403, 429 (the throttler is a guard) or a 404 for a missing route. The exception filter is the one place that sees every error, so it writes the log line for every failed request and `LoggingInterceptor` logs successes only (see `error-use-exception-filters`).
- Pipes run after interceptors start, so an interceptor sees the request before `ValidationPipe` has transformed it.

### Order of global interceptors

`configureApp()` lists them outermost first: `LoggingInterceptor`, then `ResponseEnvelopeInterceptor`, then `ClassSerializerInterceptor` (see `api-use-dto-serialization`). The serializer, innermost, turns the entity or response DTO into a plain object first; the envelope then wraps that.

**Incorrect (logging and wrapping repeated in handlers):**

```typescript
@Controller('users')
export class UserController {
  private readonly logger = new Logger(UserController.name);

  @Get(':id')
  async findById(@Param() params: UserIdParamDto) {
    const start = Date.now();
    const user = await this.userService.findById(params.id);
    this.logger.log(`findById completed in ${Date.now() - start}ms`); // Repeated in every handler
    return { data: user, meta: { timestamp: new Date() } };            // Ad-hoc wrapper, different per endpoint
  }
}
```

**Correct (one interceptor per concern, registered in configureApp):**

```typescript
// shared/interceptors/response-envelope.interceptor.ts
export interface ApiResponseMeta {
  totalCount: number;
  limit?: number;
  offset?: number;
}

export interface ApiSuccessResponse<T> {
  success: true;
  statusCode: number;
  data: T;
  meta?: ApiResponseMeta;
}

@Injectable()
export class ResponseEnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((body: unknown) => {
        if (body instanceof StreamableFile || body === undefined) {
          return body; // Files and empty 204 responses are not wrapped
        }

        const statusCode: number = context.switchToHttp().getResponse().statusCode;
        if (this._isPaginated(body)) {
          return {
            success: true,
            statusCode,
            data: body.result,
            meta: { totalCount: body.count, limit: body.limit, offset: body.offset },
          } satisfies ApiSuccessResponse<unknown[]>;
        }
        return { success: true, statusCode, data: body } satisfies ApiSuccessResponse<unknown>;
      }),
    );
  }

  private _isPaginated(body: unknown): body is PaginatedResult<unknown> {
    const candidate = body as PaginatedResult<unknown> | null;
    return typeof candidate === 'object' && candidate !== null
      && Array.isArray(candidate.result) && typeof candidate.count === 'number';
  }
}

// shared/interceptors/logging.interceptor.ts - one line per successful request; failed requests are
// logged by the exception filter, which also sees guard rejections. requestId comes from the
// pino mixin (see devops-use-logging), never from the message text
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AppRequest>();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap(() => {
        const { statusCode } = context.switchToHttp().getResponse();
        this.logger.log(`${request.method} ${request.url} ${statusCode} ${Date.now() - startedAt}ms`);
      }),
    );
  }
}

// shared/interceptors/timeout.interceptor.ts - applied per route or controller where a limit matters
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(private readonly timeoutMs: number) {}

  intercept(_context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      timeout(this.timeoutMs),
      catchError((error: unknown) => {
        throw error instanceof TimeoutError ? new RequestTimeoutException('Request timed out') : error;
      }),
    );
  }
}

@UseInterceptors(new TimeoutInterceptor(10_000)) // Report rendering may take up to 10 s
@Controller('reports')
export class ReportController {}
```

Error translation (database errors to 409, domain errors to 404) belongs in the exception filter, not in an interceptor. Response caching uses the built-in `CacheInterceptor` (see `perf-use-caching`).

Reference: [NestJS Interceptors](https://docs.nestjs.com/interceptors)
