# NestJS Code Review Checklist

Rule IDs in brackets refer to `../nestjs-developer/rules/<rule-id>.md`, relative to the `nestjs-reviewer` skill folder. Items without a rule ID are general review checks.

## Contents
- Module Structure
- Controllers
- Swagger / OpenAPI
- Services
- DTOs and Validation
- Entities and Serialization
- Dependency Injection
- Guards and Authorization
- Interceptors and Middleware
- Error Handling
- Database and Migrations
- HTTP Platform (Express / Fastify)
- Security
- Testing
- Performance
- Operations
- Code Style

## Module Structure
- [ ] Each feature has its own module with clear boundaries [arch-feature-modules]
- [ ] Every file sits in a type folder (`controllers/`, `services/`, `dtos/`, `entities/`, `utils/`...); only `{module}.module.ts` at the module root [arch-feature-modules]
- [ ] Modules export only the necessary public API [arch-module-sharing]
- [ ] No circular module dependencies; `forwardRef()` only as a documented last resort [arch-avoid-circular-deps]
- [ ] Reusable files live in `src/shared/` type folders, imported directly - no `SharedModule` [arch-feature-modules]
- [ ] No custom `@Global()` modules or `isGlobal` options; only third-party infrastructure (config, logger, CLS, cache, form-data) is global [arch-module-sharing]
- [ ] Singular resource name for the module folder and the module, controller, service and entity classes and files (`src/order/`, `OrderModule`, `OrderController`, `OrderService`, `Order`); plural only in the URL and the table [arch-feature-modules]
- [ ] Relative imports inside a module, `@/` alias across modules, never `../../sibling` [arch-import-boundaries]
- [ ] Reusable infrastructure modules expose `forRoot`/`forRootAsync` instead of reading `process.env` [arch-use-dynamic-modules]
- [ ] Lazy-loaded modules where startup time matters (serverless, CLI) [perf-lazy-loading]

## Controllers
- [ ] Controllers are thin - no business logic, no data access [api-controller-conventions]
- [ ] Route paths plural kebab-case nouns (`@Controller('orders')`); no verbs except `POST /:id/{verb}` actions and `GET /:id/download` [api-controller-conventions]
- [ ] At most 4 collections deep; nested routes verify the child belongs to the parent [api-controller-conventions]
- [ ] Filters, sorting and pagination as query parameters; `POST /{resources}/search` only for criteria that don't fit a query string [api-controller-conventions]
- [ ] Correct method semantics: GET safe, POST creates with a server-assigned id or runs an action, PUT idempotent create-or-replace (a repeat never creates a second resource; it returns the existing one or a documented error such as 409), PATCH plain fields only, DELETE idempotent [api-controller-conventions]
- [ ] State transitions are `POST /:id/{verb}` actions, not `status` changes through PATCH [api-controller-conventions]
- [ ] Status codes: 201 create, 200 action/search (`@HttpCode(HttpStatus.OK)`), 202 async, 204 delete [api-controller-conventions]
- [ ] Handler names: `findAll`, `findById`, `create`, `update`, `replace`, `delete`, `search`, `download`, or the action's verb [api-controller-conventions]
- [ ] Parameter order: authenticated user, `@Param()`, then `@Query()` or `@Body()` [api-controller-conventions]
- [ ] `@Param()`, `@Query()` and `@Body()` bound to DTO classes - no inline `@Param('id', ParseUUIDPipe)` [api-use-pipes]
- [ ] Service results returned directly; no ad-hoc response wrappers [api-use-interceptors]
- [ ] Caller read with `@AuthUser() authUser: JwtUser` as the first parameter, never from `@Req()` [api-custom-param-decorators]
- [ ] Versioning applied consistently [api-versioning]

