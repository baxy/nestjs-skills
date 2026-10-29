---
title: Load Configuration Through Namespaced Config Files
impact: HIGH
impactDescription: Every setting has one typed home, and a misconfigured service refuses to start instead of failing at runtime
tags: devops, configuration, environment, validation, registerAs
---

## Load Configuration Through Namespaced Config Files

Use `@nestjs/config` with **one config file per concern**. Each file maps environment variables to one namespace with `registerAs`, and the rest of the code reads settings through that namespace. `process.env` is read in exactly one place: the files in `src/config/`.

### Database configuration

**TypeORM:** map `DB_*` variables into a `db` namespace and pass them to `TypeOrmModule.forRootAsync`. Hardcode `synchronize: false`. Use `SnakeNamingStrategy` (see `db-typeorm-entity-conventions` and `db-typeorm-migrations`).

**Prisma:** the connection string is usually `DATABASE_URL` (or a namespaced equivalent). The Prisma client reads it at startup. Still validate the required variables in `validate-env.ts`. Migrations run via `prisma migrate deploy` as a deploy step (see `db-prisma-migrations`).

### Shared rules

- `src/config/` is a folder, not a module. No `config.module.ts`.
- One file per concern: `app.config.ts`, `db.config.ts` (or `database.config.ts`), `auth.config.ts`, etc.
- Environment variables use prefixes (`APP_`, `DB_`, `AUTH_`, etc.).
- Validate required variables at load with the `validate` hook.
- Inject namespaces with `@Inject(xConfig.KEY)` when a provider needs several values.
- Never pass raw environment variable names to `ConfigService`.

**Incorrect (scattered env access, raw keys):**

```typescript
private readonly apiKey = process.env.SENDGRID_API_KEY || 'default';
const secret = this.configService.get('JWT_SECRET');
```

**Correct (namespaced, validated):**

```typescript
// src/config/db.config.ts
export const dbConfig = registerAs('db', () => ({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  // ...
}));

// validate-env.ts
const REQUIRED = ['DB_HOST', 'DB_USERNAME', 'DB_PASSWORD', 'DB_NAME'] as const;
```

For Prisma projects, include `DATABASE_URL` in `REQUIRED` if that is how the client is configured.

Reference: [NestJS Configuration](https://docs.nestjs.com/techniques/configuration)
