---
name: nestjs-developer
description: NestJS coding conventions and best practices covering modules and folder layout, naming, dependency injection, REST controllers, DTOs and validation, TypeORM entities and migrations on PostgreSQL, Swagger/OpenAPI, error handling, security, testing tiers, logging and code style. Use when writing, generating or refactoring NestJS code (modules, controllers, services, DTOs, guards, interceptors, entities, migrations, tests, main.ts), or when working in a project that depends on @nestjs packages. For reviewing existing code or pull requests, use nestjs-reviewer.
metadata:
  version: "1.1.0"
---

# NestJS Developer

Conventions for building NestJS applications. Each rule lives in `rules/<rule-id>.md` with the reasoning, an incorrect example and a correct example. Where a rule differs from generic NestJS advice or from the NestJS docs' defaults, follow the rule.

## Assumed stack

The rules are written for NestJS 12 on Express or Fastify, TypeORM on PostgreSQL, `class-validator`/`class-transformer`, `@nestjs/swagger`, Vitest or Jest with `supertest`, and `nestjs-pino`. When the project uses a different library for one of these (Prisma, Mongoose, Zod...), keep the project's library and apply the intent of the rule.

The examples are CommonJS-style imports without file extensions and use Jest's mock API (`jest.fn()`); `vi.fn()` and the rest of Vitest's API map one-to-one. `references/` holds what depends on the project's setup:

- `references/project-setup.md`: how to read an existing project's setup, how to start a new one, and what changes in an ESM project (`.js` import extensions, `Relation<>` on entities, the TypeORM CLI).
- `references/test-runner-vitest.md` and `references/test-runner-jest.md`: tier configs, scripts and the Jest-to-Vitest mapping.

## How to use

1. Check the project's `package.json` first: `"type": "module"` means ESM, and the test runner is whichever of `vitest` or `jest` it lists. Keep both as they are; for an ESM project, read `references/project-setup.md` before writing code. When no `package.json` is available, follow what the existing files show (`.js` import extensions, `vi.` or `jest.`); with no files at all it is a new project (ESM with Vitest). State the assumption in your answer.
2. Find the task in the table below and **read every rule file listed for it before writing code**. The one-line summaries in the index are reminders, not the rule.
3. The `style-` rules apply to every file, comment, message and doc you write. Read `style-code-comments` before writing code: the comments in the rule examples are notes for you, not part of the pattern.
4. Each example focuses on one rule and may leave out unrelated decorators (Swagger, guards) for brevity. Apply all relevant rules together.

| Task | Rules to read |
|---|---|
| New project | `references/project-setup.md` (`nest new`, ESM with Vitest), `references/test-runner-vitest.md`, `test-organize-by-tier`, `test-use-testing-module` (`configureApp()`), `devops-use-config-module`, `arch-import-boundaries` |
| New feature module | `arch-feature-modules`, `arch-import-boundaries`, `arch-module-sharing`, `arch-avoid-circular-deps`, `arch-service-conventions`, `arch-data-access-in-services` |
| New or changed service or provider | `arch-service-conventions`, `arch-single-responsibility`, `arch-data-access-in-services`, `di-prefer-constructor-injection`, `di-scope-awareness`, `error-throw-http-exceptions` |
| Swappable implementation (interface, token, test double) | `di-use-interfaces-tokens`, `di-interface-segregation`, `di-liskov-substitution`, `di-avoid-service-locator` |
| New or changed endpoint | `api-controller-conventions`, `api-dto-naming`, `api-use-pipes`, `security-validate-all-input`, `api-document-with-openapi`, `api-use-dto-serialization`, `security-use-guards` (`@Public()`/`@Roles()`), `api-custom-param-decorators`, `error-throw-http-exceptions` |
| Update or derived DTO | `api-use-mapped-types`, `api-dto-naming` |
| List endpoint or search | `perf-optimize-database` (pagination), `api-dto-naming` (`PaginationQueryDto`, search body), `db-avoid-n-plus-one` |
| File upload | `api-file-uploads` |
| Entity or schema change | `db-entity-conventions`, `db-use-migrations`, `test-database-tier` |
| Multi-step write | `db-use-transactions` |
| Authentication or access control | `security-auth-jwt`, `security-hash-passwords`, `security-use-guards`, `api-custom-param-decorators`, `security-rate-limiting` |
| Errors | `error-throw-http-exceptions`, `error-use-exception-filters`, `error-handle-async-errors` |
| Response shape | `api-use-interceptors` (envelope), `api-use-dto-serialization` |
| Rich text input or HTML output | `security-sanitize-output` |
| Breaking API change | `api-versioning`, `api-use-dto-serialization` |
| Caching | `perf-use-caching` |
| Tests | `test-organize-by-tier`, `test-use-testing-module`, `test-guards-and-interceptors`, `test-mock-external-services`; `test-database-tier` and `test-integration-suites` for those tiers; the runner's file in `references/` for config and scripts |
| Events, queues, background work | `arch-use-events`, `micro-use-queues`, `micro-use-patterns`, `error-handle-async-errors` |
| `main.ts` and bootstrap | `api-platform-agnostic`, `devops-use-config-module`, `devops-use-logging`, `devops-graceful-shutdown`, `test-use-testing-module` (shared `configureApp()`) |
| Lifecycle hooks, startup or shutdown work | `perf-async-hooks`, `devops-graceful-shutdown`, `perf-lazy-loading` |
| Health checks and deployment | `micro-use-health-checks`, `devops-graceful-shutdown` |
| New setting or environment variable | `devops-use-config-module` |
| Configurable infrastructure module | `arch-use-dynamic-modules`, `devops-use-config-module` |

