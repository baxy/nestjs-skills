# Project Setup

How to read an existing project's setup, how to start a new project, and what changes in an ESM project. Checked against NestJS 12.2 (`@nestjs/cli` 12.0.10, TypeScript 6, Vitest 4, TypeORM 1.1) in October 2026.

## Existing project: follow what it has

Read `package.json` before writing code or tests:

- **Module system:** `"type": "module"` means ESM; apply "ESM differences" below. No `type` field means CommonJS, and the rule examples apply as written.
- **Test runner:** `vitest` in `devDependencies` → `test-runner-vitest.md`; `jest` → `test-runner-jest.md`. Keep the runner the project has: switching runners is its own change, made only when asked.
- **NestJS version:** the `@nestjs/core` major. The "NestJS 12" notes below do not apply to 11.
- **Linter:** oxlint or ESLint, whichever the project already runs.

## New project

Start from `nest new` with the current CLI and keep its defaults, then apply the rules on top.

1. Node: the CLI needs Node 22.22.3+, 24.15+ or 26+; the app itself runs on 20.19+ or 22.12+.
2. `npx @nestjs/cli@latest new <name>` and choose **ESM** at the module-system prompt (the default). The project comes with Vitest, oxlint, TypeScript 6 and `module: nodenext`.
3. Lay out the tests by tier (`test-organize-by-tier`, `test-runner-vitest.md`): replace the generated `vitest.config.ts` and `vitest.config.e2e.ts` with the per-tier projects config and remove the sample `AppController`, `AppService` and their specs.
4. Keep the generated `tsconfig.json` and only add the `@/` alias to it (`arch-import-boundaries`). When you write the project by hand, start from the generated file below: TypeScript 6 turns `strict` on by default, and without `strictPropertyInitialization: false` every entity and DTO field fails with TS2564.

   ```jsonc
   // tsconfig.json, as nest new generates it for ESM, plus paths
   {
     "compilerOptions": {
       "module": "nodenext",
       "moduleResolution": "nodenext",
       "resolvePackageJsonExports": true,
       "esModuleInterop": true,
       "isolatedModules": true,
       "declaration": true,
       "removeComments": true,
       "emitDecoratorMetadata": true,
       "experimentalDecorators": true,
       "allowSyntheticDefaultImports": true,
       "target": "ES2023",
       "sourceMap": true,
       "outDir": "./dist",
       "rootDir": ".",
       "incremental": true,
       "skipLibCheck": true,
       "strict": true,
       "strictPropertyInitialization": false,
       "types": ["vitest/globals", "node"],
       "paths": { "@/*": ["./src/*"] }
     }
   }
   ```

5. Add the stack: `@nestjs/config`, `@nestjs/typeorm` with `typeorm` and `pg`, `typeorm-naming-strategies`, `@nestjs/swagger`, `class-validator` and `class-transformer`, `nestjs-pino` with `pino-http` (and `pino-pretty` for local runs), `nestjs-cls`, `@nestjs/terminus`, `@nestjs/throttler`, plus the auth packages from `security-auth-jwt` and `security-hash-passwords`.
6. Create `src/configure-app.ts` and `test/helpers/create-test-app.ts` before the first feature (`test-use-testing-module`).

**Current majors** (October 2026). When you can't check the registry, use these ranges instead of guessing: a package major that doesn't exist, or one that predates NestJS 12, stops the install.

| Package | Range |
|---|---|
| `@nestjs/common`, `core`, `platform-express`, `testing`, `config`, `typeorm`, `swagger`, `terminus`, `bullmq`, `cli`, `schematics` | `^12.0.0` |
| `@nestjs/throttler` | `^6.7.0` |
| `nestjs-pino` (with `pino` `^10`, `pino-http` `^11`) | `^5.3.0` |
| `nestjs-cls` | `^7.0.0` |
| `typeorm` | `^1.1.0` |
| `typeorm-naming-strategies` | `^4.1.0` |
| `class-validator` | `^0.15.0` |
| `@nestjs/jwt`, `@nestjs/passport`, `@nestjs/cache-manager`, `@nestjs/event-emitter`, `@nestjs/schedule` | `^12.0.0` |
| `passport`, `passport-jwt` | `^0.7.0`, `^4.0.1` |
| `argon2` | `^0.45.0` |
| `bullmq` | `^6.0.0` |
| `cache-manager` (the library itself) with `@keyv/redis` | `^7.0.0`, `^6.0.0` |
| `pg` | `^8.0.0` |
| `pino-pretty`, `helmet` | `^13.0.0`, `^8.0.0` |
| `typescript`, `vitest`, `vite` | `^6.0.2`, `^4.1.2`, `^8.0.0` (as `nest new` generates) |

**Peer ranges to expect** (October 2026):