## Swagger / OpenAPI
- [ ] Every controller has one `@ApiTags` and a security decorator (`@ApiBearerAuth('bearer')`) [api-document-with-openapi]
- [ ] Every method has `@ApiOperation` with `summary` and `description` [api-document-with-openapi]
- [ ] A documented success response uses `@ApiEnvelopedResponse(X)` or `@ApiPaginatedResponse(X)`, never a plain `@ApiOkResponse({ type: X })`, which documents the body without the envelope [api-document-with-openapi]
- [ ] Endpoint-specific error statuses documented (`@ApiNotFoundResponse`, `@ApiConflictResponse`...); recommended, so a missing one is a Suggestion [api-document-with-openapi]
- [ ] Every new or changed DTO field has `@ApiProperty`/`@ApiPropertyOptional` with `description` and `example` (a nested-DTO field takes its example from the nested DTO) [api-document-with-openapi]
- [ ] Examples are realistic, UUID examples use the nil UUID, dates are fictional ISO 8601 [api-document-with-openapi]
- [ ] `@ApiProperty` does not repeat `type`, `required`, `format` or `enum` given by validators [api-document-with-openapi]
- [ ] Long descriptions split with `+`, not template literals [api-document-with-openapi]

## Services
- [ ] Single responsibility - each service owns one domain concern [arch-single-responsibility]
- [ ] Injection order: repositories, services, `ConfigService`, `DataSource`; all `private readonly` [arch-service-conventions]
- [ ] Method parameters: authenticated user (when the method acts for a caller), identifiers, DTO, options [arch-service-conventions]
- [ ] Shape validation in DTOs; services enforce domain rules only [arch-service-conventions]
- [ ] No `new` for injectable services (`new Logger(Class.name)`, the enhancers in `configureApp()` and enhancers with constructor arguments are fine) [di-prefer-constructor-injection]
- [ ] Typed exceptions: 400 invalid input or a broken domain rule (illegal state transition, insufficient stock or funds), 403 forbidden action, 404 missing or not visible, 409 clash with existing data (duplicate, concurrent change) [error-throw-http-exceptions]
- [ ] Transactions for multi-entity writes [db-use-transactions]
- [ ] No hardcoded config. A provider or module factory (`forRootAsync`, `registerAsync`) that reads several values of one namespace injects the namespace (`inject: [dbConfig.KEY]`), never `ConfigService` with one `getOrThrow` per key; a single value may use a namespaced key (`db.host`); never raw env names [devops-use-config-module]
- [ ] Repositories injected with `@InjectRepository` for the module's own entities only; no custom repository classes [arch-data-access-in-services]
- [ ] Side effects decoupled with events where appropriate; event names `{object}.{action}` [arch-use-events]

## DTOs and Validation
- [ ] Request DTOs with `class-validator` decorators; shared `ValidationPipe` options include `whitelist`, `forbidNonWhitelisted`, `forbidUnknownValues` and `transform` [security-validate-all-input]
- [ ] Nested objects/arrays validated with `@ValidateNested` + `@Type` [security-validate-all-input]
- [ ] Update DTOs derived with `PartialType`/`OmitType` from `@nestjs/swagger`, never copied [api-use-mapped-types]
- [ ] File and class names follow the DTO naming table (`.param.dto.ts`, `{verb}-...query.dto.ts`, `-response.dto.ts`) [api-dto-naming]
- [ ] Param DTOs extend the shorter route's param DTO; list queries extend `PaginationQueryDto` with a capped `limit` [api-dto-naming]
- [ ] Uploads use `@FormDataRequest()` with `@IsFile`, `@MaxFileSize`, `@HasMimeType`; JSON multipart fields parsed safely [api-file-uploads]
- [ ] No `any` in DTOs or handler signatures

## Entities and Serialization
- [ ] Entities carry persistence decorators only; `@Exclude` + `@ApiHideProperty` together are the one exception; no `@ApiProperty`/`@Expose` [db-entity-conventions]
- [ ] **Critical:** every sensitive column returned through an entity has `@Exclude()` + `@ApiHideProperty()` [api-use-dto-serialization]
- [ ] Returning an entity is fine; a response DTO is used where the shape differs (do not flag entity returns by themselves) [api-use-dto-serialization]
- [ ] **Critical:** an entity turned into a response DTO (`@SerializeOptions({ type })` or `plainToInstance()`) uses `excludeExtraneousValues: true`; otherwise every column, hidden ones included, is returned [api-use-dto-serialization]
- [ ] **Critical:** `@SerializeOptions({ type })` only on a handler returning one object or an array; on a paginated handler it converts the `PaginatedResult` wrapper (the page arrives as `data: {}`, or the items skip `@Exclude()`), so a page of response DTOs is converted item by item in the service [api-use-dto-serialization]
- [ ] Request bodies never bound to entities [api-use-dto-serialization]
- [ ] Entities returned to a client are class instances: `create()` for new rows, `merge()` for updates, never `save({ ...entity })` or `manager.save(Entity, { ... })`, which return plain objects that skip `@Exclude()`. **Critical** when a sensitive column such as `passwordHash` leaks this way [api-use-dto-serialization]
- [ ] `SnakeNamingStrategy` configured on every DataSource (app and migration CLI); no per-column `name:` overrides [db-entity-conventions]
- [ ] `@Entity('snake_case')`, camelCase properties, `timestamptz`, soft delete via `@DeleteDateColumn`, explicit `@JoinColumn` names, indexes and constraints named `IDX_`/`UQ_`/`CHK_` [db-entity-conventions]

