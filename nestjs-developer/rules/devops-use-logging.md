---
title: Use Structured Logging
impact: MEDIUM-HIGH
impactDescription: Structured logging enables effective debugging and monitoring
tags: devops, logging, structured-logs, pino, correlation
---

## Use Structured Logging

Log structured JSON through `nestjs-pino`, and never use `console.log`. Every line should carry the request's correlation fields automatically, so a request can be followed across log lines and services by filtering on a field.

- **Hand Nest the pino logger at bootstrap**: create the app with `bufferLogs: true`, then call `app.useLogger(app.get(Logger))`. Without this, lines logged during startup (module init, dependency injection errors) are printed by Nest's default text logger before pino takes over, and those are exactly the lines you need when a deploy fails.
- **Application code keeps using `new Logger(MyService.name)`** from `@nestjs/common`. It delegates to pino once `useLogger` is set, so services never import pino.
- **Correlation IDs are fields, not text.** A pino `mixin` adds `requestId` (from the request context) and, where available, a trace ID to every line. Never append them to the message string; filter on the field instead (`filter requestId = "..."`). Return the request ID to clients in an `x-request-id` response header so they can quote it.
- **JSON in deployed environments, pretty output locally**: `app.env` (`APP_ENV`, see `devops-use-config-module`) is `production` in deployed images; any other environment uses single-line `pino-pretty`.
- **Redact secrets** (authorization headers, passwords, tokens) in the pino config, and never log request bodies wholesale.
- **The one `console` exception: process crash handlers.** `uncaughtException` and `unhandledRejection` handlers in `main.ts` write a fixed marker with `console.error`, on purpose: they must work even when the logger is what failed, and alerting can match the literal marker. Do not convert them to the structured logger.

**Incorrect (console logging, ids inside messages, logger set up too late):**

```typescript
@Injectable()
export class UserService {
  async create(dto: CreateUserDto): Promise<User> {
    console.log('Creating user:', dto);                       // Unstructured, logs the whole body
    const user = await this.userRepository.save(await this._toEntity(dto));
    this.logger.log(`[${this.cls.getId()}] User ${user.id} created`); // requestId baked into text
    return user;
  }
}

console.log('Login attempt:', { email, password });          // Secret in the logs

// main.ts - no bufferLogs: startup lines bypass pino
const app = await NestFactory.create(AppModule);
app.useLogger(app.get(Logger));
```

**Correct (pino with a request-context mixin, Nest Logger in app code):**

```typescript
// logging/logger.module.ts
export function buildLoggerModule(): DynamicModule {
  return LoggerModule.forRootAsync({
    inject: [ClsService, appConfig.KEY],
    useFactory: (cls: ClsService, appSettings: ConfigType<typeof appConfig>): Params => ({
      pinoHttp: {
        autoLogging: false,          // A logging interceptor logs request start/finish
        base: undefined,             // Drop pid/hostname noise
        quietReqLogger: true,
        mixin: () => ({ requestId: cls.getId() }), // On every line, no call-site work
        redact: ['req.headers.authorization', '*.password', '*.token'],
        transport:
          appSettings.env === 'production'
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true } },
      },
    }),
  });
}

// app.module.ts
@Module({
  imports: [
    ClsModule.forRoot({
      global: true,
      middleware: {
        mount: true,
        generateId: true,
        idGenerator: (req) => (req.headers['x-request-id'] as string) ?? randomUUID(),
      },
    }),
    buildLoggerModule(),
  ],
})
export class AppModule {}

// main.ts
process.on('uncaughtException', (error) => {
  console.error('[users-api-alert] uncaught exception:', error); // Intentional: must survive logger failure
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('[users-api-alert] unhandled rejection:', reason);
});

async function bootstrap() {
  // Fastify: NestFactory.create(AppModule, new FastifyAdapter(), { bufferLogs: true })
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true, // Hold startup lines until pino is installed
  });
  app.useLogger(app.get(Logger)); // nestjs-pino Logger
  // ... rest of bootstrap (see api-platform-agnostic)
}

// Application code: Nest Logger, message only - requestId comes from the mixin
@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  async create(dto: CreateUserDto): Promise<User> {
    const user = await this.userRepository.save(await this._toEntity(dto)); // _toEntity hashes the password (see security-hash-passwords)
    this.logger.log(`User ${user.id} created`);
    return user;
  }
}
```

```text
# CloudWatch Logs Insights (or any JSON log search)
fields @timestamp, level, msg
| filter requestId = "3f0c..."
| sort @timestamp asc
```

Reference: [NestJS Logger](https://docs.nestjs.com/techniques/logger) · [nestjs-pino](https://github.com/iamolegga/nestjs-pino)
