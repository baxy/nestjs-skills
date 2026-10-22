# Decisions

Settled choices behind `nestjs-developer` and `nestjs-reviewer`. A difference from the upstream sources that traces to an entry here is intentional; do not re-raise it in a review. Entries marked **(unconfirmed)** were made by the assistant and never explicitly approved: treat them as open.

Sessions: **S1** creation (run from `~/workspace`), **S2** first restructure, **S3** password rule, **S4** contradiction fixes and evals, **S5** source re-check, **S6** NestJS 12, Vitest and ESM.

## Sources

- **Kadajett/agent-nestjs-skills** @ `3986e0c`, skill `nestjs-best-practices` (40 rules): the base of `nestjs-developer`, copied first (S1).
- **giuseppe-trisciuoglio/developer-kit** @ `fe73fb3`, plugin `developer-kit-typescript` (S1). Taken only where Kadajett had a gap:
  - new rules `api-use-mapped-types`, `api-document-with-openapi`, `api-custom-param-decorators`, `arch-use-dynamic-modules` (rewritten on `ConfigurableModuleBuilder`), `test-guards-and-interceptors`;
  - nested validation in `security-validate-all-input`; error shape and `{ cause }` in `error-use-exception-filters`;
  - `skills/nestjs-code-review` became `nestjs-reviewer` (SKILL.md, `checklist.md`, `anti-patterns.md`).
- **Excluded from giuseppe at import (S1):** `skills/nestjs/references/{reference,drizzle-reference,workflow-optimization}.md`, the `nestjs` SKILL.md CRUD examples (one DB pool per module), the Drizzle CRUD generator, the subagent files, `nestjs-code-review/references/patterns.md`. A `db-drizzle-integration` rule was proposed and never created.
- **Anthill `anthill-cloud-platform/docs/engineering/`** conventions were ported on top (S1, list below), generalized: no Anthill names, users/orders as the example domain.
- Upstream credits and license notices removed by the user's choice, for private use (S1).

## Architecture and modules

- Every file in a type folder; only `{module}.module.ts` (and `.module-definition.ts`) at the module root (S1, C1).
- `src/shared/` is a folder of reusable files, not a Nest module; no `SharedModule` (S1).
- One singular resource name in code (folder, module, controller, service, entity, injected property); plural only in the URL and the table (S1).
- Relative imports inside a module, `@/` alias across modules (S1, A2). `paths` without `baseUrl`, which TypeScript 6 rejects (S6).
- Service conventions: injection order, `private readonly`, parameter order, `UPPER_SNAKE_CASE` constants (S1, A4).
- `authUser: JwtUser` is the first service parameter only when the method acts for a caller (S4, D).
- Data access: `@InjectRepository` in the service, no custom repository classes. `arch-use-repository-pattern` was renamed `arch-data-access-in-services` and its direction reversed (S2).
- No custom `@Global()` modules; only named third-party infrastructure is global (S3, assistant fix). A configurable module is configured once in a module that re-exports it (S5).
- Work that must succeed with a write (stock reservation) runs inside the owning transaction, not in an event listener (S5).
- The service that owns a use case orchestrates it; a controller makes one service call (S2).
- Abstractions are injected through `Symbol` tokens or abstract classes, never string tokens (S2).
- No property injection, not even for optional dependencies, which use an `@Optional()` constructor parameter (S2).

## API

- REST lives in `api-controller-conventions` (S1):
  - `POST /:id/{verb}` actions, with a body only when the action has inputs;
  - `POST /{resources}/search` allowed when criteria don't fit a query string;
  - at most 4 collections deep, counting the root;
  - `GET /:id/download` for content, still safe;
  - `PUT` may create when idempotent, and a repeat returns the existing resource (200) or a documented error (409) as a business decision.
- Param, query and body bound to DTO classes, no inline pipes (S1, C7).
- DTO naming: `.param.dto.ts`, verb-first queries, `{concern}.query.dto.ts` for reusable pieces, `-response.dto.ts`, `{shape}.dto.ts` (S1, A5).
- Offset pagination `{ result, count, limit, offset }`, defaults 20/0, `@Max(100)` (S1, C8).
- Response envelope `{ success, statusCode, data, meta }` and error `{ success: false, statusCode, error, message }` (S1, C9), plus an optional `errorCode` copied from NestJS 12's exception option when present; services set one only where a client branches on it (S6).
- Returning an entity is fine with `@Exclude()` + `@ApiHideProperty()` on hidden columns; a response DTO is used when the shape differs; a request body is never bound to an entity (S1, C2).
- Swagger: `description` + `example` on every DTO field, `summary` + `description` on every endpoint, spec in every environment, nil UUID, fictional dates, `+` for long descriptions, no `servers` with a global prefix (S1, C3/A7). Nested-DTO fields need no `example` of their own (S4).
- Success responses are documented inside the envelope with `@ApiEnvelopedResponse` / `@ApiPaginatedResponse`; still recommended, not required (S5).
- `@SerializeOptions({ type })` only for a handler returning one object or an array; a paginated handler's items are converted in the service (S5).
- Uploads with `nestjs-form-data` (S1, A8).
- Express/Fastify agnostic: adapter only in `main.ts` and `createTestApp()`; `HttpAdapterHost`; neutral `AppRequest` (S1).
- Auth flows as resources (`POST /sessions`, `POST /password-resets`) **(unconfirmed, S2)**.
- File streaming and storage defaults stay out of the skill: storage business logic (S2).

## Errors

- Duplicates and concurrent changes are 409; invalid input and broken domain rules (illegal transition, insufficient stock or funds) are 400 (S1 C11, S4 A).
- Services throw the built-in HTTP exceptions; a domain error class only for a service also used outside HTTP. No Result pattern, no custom exception hierarchy (S2).
- One global exception filter, extended instead of adding a filter per error type (S2).