## Dependency Injection
- [ ] No `ModuleRef.get()` service locator outside factories and lazy loading [di-avoid-service-locator]
- [ ] Provider scope matches lifecycle; no unjustified `REQUEST` scope [di-scope-awareness]
- [ ] Interfaces injected via `Symbol` tokens or abstract classes; no string tokens; no mocks selected by `NODE_ENV` [di-use-interfaces-tokens]
- [ ] Interfaces are small and focused [di-interface-segregation]
- [ ] Implementations are substitutable for their interfaces [di-liskov-substitution]

## Guards and Authorization
- [ ] `JwtAuthGuard` and `RolesGuard` registered globally; routes opt out with `@Public()`; no per-route `@UseGuards` for them [security-use-guards]
- [ ] Role checks use guards + decorators, not inline checks [security-use-guards]
- [ ] One passport `JwtStrategy` whose `validate()` returns a complete `JwtUser` or refuses the token; secrets from config, short-lived access tokens [security-auth-jwt]
- [ ] The refresh exchange reloads the user and refuses a missing or deactivated one; deactivating or deleting a user revokes their refresh tokens [security-auth-jwt]
- [ ] Repeated decorator stacks composed with `applyDecorators` [api-custom-param-decorators]

## Interceptors and Middleware
- [ ] Cross-cutting concerns in interceptors (logging, caching, timeouts) [api-use-interceptors]
- [ ] Responses shaped once by the envelope interceptor: `{ success, statusCode, data, meta? }`; `StreamableFile` passes through [api-use-interceptors]
- [ ] Global pipes, filter, interceptors, global prefix and versioning set in `configureApp()`, shared by `main.ts` and the test helper [test-use-testing-module]
- [ ] No business logic in interceptors or middleware

## Error Handling
- [ ] One global filter producing `{ success: false, statusCode, error, message }` [error-use-exception-filters]
- [ ] Filters use `HttpAdapterHost`, not Express `response.status().json()` [error-use-exception-filters]
- [ ] Filter keeps ValidationPipe field messages (reads `getResponse()`, not `.message`) [error-use-exception-filters]
- [ ] Error responses don't expose stack traces or SQL errors; wrapped errors keep `{ cause }` [error-use-exception-filters]
- [ ] The filter logs every failed request (5xx at error with the stack, others at warn); `LoggingInterceptor` logs successes only, since guard rejections (401, 403, 429) never reach it [error-use-exception-filters]
- [ ] Async errors awaited/handled; no floating promises [error-handle-async-errors]

## Database and Migrations
- [ ] Structural migrations generated with `migration:generate`, not hand-written; `migration:create` only for data changes [db-use-migrations]
- [ ] Migrations applied by a separate deploy step, never `migrationsRun: true` [db-use-migrations]
- [ ] Soft-deletable entities deleted with `softDelete()`/`softRemove()`, not `delete()`/`remove()` [db-entity-conventions]
- [ ] Migration filenames lowercase and dash-separated; no hardcoded schema prefixes [db-use-migrations]
- [ ] Re-running `migration:generate` produces nothing (no drift) [db-use-migrations]
- [ ] **Critical:** TypeORM `synchronize` hardcoded to `false`, never `true` and never read from config [db-use-migrations]
- [ ] Parameterized queries, no string concatenation [security-validate-all-input]
- [ ] No N+1 queries [db-avoid-n-plus-one]
- [ ] List endpoints paginated with `limit`/`offset`, returning `{ result, count, limit, offset }` [perf-optimize-database]

