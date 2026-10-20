---
title: Test Services Through Their Routes
impact: HIGH
impactDescription: One request covers routing, validation, guards, controller, service and the response envelope together
tags: testing, e2e, testing-module, mocking, supertest
---

## Test Services Through Their Routes

In the e2e tier (see `test-organize-by-tier`), build the **real** controller and service with `Test.createTestingModule`, mock at the module boundary (TypeORM's repository tokens and `DataSource`, plus services that belong to other modules), and drive the app over HTTP in-process with `supertest`. One request then exercises routing, `ValidationPipe`, param binding, guards, the controller, the service, the exception filter and the response envelope in a single pass.

- **Never mock the service the suite is named after.** A suite that mocks its own service tests the controller and nothing else, and passes while the service is broken.
- Assert observable behavior: the status code, the response body (`res.body.data` inside the envelope, see `api-use-interceptors`), and what reached the repository boundary.
- **Same global setup as production.** Global pipes, the exception filter and global interceptors are registered in `configureApp()` (`src/configure-app.ts`), which both `main.ts` and `createTestApp()` call. Do not register them as `APP_PIPE`/`APP_FILTER`/`APP_INTERCEPTOR` providers in `AppModule`: an e2e testing module does not import `AppModule`, so the tests would run a different app. Guards stay `APP_GUARD` providers; tests replace authentication with a test guard. Route-shaping setup (`app.setGlobalPrefix()`, `app.enableVersioning()`, see `api-versioning`) also goes in `configureApp()`, or e2e tests call different paths than clients.
- **One helper knows the HTTP adapter.** `createTestApp()` creates the app for Express or Fastify; specs never touch adapter APIs, so they run unchanged on either (see `api-platform-agnostic`).
- Provide the caller with a test guard registered as `APP_GUARD` that sets a `JwtUser`; add `RolesGuard` after it when the suite covers role rules.
- Repositories are plain objects of `jest.fn()`s. A service that uses a query builder gets a chainable mock (every builder method returns the builder) so the test can assert the conditions it received.
- A service method with **no route** gets a direct `describe('ServiceName.method')` block only when it has a non-HTTP consumer (another module calls it); name the consumer in a comment. A method with no caller at all gets no test.
- Reset mocks between tests (`beforeEach(() => jest.clearAllMocks())`); put shared constants (UUIDs, mock objects) at the top of the file.

**Incorrect (mocking the service under test, or bypassing the HTTP layer):**

```typescript
// The service is mocked: this only proves the controller calls it
describe('Orders', () => {
  const orderService = { findById: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [OrderController],
      providers: [{ provide: OrderService, useValue: orderService }],
    }).compile();
    // ...
  });
});

// Controller constructed by hand: no routing, no ValidationPipe, no guards, no envelope
it('returns the order', async () => {
  const controller = new OrderController(service as any);
  expect(await controller.findById(AUTH_USER, { id: ORDER_ID })).toBeDefined();
});
```

**Correct (real service, mocked repositories, in-process HTTP):**

```typescript
// src/configure-app.ts - global setup shared by main.ts and tests
export const VALIDATION_PIPE_OPTIONS: ValidationPipeOptions = {
  whitelist: true,
  forbidNonWhitelisted: true,
  forbidUnknownValues: true, // Nest defaults it to false (see security-validate-all-input)
  transform: true,
};

export function configureApp(app: INestApplication): void {
  app.useGlobalPipes(new ValidationPipe(VALIDATION_PIPE_OPTIONS));
  app.useGlobalFilters(new AllExceptionsFilter(app.get(HttpAdapterHost)));
  // Outermost first: the envelope wraps what the serializer produced
  app.useGlobalInterceptors(
    new LoggingInterceptor(),
    new ResponseEnvelopeInterceptor(),
    new ClassSerializerInterceptor(app.get(Reflector)),
  );
}

// test/helpers/create-test-app.ts - the only test file that knows the HTTP adapter
export async function createTestApp(moduleRef: TestingModule): Promise<INestApplication> {
  // Fastify: moduleRef.createNestApplication<NestFastifyApplication>(new FastifyAdapter())
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  // Fastify: await app.getHttpAdapter().getInstance().ready();
  return app;
}

// test/helpers/test-auth.guard.ts - stands in for JwtAuthGuard
export const testAuthGuard = (resolveUser: (request: AppRequest) => JwtUser | undefined): CanActivate => ({
  canActivate: (context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<AppRequest>();
    request.user = resolveUser(request);
    return true;
  },
});

// test/e2e/order/order.spec.ts
import request from 'supertest';

const USER_ID = '00000000-0000-0000-0000-000000000001';
const ORDER_ID = '00000000-0000-0000-0000-000000000002';
const AUTH_USER: JwtUser = { id: USER_ID, email: 'jane@example.com', roles: [Role.User] };

describe('Orders', () => {
  let app: INestApplication;
  const orderRepository = { findOne: jest.fn(), save: jest.fn(), create: jest.fn((value) => value) };
  const dataSource = { transaction: jest.fn((run) => run({ save: orderRepository.save })) };
  const paymentService = { authorize: jest.fn() }; // Another module's service: mocked

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [OrderController],
      providers: [
        OrderService, // real
        { provide: getRepositoryToken(Order), useValue: orderRepository },
        { provide: DataSource, useValue: dataSource },
        { provide: PaymentService, useValue: paymentService },
        { provide: APP_GUARD, useValue: testAuthGuard(() => AUTH_USER) },
      ],
    }).compile();

    app = await createTestApp(moduleRef);
  });

  afterAll(() => app.close());
  beforeEach(() => jest.clearAllMocks());

  describe('GET /orders/:id', () => {
    it('returns the order', async () => {
      orderRepository.findOne.mockResolvedValue({ id: ORDER_ID, userId: USER_ID, status: OrderStatus.Pending });

      const res = await request(app.getHttpServer()).get(`/orders/${ORDER_ID}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ id: ORDER_ID, status: OrderStatus.Pending });
      expect(orderRepository.findOne).toHaveBeenCalledWith({ where: { id: ORDER_ID, userId: USER_ID } });
    });

    it('returns 404 when the order does not exist', async () => {
      orderRepository.findOne.mockResolvedValue(null);

      const res = await request(app.getHttpServer()).get(`/orders/${ORDER_ID}`);

      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ success: false, statusCode: 404 });
    });

    it('returns 400 for a malformed id without reaching the repository', async () => {
      const res = await request(app.getHttpServer()).get('/orders/not-a-uuid');

      expect(res.status).toBe(400);
      expect(orderRepository.findOne).not.toHaveBeenCalled();
    });
  });

  describe('POST /orders', () => {
    const payload = { items: [{ sku: 'SKU-001', quantity: 2 }] };

    it('creates an order for the caller', async () => {
      orderRepository.save.mockImplementation(async (value) => ({ id: ORDER_ID, ...value }));

      const res = await request(app.getHttpServer()).post('/orders').send(payload);

      expect(res.status).toBe(201);
      expect(orderRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ userId: USER_ID, status: OrderStatus.Pending }),
      );
    });

    it('rejects unknown properties', async () => {
      const res = await request(app.getHttpServer()).post('/orders').send({ ...payload, status: OrderStatus.Paid });

      expect(res.status).toBe(400);
    });
  });

  // Called by the payment module's webhook handler; no route reaches it
  describe('OrderService.markAsPaid', () => {
    it('rejects an order that is already canceled', async () => {
      const service = app.get(OrderService);
      orderRepository.findOne.mockResolvedValue({ id: ORDER_ID, userId: USER_ID, status: OrderStatus.Canceled });

      await expect(service.markAsPaid(ORDER_ID)).rejects.toThrow(BadRequestException);
    });
  });
});
```

On Fastify, `app.inject()` is a native alternative to `supertest`, but it ties the spec to the adapter; keep `supertest` so specs stay portable.

Reference: [NestJS Testing](https://docs.nestjs.com/fundamentals/testing) · [supertest](https://github.com/ladjs/supertest)
