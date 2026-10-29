---
title: Test Services Through Their Routes
impact: HIGH
impactDescription: One request covers routing, validation, guards, controller, service and the response envelope together
tags: testing, e2e, testing-module, mocking, supertest
---

## Test Services Through Their Routes

In the e2e tier (see `test-organize-by-tier`), build the **real** controller and service with `Test.createTestingModule`, mock at the data boundary, and drive the app over HTTP in-process with `supertest`. One request then exercises routing, `ValidationPipe`, param binding, guards, the controller, the service, the exception filter and the response envelope in a single pass.

### Data boundary mocks

**TypeORM:** mock `getRepositoryToken(Entity)` and `DataSource`.

```typescript
const orderRepository = { findOne: jest.fn(), save: jest.fn(), create: jest.fn((value) => value) };
const dataSource = { transaction: jest.fn((run) => run({ save: orderRepository.save })) };

providers: [
  OrderService,
  { provide: getRepositoryToken(Order), useValue: orderRepository },
  { provide: DataSource, useValue: dataSource },
]
```

**Prisma:** mock `PrismaService`.

```typescript
const prisma = {
  order: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn() },
  $transaction: jest.fn((run) => run(prisma)),
};

providers: [
  OrderService,
  { provide: PrismaService, useValue: prisma },
]
```

### Shared rules

- **Never mock the service the suite is named after.**
- Assert observable behavior: status code, response body (`res.body.data` inside the envelope), and what reached the data boundary.
- Global pipes, filter and interceptors are registered in `configureApp()` (`src/configure-app.ts`), which both `main.ts` and `createTestApp()` call.
- Provide the caller with a test guard registered as `APP_GUARD`.
- Reset mocks between tests. Test UUIDs must pass `@IsUUID()` (use version digit 4, e.g. `00000000-0000-4000-8000-000000000001`).

**Incorrect (mocking the service under test):**

```typescript
describe('Orders', () => {
  const orderService = { findById: jest.fn() };
  // ... providers: [{ provide: OrderService, useValue: orderService }]
});
```

**Correct (real service, mocked data client, in-process HTTP):**

See the TypeORM or Prisma mock patterns above. Drive the route with `supertest` and assert status, body, and the data client call.

Reference: [NestJS Testing](https://docs.nestjs.com/fundamentals/testing) · [supertest](https://github.com/ladjs/supertest)