- `typeorm-naming-strategies` 4.1.0 declares TypeORM 0.2 and 0.3 only. It works on TypeORM 1.1 (`SnakeNamingStrategy` produces the same names in CommonJS and ESM), so allow it with a package-manager override (`overrides` in npm's `package.json`; `peerDependencyRules.allowedVersions` in `pnpm-workspace.yaml`, since pnpm 10 no longer reads a `pnpm` field in `package.json`) instead of staying on TypeORM 0.3.
- `@nest-lab/throttler-storage-redis` 1.2.0 (Redis storage for `@nestjs/throttler`, see `security-rate-limiting`) declares NestJS up to 11. Allow it with the same override.
- `nestjs-form-data` 11.0.1 (`api-file-uploads`) declares NestJS up to 11 and `class-validator` 0.14. Add it only when the project takes uploads, and check for a release that supports NestJS 12 first.

## ESM differences

The rule examples are written without file extensions. In an ESM project:

- **Relative imports name the emitted file**: `import { OrderService } from '../services/order.service.js'`. The source is `.ts`; the `.js` extension is what Node resolves after the build.
- **The `@/` alias takes the extension too**: `@/payment/services/payment.service.js`. `nest build` rewrites the alias to a relative path in the output, and Vitest resolves it through `resolve.tsconfigPaths`.
- **`tsconfig.json` has no `baseUrl`**: TypeScript 6 fails the build on it (TS5101). `paths` entries are relative to the tsconfig: `"paths": { "@/*": ["./src/*"] }`.
- `import.meta.dirname` replaces `__dirname`; `createRequire(import.meta.url)` gives a `require` where one is still needed.
- `main.ts` ends with a top-level `await bootstrap();`, as generated.
- **Types in decorated signatures are imported as types.** With `isolatedModules` and `emitDecoratorMetadata` (both generated), a name that is only a type and appears in a decorated constructor parameter or property fails with TS1272 when imported as a value: `import type { ConfigType } from '@nestjs/config'`, `import { type Relation } from 'typeorm'`, interfaces. A class Nest injects by type (a service, a repository's entity) stays a value import: the metadata needs it at runtime.
- **TypeORM relations are typed with `Relation<>`** to avoid circular-import errors between entities: `user: Relation<User>;`. Import it as a type, `import { type Relation } from 'typeorm'`: with `isolatedModules` and `emitDecoratorMetadata` (both generated), a plain import of a type used in a decorated property fails with TS1272. Only relation properties take it, never plain columns.
- **The TypeORM CLI** runs through `typeorm-ts-node-esm` in an ESM project (`"typeorm": "typeorm-ts-node-esm"` in the scripts) instead of `typeorm-ts-node-commonjs`. It does not apply the `@/` alias; when entities import across modules and `migration:generate` fails to resolve those imports, build first and point the CLI at the compiled DataSource in `dist/`, where the alias is already rewritten.
- **`supertest` is a default import**: `import request from 'supertest'`. `import * as request` fails with "is not a function".

## NestJS 12 and library changes the rules already follow

- **Terminus 12** removed the legacy `HealthIndicator` class; built-in checks take a timeout through `.withTimeout(ms)` (`micro-use-health-checks`).
- **`@Optional()` is no longer inherited**: a subclass redeclares its constructor with the marker (`di-prefer-constructor-injection`).
- **`ValidationPipe` `errorFormat`** stays at its default `'list'`, which the exception filter expects (`error-use-exception-filters`).
- **Lifecycle hooks run by module hierarchy level.** Do not rely on the order of `onModuleInit` (or the shutdown hooks) between providers of different modules; make the dependency explicit instead (`perf-async-hooks`).
- **TypeORM 1.x** removed the string-array forms of `relations` and `select` (use the object form, as the rules do) and throws on `null` or `undefined` in a `where` object: leave an optional filter's key out when it has no value, and match `NULL` with `IsNull()`. QueryBuilder `.where()` calls are not affected.
- **`@nestjs/config`** with a Joi `validationSchema` needs Joi 18 and moves Joi options under `validationOptions.libraryOptions`. The rules use the `validate` hook instead, which is unaffected.
- **Standard Schema validation** (Zod, Valibot, ArkType through `StandardSchemaValidationPipe`) is supported in NestJS 12. The NestJS docs name no default and present `ValidationPipe` first. The rules keep `class-validator` DTOs, new projects included, because the DTO classes are also the Swagger models and the base of the mapped types; a project already validating with Zod keeps Zod and applies the intent of the validation rules.
- **`errorCode` on `HttpExceptionOptions`** gives clients a stable code to branch on. The global exception filter copies it into the error envelope (`error-use-exception-filters`), and services set it where a client needs to tell errors apart (`error-throw-http-exceptions`).

Reference: [NestJS migration guide](https://docs.nestjs.com/migration-guide) · [NestJS Testing](https://docs.nestjs.com/fundamentals/testing) · [nestjs/schematics templates](https://github.com/nestjs/schematics/tree/master/src/lib/application/files) · [TypeORM FAQ: ESM projects](https://typeorm.io/docs/help/faq) · [TypeORM 1.0 upgrade guide](https://typeorm.io/docs/releases/1.0/upgrading-from-0.3)
