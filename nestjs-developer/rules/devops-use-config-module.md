---
title: Load Configuration Through Namespaced Config Files
impact: HIGH
impactDescription: Every setting has one typed home, and a misconfigured service refuses to start instead of failing at runtime
tags: devops, configuration, environment, validation, registerAs
---

## Load Configuration Through Namespaced Config Files

Use `@nestjs/config` with **one config file per concern**. Each file maps environment variables to one namespace with `registerAs`, and the rest of the code reads settings through that namespace. `process.env` is read in exactly one place: the files in `src/config/`.

**Files and namespaces:**

- `src/config/{concern}.config.ts` exports `{concern}Config = registerAs('{namespace}', () => ({ ... }))`. The folder is flat (see `arch-feature-modules`).
- Shared concerns use the same namespace and shape in every service: `app` (`env`, `port`, `host`, `corsOrigins`), `auth`, `db` (`host`, `port`, `username`, `password`, `name`, `schema`, `logging`, `ssl`), `aws`, `eventBridge`, `redis`. A setting that belongs to this service alone goes in a namespace named for the service or the concern (`studio`, `mail`, `platform`), never into `app`.
- Environment variables are grouped by prefix per concern (`APP_`, `DB_`, `AWS_`, `AUTH_`, `EVENT_BRIDGE_`, `REDIS_`). Every authentication setting uses `AUTH_` (`AUTH_JWT_SECRET`), whichever identity provider issues the tokens: a provider-specific prefix such as `AUTH0_` ties the names to one vendor. Defaults and parsing (`parseInt(..., 10)`, `=== 'true'`, splitting lists) happen in the config file, so consumers receive typed values.
- All files are loaded once, in `AppModule`: `ConfigModule.forRoot({ isGlobal: true, load: [...], validate: validateEnv })`.

**Required values are validated at load.** A config file that defaults a missing variable to `''` hides it: `getOrThrow` treats an empty string as defined, so the service starts, passes its health check and fails every request. `src/config/validate-env.ts` lists the variables the service cannot run without and refuses to start when one is missing or malformed. Because it is the `validate` hook of `ConfigModule`, it runs wherever `AppModule` is built: the app itself and the integration tier (e2e testing modules do not import `AppModule`, see `test-use-testing-module`).

**Reading settings:**

- Required value: `configService.getOrThrow<string>('auth.jwt.secret')`.
- Optional value: `configService.get<boolean>('db.logging', false)`, always with the default at the call site.
- Several values of one namespace in a provider: inject the namespace itself, `@Inject(mailConfig.KEY) private readonly mailSettings: ConfigType<typeof mailConfig>`, which is fully typed. Import the type with `import type { ConfigType } from '@nestjs/config'`: the `tsconfig.json` that `nest new` generates (NestJS 11 and 12) enables `isolatedModules` with `emitDecoratorMetadata`, and a value import used in a decorated constructor fails with TS1272. Name the parameter `{namespace}Settings`, never the same as the config constant: `typeof mailConfig` would then refer to the parameter itself and fail to compile (TS2502).
- Module factories (`forRootAsync`, `registerAsync`) follow the same rule: `inject: [dbConfig.KEY]` with a `dbSettings` parameter, not `ConfigService` with one `getOrThrow` per key.
- Keys are always namespaced paths (`db.host`, `auth.jwt.issuer`). Never pass a raw environment variable name (`'DB_HOST'`, `'JWT_SECRET'`) to `ConfigService`.

**Exceptions to "process.env only in src/config/":**

- The migration `DataSource` (`migrations/type-orm/config.ts`), which the TypeORM CLI runs outside Nest (see `db-entity-conventions`).
- A value read before `ConfigModule` exists or that must not get the config file's default, with a comment saying why (for example choosing an authentication guard from the raw `APP_ENV`, where the config default `'development'` would weaken auth in a deployed environment).

**Incorrect (scattered env access, raw keys, silent empty defaults):**

```typescript
@Injectable()
export class MailService {
  private readonly apiKey = process.env.SENDGRID_API_KEY || 'default'; // Env read outside src/config, fake default
}

@Injectable()
export class TokenService {
  constructor(private readonly configService: ConfigService) {}

  sign(payload: object): string {
    const secret = this.configService.get('JWT_SECRET'); // Raw env name, no namespace, may be undefined
    // ...
  }
}

// app.module.ts - nothing checks that required variables are set
ConfigModule.forRoot({ isGlobal: true });
```

**Correct (one file per concern, validated at load, namespaced reads):**

```typescript
// src/config/app.config.ts
export const appConfig = registerAs('app', () => ({
  env: process.env.APP_ENV || 'development',
  port: parseInt(process.env.APP_PORT || '3000', 10),
  host: process.env.APP_HOST || '0.0.0.0',
  corsOrigins: (process.env.APP_CORS_ORIGINS || '').split(',').filter(Boolean),
}));

// src/config/db.config.ts
export const dbConfig = registerAs('db', () => ({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || '',
  password: process.env.DB_PASSWORD || '',
  name: process.env.DB_NAME || '',
  schema: process.env.DB_SCHEMA || 'public',
  logging: process.env.DB_LOGGING === 'true',
  ssl: process.env.DB_SSL === 'true',
}));

// src/config/mail.config.ts - a concern only this service has
export const mailConfig = registerAs('mail', () => ({
  apiKey: process.env.MAIL_API_KEY || '',
  from: process.env.MAIL_FROM || 'no-reply@example.com',
}));

// src/config/validate-env.ts - runs as ConfigModule loads, before any provider is built
const REQUIRED = ['DB_HOST', 'DB_USERNAME', 'DB_PASSWORD', 'DB_NAME', 'MAIL_API_KEY'] as const;

export function validateEnv(env: Record<string, unknown>): Record<string, unknown> {
  const missing = REQUIRED.filter((name) => !String(env[name] ?? '').trim());
  if (missing.length > 0) {
    throw new Error(`Refusing to start: ${missing.join(', ')} must be set`);
  }
  return env;
}

// app.module.ts
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, dbConfig, mailConfig],
      validate: validateEnv,
    }),
    TypeOrmModule.forRootAsync({
      inject: [dbConfig.KEY],
      useFactory: (dbSettings: ConfigType<typeof dbConfig>) => ({
        type: 'postgres',
        host: dbSettings.host,
        port: dbSettings.port,
        username: dbSettings.username,
        password: dbSettings.password,
        database: dbSettings.name,
        schema: dbSettings.schema,
        logging: dbSettings.logging,
        ssl: dbSettings.ssl,
        autoLoadEntities: true,
        namingStrategy: new SnakeNamingStrategy(), // Required, see db-entity-conventions
        synchronize: false, // Hardcoded, never from config: schema changes go through migrations (see db-use-migrations)
      }),
    }),
  ],
})
export class AppModule {}

// A provider that needs several values of one namespace injects the namespace
@Injectable()
export class MailService {
  constructor(@Inject(mailConfig.KEY) private readonly mailSettings: ConfigType<typeof mailConfig>) {}

  async send(to: string, subject: string, body: string): Promise<void> {
    await this._client().send({ from: this.mailSettings.from, to, subject, body });
  }

  private _client(): MailClient { /* ... uses this.mailSettings.apiKey */ }
}
```

Reference: [NestJS Configuration](https://docs.nestjs.com/techniques/configuration) · [Configuration namespaces](https://docs.nestjs.com/techniques/configuration#configuration-namespaces)