## Rule index

Sections are ordered by impact; the prefix is the start of each rule ID.

### 1. Architecture (CRITICAL) - `arch-`

- `arch-feature-modules` - Feature modules, type folders, singular resource names in code
- `arch-import-boundaries` - Relative imports inside a module, `@/` alias across modules
- `arch-module-sharing` - Proper module exports/imports, avoid duplicate providers
- `arch-avoid-circular-deps` - Avoid circular module dependencies
- `arch-single-responsibility` - Focused services over "god services"
- `arch-service-conventions` - Singular services, injection and parameter order, domain validation
- `arch-data-access-in-services` - `@InjectRepository` in services, queries in the service, no custom repository classes
- `arch-use-events` - Event-driven decoupling; `{object}.{action}` event names
- `arch-use-dynamic-modules` - Configurable modules with `ConfigurableModuleBuilder`

### 2. Dependency Injection (CRITICAL) - `di-`

- `di-prefer-constructor-injection` - Constructor over property injection
- `di-scope-awareness` - Singleton, request and transient scopes
- `di-use-interfaces-tokens` - Injection tokens for interfaces
- `di-avoid-service-locator` - No `ModuleRef.get()` service locator
- `di-interface-segregation` - Small, role-based interfaces
- `di-liskov-substitution` - Implementations honor their interface contract

### 3. Error Handling (HIGH) - `error-`

- `error-throw-http-exceptions` - Services throw typed HTTP exceptions
- `error-use-exception-filters` - One platform-agnostic global filter with the error envelope
- `error-handle-async-errors` - No unhandled rejections from background work

### 4. Security (HIGH) - `security-`

- `security-validate-all-input` - Global `ValidationPipe`, `class-validator` DTOs, nested objects
- `security-auth-jwt` - Passport `JwtStrategy` building a complete `JwtUser`; the refresh exchange rechecks the user
- `security-hash-passwords` - Argon2id (bcrypt only where already used) in one `PasswordHasher`, uniform login failures
- `security-use-guards` - Global `JwtAuthGuard` + `RolesGuard`, `@Public()`, `@Roles()`
- `security-sanitize-output` - Sanitize user HTML, never reflect unvalidated input
- `security-rate-limiting` - Rate limiting with `@nestjs/throttler`

### 5. Performance (HIGH) - `perf-`

- `perf-optimize-database` - Lean queries, indexes; offset pagination with `{ result, count, limit, offset }`
- `perf-use-caching` - Caching with invalidation
- `perf-async-hooks` - Async lifecycle hooks
- `perf-lazy-loading` - Lazy-load rarely used modules

### 6. Testing (MEDIUM-HIGH) - `test-`

- `test-organize-by-tier` - Unit, e2e, database and integration tiers under `test/`, mirroring `src/`
- `test-use-testing-module` - Test services through their routes: real service, mocked repositories
- `test-guards-and-interceptors` - Drive guards and interceptors through probe routes
- `test-database-tier` - Constraints and migrations against a real database, rolled back per case
- `test-integration-suites` - Order-independent integration specs against a live API
- `test-mock-external-services` - Mock external dependencies

### 7. Database & ORM (MEDIUM-HIGH) - `db-`

- `db-entity-conventions` - Persistence-only entities, required `SnakeNamingStrategy`, singular class and plural table, named indexes and constraints
- `db-use-migrations` - `synchronize` hardcoded to `false`; generate structural migrations from entities; verify no drift; run as a deploy step
- `db-use-transactions` - Transactions for multi-step writes
- `db-avoid-n-plus-one` - Avoid N+1 queries

### 8. API Design (MEDIUM) - `api-`

- `api-controller-conventions` - Singular controllers, REST routes and methods, actions, status codes, handlers
- `api-dto-naming` - DTO file and class naming, param inheritance, pagination query
- `api-use-pipes` - Param and query DTO classes instead of inline pipes
- `api-use-mapped-types` - Derive DTOs with `PartialType`/`PickType`/`OmitType`
- `api-use-dto-serialization` - Hidden columns on entities, response DTOs where the shape differs
- `api-use-interceptors` - Cross-cutting concerns, the response envelope and the request lifecycle order
- `api-document-with-openapi` - Described DTO fields, decorated controllers, success responses inside the envelope, example conventions
- `api-custom-param-decorators` - `@AuthUser() authUser: JwtUser` and composed decorators
- `api-platform-agnostic` - Same code on Express and Fastify: adapter only in `main.ts`, neutral request type, CORS
- `api-file-uploads` - Validated multipart uploads with `nestjs-form-data`
- `api-versioning` - API versioning strategies

### 9. Microservices (MEDIUM) - `micro-`

- `micro-use-patterns` - Message and event patterns
- `micro-use-queues` - Background jobs with BullMQ
- `micro-use-health-checks` - Liveness and readiness probes

### 10. Code Style (MEDIUM) - `style-`

- `style-code-comments` - No comment by default; names carry the meaning; comments only say why; stale comments are deleted
- `style-private-underscore-prefix` - `_` prefix on private methods only
- `style-no-em-dash` - Never use the em dash character
- `style-us-english` - US-English spelling everywhere

### 11. DevOps & Deployment (LOW-MEDIUM) - `devops-`

- `devops-use-config-module` - One `registerAs` file per concern, namespaced keys, `validate` hook
- `devops-use-logging` - Structured pino logging with correlation fields
- `devops-graceful-shutdown` - Zero-downtime deployments