## Security

- `@AuthUser() authUser: JwtUser`, filled only by a passport `JwtStrategy`; global `JwtAuthGuard` + `RolesGuard` with `@Public()` / `@Roles()` (S2).
- `JwtUser` fields are generic (`id`, `email`, `roles`) **(unconfirmed, S2)**.
- No per-request user lookup: `JwtUser` is built from the token claims. The refresh exchange reloads the user and refuses a missing or deactivated one; deactivation or deletion revokes refresh tokens (S5).
- `ValidationPipe` runs with `forbidUnknownValues: true` (S5).
- Passwords: Argon2id by default; bcrypt accepted only where already used, with the native package, cost 12 or more and a 72-byte limit (S3).

## Database

- `SnakeNamingStrategy` required on every DataSource (S1).
- Indexes and constraints named `IDX_` / `UQ_` / `CHK_` (S4).
- Migrations generated only; `migration:create` only for data; drift check; lowercase-dash filenames (S1, C4). With no CLI available, no structural migration is written and the commands are handed over (S4).
- `synchronize` hardcoded to `false`, never read from config (S4).
- Return entity instances (`create()`, `merge()`), never a spread save (S4). Cache hits are rebuilt as instances (S5).
- External calls (payment providers, email) happen after the transaction commits, never inside it (S2).
- Migrations are applied by a separate deploy step, never `migrationsRun: true` (S5).
- Soft-deletable entities are deleted with `softDelete()` / `softRemove()` (S5).

## Config, logging, operations

- One `registerAs` file per concern, namespaced keys, `validate` hook; `process.env` only in `src/config/` and the migration DataSource (S2).
- Env prefixes per concern; all auth settings use `AUTH_*`, never a vendor prefix such as `AUTH0_` (S4).
- `redis` namespace with `host` / `port` **(unconfirmed, S2)**.
- Logging: `bufferLogs` + `useLogger`, Nest `Logger` in app code, request IDs as fields, `console.error` in crash handlers (S1, A12).
- Request log lines: `LoggingInterceptor` for successes, the exception filter for every failure (5xx error, others warn), pino `autoLogging` off (S5).
- Event names `{object}.{action}`, past tense, underscore for multi-word objects; nothing else ported from Anthill events (S1, A13).
- `@Cron` only for per-instance work; cluster-wide jobs are BullMQ job schedulers (S4, B).

## Testing

- Four tiers under `test/` (unit, e2e, db, integration); e2e is the real controller and service with mocked repositories over `supertest`; the service under test is never mocked (S1, C5/A9-A11).
- Guards and interceptors tested through probe controllers (S1, C6).
- Shared helpers in `test/helpers/` (S4, C).
- Coverage is measured but no threshold is enforced (S1, A9).
- The real `JwtAuthGuard` and `JwtStrategy` are tested once, in their own probe suite; every other suite uses the test guard (S5).
- Vitest and Jest are both supported by one skill, not one skill per runner: the tiers and test rules are runner-agnostic. The project's runner is kept and never switched as a side change. Runner config, scripts and the Jest-to-Vitest mapping live in `references/test-runner-vitest.md` and `references/test-runner-jest.md`; rule examples keep Jest's mock API (S6).
- Vitest tiers: one `vitest.config.ts` with a project per tier (`extends: true`), scripts select tiers with `--project`, and the database and integration tiers run with `--no-file-parallelism`. Checked on a project generated by `@nestjs/cli` 12.0.10 (S6).
- The reviewer does not flag the choice of runner (S6).
- Test UUIDs are version-4 shaped (`00000000-0000-4000-8000-00000000000N`): `@IsUUID()` rejects `00000000-0000-0000-0000-00000000000N`, which the rule examples used until S6. Found by running a generated project's tests (S6).

## Project setup

- The rules target NestJS 12 (S6). Existing projects keep their module system, runner and linter; `references/project-setup.md` says how to read them from `package.json` (S6).
- New projects start from `nest new` with its defaults: ESM with Vitest, oxlint, TypeScript 6 (S6).
- ESM specifics (`.js` import extensions, `Relation<>` on entity relations, `typeorm-ts-node-esm`) live in `references/project-setup.md`, not in every rule example (S6).
- TypeORM 1.x for new projects, with `typeorm-naming-strategies` allowed through a package-manager override (its peer range stops at 0.3; it works on 1.1). If it stops working on a later TypeORM, copy the strategy into `src/shared/` instead of staying on 0.3 (S6).
- `class-validator` DTOs stay the validation default, new projects included, over NestJS 12's Standard Schema support (Zod and similar): the NestJS docs name no default, and the DTO classes are also the Swagger models and the base of the mapped types. A project already on Zod keeps it (S6).

## Style

- `_` prefix on private methods only, never on injected dependencies (S1 C10, S2).
- No em dash; US English (S1).

## Reviewer

- On another ORM, check the intent of the `db-` rules; a documented project convention that conflicts is one Suggestion; `style-` violations are Warnings (S2, confirmed S5).
- A concrete defect that no rule covers can be a Warning, tagged `no rule` and shown with the input that triggers it (S5).
- A missing required companion (migration, e2e spec) is reported at full severity, with the assumption stated (S4).

## Packaging

- Names `nestjs-developer` / `nestjs-reviewer`; descriptions say "best practices refined by experience", not "opinionated" (S1).
- Both at version 1.0.0 (S2), 1.1.0 after the NestJS 12 update (S6).
- Do not install into `~/.claude/skills/` yet (S4).
- Git home: `baxy/nestjs-skills` (S5).
