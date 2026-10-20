---
title: Keep HTTP Code Platform-Agnostic
impact: MEDIUM-HIGH
impactDescription: The same controllers, guards, filters and tests run on Express and Fastify
tags: api, platform, express, fastify, http-adapter, cors
---

## Keep HTTP Code Platform-Agnostic

NestJS runs on Express (`@nestjs/platform-express`) or Fastify (`@nestjs/platform-fastify`). Choose the adapter in exactly two places, `main.ts` and the test app helper (see `test-use-testing-module`), and keep every controller, guard, interceptor, filter, decorator and test free of adapter-specific APIs. Code written against Express APIs compiles on Fastify but fails at runtime, and the reverse is also true.

- **No platform response API in handlers.** Do not use `@Res()` with `res.status().json()` (Express) or `reply.code().send()` (Fastify). Return values; use `@HttpCode()`/`@Header()` for static status and headers, and `StreamableFile` for file content.
- **`HttpAdapterHost` in filters and interceptors.** `httpAdapter.reply()`, `httpAdapter.setHeader()`, `httpAdapter.getRequestUrl()` and `httpAdapter.getRequestMethod()` work on both (see `error-use-exception-filters`).
- **Type requests with a neutral shape.** Use a small `AppRequest` type with what both platforms provide (`method`, `url`, `headers`, `ip`, `query`, plus your `user`), never `Request` from `express` or `FastifyRequest`.
- **Middleware works on raw Node objects.** On Fastify, Nest middleware receives Node's `IncomingMessage`/`ServerResponse`; Express's objects extend them. Write middleware against Node's types (`res.statusCode`, `res.end()`), or prefer guards and interceptors.
- **Plugins differ per platform.** Register them in `main.ts` only, with the package for the adapter in use:

  | Concern | Express | Fastify |
  |---|---|---|
  | Security headers | `helmet` via `app.use()` | `@fastify/helmet` via `app.register()` |
  | Compression | `compression` via `app.use()` | `@fastify/compress` via `app.register()` |
  | Cookies | `cookie-parser` | `@fastify/cookie` |
  | Multipart uploads | `nestjs-form-data` (both, see `api-file-uploads`) | `nestjs-form-data` |
  | Trust the proxy (real client IP behind a load balancer) | `app.set('trust proxy', 1)` | `new FastifyAdapter({ trustProxy: true })` |

- **List CORS methods explicitly.** `app.enableCors()` works on both, but the defaults differ: `@fastify/cors` allows only `GET,HEAD,POST`, so a `PUT`, `PATCH` or `DELETE` endpoint fails the browser preflight. Listing `methods` makes both behave the same. Verify a new method with an `OPTIONS` request carrying `Access-Control-Request-Method`.
- **Listen on all interfaces**: `app.listen(port, host)` with `app.host` defaulting to `'0.0.0.0'` (see `devops-use-config-module`). Fastify defaults to `127.0.0.1`, which is unreachable from outside a container; on Express it is harmless.

**Incorrect (platform APIs outside main.ts):**

```typescript
import { Request, Response } from 'express';

@Controller('users')
export class UserController {
  @Get(':id')
  async findById(@Param() params: UserIdParamDto, @Res() res: Response) {
    res.status(200).json(await this.userService.findById(params.id)); // Express-only, breaks on Fastify
  }
}

@Injectable()
export class DeprecationInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler) {
    context.switchToHttp().getResponse<FastifyReply>().header('Deprecation', 'true'); // Fastify-only
    return next.handle();
  }
}

export const AuthUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<Request>().user;   // Express type in shared code
});
```

**Correct (adapter chosen in main.ts, neutral code everywhere else):**

```typescript
// shared/types/app-request.ts - what code may rely on, on any adapter
import { IncomingHttpHeaders } from 'node:http';

export interface AppRequest {
  method: string;
  url: string;
  headers: IncomingHttpHeaders;
  ip?: string;
  query?: unknown;
  user?: JwtUser; // Set by JwtStrategy (see security-auth-jwt)
}

// main.ts - the only production file that knows the adapter
async function bootstrap() {
  // Express: NestFactory.create(AppModule, { bufferLogs: true })
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter({ trustProxy: true }), {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));            // nestjs-pino (see devops-use-logging)
  const configService = app.get(ConfigService);

  await app.register(helmet);                // Express: app.use(helmet())
  app.enableCors({
    origin: configService.getOrThrow<string[]>('app.corsOrigins'),
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'], // Same behavior on both adapters
  });
  configureApp(app);                         // Pipes, filter, interceptors (see test-use-testing-module)
  app.enableShutdownHooks();                 // See devops-graceful-shutdown
  await app.listen(configService.getOrThrow<number>('app.port'), configService.getOrThrow<string>('app.host'));
}

// Handlers return values; files go through StreamableFile
@Controller('users')
export class UserController {
  @Get(':id')
  findById(@Param() params: UserIdParamDto): Promise<User> {
    return this.userService.findById(params.id);
  }
}

// Interceptors and filters use HttpAdapterHost
@Injectable()
export class DeprecationInterceptor implements NestInterceptor {
  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const response = context.switchToHttp().getResponse();
    this.httpAdapterHost.httpAdapter.setHeader(response, 'Deprecation', 'true');
    return next.handle();
  }
}

// Decorators and guards use the neutral request type (see api-custom-param-decorators)
export const AuthUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): JwtUser | undefined => {
  return ctx.switchToHttp().getRequest<AppRequest>().user;
});
```

```bash
# Verify the preflight after adding a PATCH endpoint
curl -i -X OPTIONS https://api.example.com/api/users/00000000-0000-0000-0000-000000000000 \
  -H 'Origin: https://app.example.com' \
  -H 'Access-Control-Request-Method: PATCH'
# access-control-allow-methods must include PATCH
```

Reference: [NestJS HTTP adapter](https://docs.nestjs.com/faq/http-adapter) · [NestJS Fastify](https://docs.nestjs.com/techniques/performance) · [@fastify/cors](https://github.com/fastify/fastify-cors)
