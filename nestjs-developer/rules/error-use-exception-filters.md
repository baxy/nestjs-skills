---
title: Format Every Error in One Global Exception Filter
impact: HIGH
impactDescription: Consistent error responses, with internals logged and never sent
tags: error-handling, exception-filters, consistency, platform-agnostic
---

## Format Every Error in One Global Exception Filter

Never catch exceptions and format error responses in controllers. Services throw typed exceptions (see `error-throw-http-exceptions`), and **one** global filter, `AllExceptionsFilter`, turns every error into the error half of the response envelope (see `api-use-interceptors`):

```json
{ "success": false, "statusCode": 404, "error": "Not Found", "message": "User #00000000-0000-0000-0000-000000000000 not found" }
```

- Register it in `configureApp()` (`app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost)))`, see `test-use-testing-module`), so e2e tests get the same error shape. Do not add a second filter per error type; extend this one.
- Write it with `HttpAdapterHost` (`httpAdapter.reply(...)`) instead of Express's `response.status().json()`, so it works on Express and Fastify (see `api-platform-agnostic`).
- Read the message from `exception.getResponse()`, not `exception.message`: for `ValidationPipe` errors it holds the per-field messages, while `exception.message` is just "Bad Request Exception".
- Translate known non-HTTP errors here: a unique violation (`QueryFailedError` with PostgreSQL code `23505`) becomes 409, a domain error class shared with non-HTTP consumers becomes its status. Match on error codes, never on message text.
- Unknown errors become a generic 500. Log the stack and the `cause`; never send either to the client.
- When translating a lower-level error yourself, keep it as the `cause` so logs show the root cause.

**Incorrect (manual error handling in controllers, Express-only filters):**

```typescript
@Controller('users')
export class UserController {
  @Get(':id')
  async findById(@Param() params: UserIdParamDto, @Res() res: Response) {
    try {
      const user = await this.userService.findById(params.id);
      return res.json(user);
    } catch (error) {
      this.logger.error(error);
      return res.status(500).json({ statusCode: 500, message: 'Internal server error' });
    }
  }
}

// Express-only and loses validation details
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const message = exception instanceof HttpException ? exception.message : 'Internal server error';
    response.status(status).json({ statusCode: status, message }); // Breaks on Fastify
  }
}
```

**Correct (one platform-agnostic global filter with the envelope shape):**

```typescript
// Services throw; the cause stays on the exception for logging
@Injectable()
export class PaymentService {
  async charge(order: Order): Promise<void> {
    try {
      await this.paymentClient.charge(order.id, order.total);
    } catch (error) {
      throw new ServiceUnavailableException('Payment provider unavailable', { cause: error });
    }
  }
}

// shared/filters/all-exceptions.filter.ts
export interface ApiErrorResponse {
  success: false;
  statusCode: number;
  error: string;
  message: string | string[];
}

const PG_UNIQUE_VIOLATION = '23505';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();
    const statusCode = this._status(exception);

    if (statusCode >= 500) {
      this.logger.error(
        `${httpAdapter.getRequestMethod(request)} ${httpAdapter.getRequestUrl(request)}`,
        exception instanceof Error ? exception.stack : exception,
      );
      if (exception instanceof Error && exception.cause) {
        this.logger.error('Caused by', exception.cause);
      }
    }

    const body: ApiErrorResponse = {
      success: false,
      statusCode,
      error: this._errorName(statusCode),
      message: this._message(exception, statusCode),
    };

    httpAdapter.reply(ctx.getResponse(), body, statusCode);
  }

  private _status(exception: unknown): number {
    if (exception instanceof HttpException) return exception.getStatus();
    if (exception instanceof EntityNotFoundException) return HttpStatus.NOT_FOUND;
    if (exception instanceof QueryFailedError && exception.driverError?.code === PG_UNIQUE_VIOLATION) {
      return HttpStatus.CONFLICT;
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  // getResponse() keeps ValidationPipe's per-field messages; .message would not
  private _message(exception: unknown, statusCode: number): string | string[] {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'string') return response;
      return (response as { message?: string | string[] }).message ?? exception.message;
    }
    if (exception instanceof EntityNotFoundException) return exception.message;
    if (statusCode === HttpStatus.CONFLICT) return 'Resource already exists';
    return 'Internal server error';
  }

  private _errorName(statusCode: number): string {
    const name = HttpStatus[statusCode];
    return name ? name.toLowerCase().split('_').map((word) => word[0].toUpperCase() + word.slice(1)).join(' ') : 'Error';
  }
}
```

Reference: [NestJS Exception Filters](https://docs.nestjs.com/exception-filters) · [Catch everything](https://docs.nestjs.com/exception-filters#catch-everything) · [PostgreSQL error codes](https://www.postgresql.org/docs/current/errcodes-appendix.html)
