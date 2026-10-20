# Decisions

Settled choices behind `nestjs-developer` and `nestjs-reviewer`. A difference from the upstream sources that traces to an entry here is intentional; do not re-raise it in a review. Entries marked **(unconfirmed)** were made by the assistant and never explicitly approved: treat them as open.

Sessions: **S1** creation (run from `~/workspace`), **S2** first restructure, **S3** password rule, **S4** contradiction fixes and evals, **S5** source re-check.

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
- Relative imports inside a module, `@/` alias across modules (S1, A2).
- Service conventions: injection order, `private readonly`, parameter order, `UPPER_SNAKE_CASE` constants (S1, A4).
- `authUser: JwtUser` is the first service parameter only when the method acts for a caller (S4, D).
- Data access: `@InjectRepository` in the service, no custom repository classes. `arch-use-repository-pattern` was renamed `arch-data-access-in-services` and its direction reversed (S2).
- No custom `@Global()` modules; only named third-party infrastructure is global (S3, assistant fix). A configurable module is configured once in a module that re-exports it (S5).
- Work that must succeed with a write (stock reservation) runs inside the owning transaction, not in an event listener (S5).

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
- Response envelope `{ success, statusCode, data, meta }` and error `{ success: false, statusCode, error, message }` (S1, C9).
- Returning an entity is fine with `@Exclude()` + `@ApiHideProperty()` on hidden columns; a response DTO is used when the shape differs; a request body is never bound to an entity (S1, C2).
- Swagger: `description` + `example` on every DTO field, `summary` + `description` on every endpoint, spec in every environment, nil UUID, fictional dates, `+` for long descriptions, no `servers` with a global prefix (S1, C3/A7). Nested-DTO fields need no `example` of their own (S4).
- Uploads with `nestjs-form-data` (S1, A8).
- Express/Fastify agnostic: adapter only in `main.ts` and `createTestApp()`; `HttpAdapterHost`; neutral `AppRequest` (S1).
- Auth flows as resources (`POST /sessions`, `POST /password-resets`) **(unconfirmed, S2)**.
- File streaming and storage defaults stay out of the skill: storage business logic (S2).

## Errors

- Duplicates and concurrent changes are 409; invalid input and broken domain rules (illegal transition, insufficient stock or funds) are 400 (S1 C11, S4 A).

## Security

- `@AuthUser() authUser: JwtUser`, filled only by a passport `JwtStrategy`; global `JwtAuthGuard` + `RolesGuard` with `@Public()` / `@Roles()` (S2).
- `JwtUser` fields are generic (`id`, `email`, `roles`) **(unconfirmed, S2)**.
- Passwords: Argon2id by default; bcrypt accepted only where already used, with the native package, cost 12 or more and a 72-byte limit (S3).

## Database

- `SnakeNamingStrategy` required on every DataSource (S1).
- Indexes and constraints named `IDX_` / `UQ_` / `CHK_` (S4).
- Migrations generated only; `migration:create` only for data; drift check; lowercase-dash filenames (S1, C4). With no CLI available, no structural migration is written and the commands are handed over (S4).
- `synchronize` hardcoded to `false`, never read from config (S4).
- Return entity instances (`create()`, `merge()`), never a spread save (S4). Cache hits are rebuilt as instances (S5).

## Config, logging, operations

- One `registerAs` file per concern, namespaced keys, `validate` hook; `process.env` only in `src/config/` and the migration DataSource (S2).
- Env prefixes per concern; all auth settings use `AUTH_*`, never a vendor prefix such as `AUTH0_` (S4).
- `redis` namespace with `host` / `port` **(unconfirmed, S2)**.
- Logging: `bufferLogs` + `useLogger`, Nest `Logger` in app code, request IDs as fields, `console.error` in crash handlers (S1, A12).
- Event names `{object}.{action}`, past tense, underscore for multi-word objects; nothing else ported from Anthill events (S1, A13).
- `@Cron` only for per-instance work; cluster-wide jobs are BullMQ job schedulers (S4, B).

## Testing

- Four tiers under `test/` (unit, e2e, db, integration); e2e is the real controller and service with mocked repositories over `supertest`; the service under test is never mocked (S1, C5/A9-A11).
- Guards and interceptors tested through probe controllers (S1, C6).
- Shared helpers in `test/helpers/` (S4, C).

## Style

- `_` prefix on private methods only, never on injected dependencies (S1 C10, S2).
- No em dash; US English (S1).

## Reviewer

- On another ORM, check the intent of the `db-` rules; a documented project convention that conflicts is one Suggestion; `style-` violations are Warnings **(unconfirmed, S2)**.
- A missing required companion (migration, e2e spec) is reported at full severity, with the assumption stated (S4).

## Packaging

- Names `nestjs-developer` / `nestjs-reviewer`; descriptions say "best practices refined by experience", not "opinionated" (S1).
- Both at version 1.0.0 (S2).
- Do not install into `~/.claude/skills/` yet (S4).
- Git home: `baxy/nestjs-skills` (S5).
