---
title: Organize Tests by Tier
impact: HIGH
impactDescription: Every test has one obvious home, and CI runs exactly what it can run
tags: testing, organization, jest, coverage, ci
---

## Organize Tests by Tier

A test's tier is defined by **what it needs in order to run**, because that alone decides whether CI can run it. Each tier is one directory under `test/` with its own jest config that selects it by path. **No test lives in `src/`.**

| Tier | Needs | Script | Directory |
|---|---|---|---|
| Unit | nothing: no Nest container, no I/O | `test:unit` | `test/unit/` |
| E2E | nothing: an in-process Nest module with mocked repositories | `test:e2e` | `test/e2e/` |
| Database | a migrated database, no HTTP | `test:db` | `test/db/` |
| Integration | the API running against its real stack | `test:integration` | `test/integration/` |

"E2E" means what NestJS means by it: the real controller and service built with `Test.createTestingModule` and driven over HTTP in-process (see `test-use-testing-module`), not a whole deployed system. A package carries only the tiers it needs, under these names.

**Where a test goes** - ask one question: does the subject have a dependency Nest would inject?

- **No** (a pure function, a DTO's validation decorators, a type guard): `test/unit/`, constructed directly. Large combinatorial logic (price calculation, state machines) stays here.
- **Yes** (a service, controller, guard, interceptor): `test/e2e/`, through its route.

**Layout and naming:**

- Every tier mirrors `src/`: one folder per module, whatever its spec count (`test/unit/order/`, `test/e2e/order/`). Scaffolding shared across tiers (`createTestApp()`, the test auth guard, fakes and SDK mocks) lives in `test/helpers/`; setup that belongs to one tier (`global-setup.ts`) stays at that tier's root.
- E2E: one spec per controller, `{resource}.spec.ts` for public routes and `{resource}.internal.spec.ts` for internal ones. **Never two specs over the same routes** - that is how a route ends up untested while each file assumes the other covers it. Several controllers exposing one resource through different parents share one spec. A guard or interceptor driven through probe routes (see `test-guards-and-interceptors`) gets one spec named after its source file: `src/auth/guards/roles.guard.ts` → `test/e2e/auth/roles.guard.spec.ts`.
- Unit: the spec takes the source file's name under its module folder, dropping the type folder: `src/order/utils/calculate-order-total.ts` → `test/unit/order/calculate-order-total.spec.ts`.
- Keep the full name on the file (`order/order.spec.ts`, never `order/public.spec.ts`): failures are read in jest output without the path.
- Route blocks are `describe('VERB /path')`; direct service blocks are `describe('ServiceName.method')`, never the bare method name. Positives sit beside their negatives. Only authorization and isolation suites may group by caller identity instead of route.
- Do not add tests for a method nothing calls: a test implies a contract someone depends on.

**Scripts and coverage:**

- Every package has a `test` script running its stack-free tiers (`test:unit && test:e2e`). Filtered runs such as `pnpm -r --if-present run test` silently skip a package without one and report green having run nothing.
- `test:db` and `test:integration` are deliberately not part of `test`; developers run them before a PR that touches services, entities or migrations.
- Measure coverage in **one** jest run over the stack-free tiers (a `projects` config). Separate runs cannot be added up because tiers overlap. Exclude wiring (`main.ts`, `*.module.ts`, `config/`) and nothing else. Do not enforce a threshold; use the number to find gaps.

**Incorrect (tests mixed into src, tiers by habit, one spec per module):**

```typescript
src/
└── user/
    ├── user.service.ts
    ├── user.service.spec.ts        // test in src/
    ├── user.controller.spec.ts     // second spec over the same routes as user.e2e-spec.ts
    └── user.e2e-spec.ts            // needs a database, yet runs in `test`

// package.json
"scripts": {
  "test": "jest"                     // runs everything, including tests that need a database
}
```

**Correct (one directory per tier, mirroring src):**

```typescript
test/
├── unit/
│   └── user/
│       ├── build-display-name.spec.ts       // src/user/utils/build-display-name.ts
│       └── create-user.dto.spec.ts          // DTO validation, no Nest container
├── e2e/
│   └── user/
│       ├── user.spec.ts                    // all public /users routes, real service
│       └── user.internal.spec.ts           // /internal/users routes
├── db/
│   └── user/
│       └── user-constraints.spec.ts        // unique and check constraints
├── integration/
│   └── user/
│       └── user.spec.ts
├── helpers/                                 // shared by all tiers: create-test-app.ts, test-auth.guard.ts, fakes
├── jest-unit.json                           // "testRegex": "test/unit/.+\\.spec\\.ts$"
├── jest-e2e.json
├── jest-db.json
├── jest-integration.json
└── jest-coverage.json                       // projects: [unit, e2e]

// package.json
"scripts": {
  "test": "pnpm run test:unit && pnpm run test:e2e",
  "test:unit": "jest --config ./test/jest-unit.json",
  "test:e2e": "jest --config ./test/jest-e2e.json",
  "test:db": "jest --config ./test/jest-db.json --runInBand",
  "test:integration": "jest --config ./test/jest-integration.json --runInBand",
  "test:coverage": "jest --config ./test/jest-coverage.json --coverage"
}
```

```jsonc
// test/jest-coverage.json
{
  "rootDir": "..",
  "projects": ["<rootDir>/test/jest-unit.json", "<rootDir>/test/jest-e2e.json"],
  "collectCoverageFrom": ["src/**/*.ts", "!src/main.ts", "!src/**/*.module.ts", "!src/config/**"]
}
```

Reference: [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)