## HTTP Platform (Express / Fastify)
- [ ] Adapter-specific code only in `main.ts` and the test app helper [api-platform-agnostic]
- [ ] No `@Res()` with platform response APIs; filters and interceptors use `HttpAdapterHost` [api-platform-agnostic]
- [ ] Requests typed with the neutral `AppRequest`, never `express.Request` or `FastifyRequest` [api-platform-agnostic]
- [ ] Middleware written against Node's `IncomingMessage`/`ServerResponse` [api-platform-agnostic]
- [ ] CORS `methods` listed explicitly; new PUT/PATCH/DELETE methods verified with a preflight [api-platform-agnostic]
- [ ] `app.listen(port, '0.0.0.0')`; proxy trusted behind a load balancer [api-platform-agnostic]

## Security
- [ ] Rate limiting configured (`ThrottlerModule`) [security-rate-limiting]
- [ ] Output sanitized; helmet enabled [security-sanitize-output]
- [ ] CORS restricted to known origins [api-platform-agnostic]
- [ ] **Critical:** passwords never stored plain, fast-hashed (MD5, SHA) or encrypted [security-hash-passwords]
- [ ] Passwords hashed by one non-exported `PasswordHasher`: Argon2id, or bcrypt (native package, cost 12 or more, `@IsByteLength(1, 72)`) only in a project already on bcrypt; login answers unknown email and wrong password identically [security-hash-passwords]
- [ ] Secrets only in environment/config; `process.env` read only in `src/config/` and the migration DataSource; required variables checked by the `validate` hook [devops-use-config-module]
- [ ] Environment variables carry their concern's prefix (`APP_`, `DB_`, `REDIS_`...); every authentication setting is `AUTH_*`, never a provider-specific prefix such as `AUTH0_` [devops-use-config-module]

## Testing
- [ ] No tests in `src/`; each test in the right tier under `test/`, mirroring `src/` [test-organize-by-tier]
- [ ] One e2e spec per controller; no two specs over the same routes; `describe('VERB /path')` [test-organize-by-tier]
- [ ] E2E suites use the real service with mocked repositories, driven by `supertest` through `createTestApp()`; the service under test is never mocked [test-use-testing-module]
- [ ] Guards and interceptors tested through probe routes, including deny paths [test-guards-and-interceptors]
- [ ] Real authentication tested once: the real `JwtAuthGuard` and `JwtStrategy` answer 401 to missing, expired, wrongly signed and wrong-issuer tokens [test-guards-and-interceptors]
- [ ] New constraints, partial indexes or migrations covered in the database tier, with savepoints for expected failures [test-database-tier]
- [ ] Integration specs are order-independent and assert only on data they created [test-integration-suites]
- [ ] External services mocked in unit and e2e tiers [test-mock-external-services]
- [ ] The package's `test` script runs the stack-free tiers [test-organize-by-tier]

## Performance
- [ ] Caching for expensive, frequently read data with invalidation [perf-use-caching]
- [ ] **Critical:** cached entities are rebuilt with `plainToInstance` (service) or `@SerializeOptions({ type })` (`CacheInterceptor` route returning one entity or an array; a paginated route is cached in the service); a cache hit returned as a plain object skips `@Exclude()` [perf-use-caching]
- [ ] No blocking work in lifecycle hooks or the event loop [perf-async-hooks]
- [ ] Long-running or must-succeed work on BullMQ queues (`WorkerHost` processors); cluster-wide schedules as job schedulers, not `@Cron` [micro-use-queues]

## Operations
- [ ] Structured pino logging; `bufferLogs` + `useLogger`; no `console.log` except crash markers [devops-use-logging]
- [ ] Request IDs as log fields, not inside messages [devops-use-logging]
- [ ] Liveness and readiness probes, `@Public()` and `@SkipThrottle()`; liveness checks nothing external [micro-use-health-checks]
- [ ] `enableShutdownHooks()` and no manual signal handlers; readiness fails in `beforeApplicationShutdown` [devops-graceful-shutdown]
- [ ] Message/event patterns used correctly in microservices [micro-use-patterns]

## Code Style
- [ ] Private methods, and only private methods, use the `_` prefix [style-private-underscore-prefix]
- [ ] No em dash anywhere (code, comments, strings, docs) [style-no-em-dash]
- [ ] US-English spelling in identifiers, messages and docs [style-us-english]
