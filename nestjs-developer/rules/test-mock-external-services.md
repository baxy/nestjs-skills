---
title: Mock External Services at the Module Boundary
impact: HIGH
impactDescription: Fast, deterministic stack-free tiers that still cover provider failures
tags: testing, mocking, external-services, jest
---

## Mock External Services at the Module Boundary

The unit and e2e tiers never call anything outside the process: third-party APIs, the database, queues, object storage (see `test-organize-by-tier`). Replace each at the provider the code injects (`HttpService`, a client token, TypeORM's repository token), so the code that uses it still runs. Real databases belong to the database tier (`test-database-tier`), and real running systems to the integration tier (`test-integration-suites`).

- Drive the code through its route like any e2e test (see `test-use-testing-module`); the external client is the mock, not the service that calls it.
- Cover the provider's failure modes, not only success: timeout, rate limiting (429), server error, malformed body. Assert what the API returns for each.
- Mock data has the provider's real shape. A mock that returns `{}` passes tests the real response would fail.
- Freeze time with `jest.useFakeTimers()` for expiry and scheduling logic; restore real timers afterwards.

**Incorrect (real calls, real database, happy path only):**

```typescript
describe('Forecasts', () => {
  it('returns the forecast', async () => {
    const service = new ForecastService(new HttpService(axios.create())); // Real HTTP call, constructed by hand
    expect(await service.findByCity('Oslo')).toBeDefined();               // Slow, flaky, and only the success path
  });
});

beforeEach(async () => {
  await dataSource.query('DELETE FROM users'); // Unit/e2e test touching a real database
});
```

**Correct (client mocked at its provider, failures covered, driven over HTTP):**

```typescript
// test/e2e/forecast/forecast.spec.ts
import request from 'supertest';

describe('Forecasts', () => {
  let app: INestApplication;
  const httpService = { get: jest.fn() };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ForecastController],
      providers: [
        ForecastService, // real
        { provide: HttpService, useValue: httpService },
        { provide: APP_GUARD, useValue: testAuthGuard(() => AUTH_USER) },
      ],
    }).compile();
    app = await createTestApp(moduleRef);
  });

  afterAll(() => app.close());
  beforeEach(() => jest.clearAllMocks());

  describe('GET /forecasts/:city', () => {
    it('returns the forecast', async () => {
      httpService.get.mockReturnValue(of({ status: 200, data: { temperature: 21, humidity: 45 } }));

      const res = await request(app.getHttpServer()).get('/forecasts/oslo');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({ temperature: 21, humidity: 45 });
    });

    it('returns 503 when the provider times out', async () => {
      httpService.get.mockReturnValue(throwError(() => Object.assign(new Error('timeout'), { code: 'ECONNABORTED' })));

      const res = await request(app.getHttpServer()).get('/forecasts/oslo');

      expect(res.status).toBe(503);
    });

    it('returns 503 when the provider rate-limits us', async () => {
      httpService.get.mockReturnValue(throwError(() => ({ response: { status: 429, data: { message: 'Rate limited' } } })));

      const res = await request(app.getHttpServer()).get('/forecasts/oslo');

      expect(res.status).toBe(503);
    });
  });
});

// test/helpers/mock-stripe.ts - a factory for a large SDK with only the methods the code uses,
// provided as { provide: STRIPE_CLIENT, useValue: createMockStripe() }
export function createMockStripe() {
  return { paymentIntents: { create: jest.fn(), retrieve: jest.fn() } };
}

// test/unit/auth/is-refresh-token-expired.spec.ts - a pure function with frozen time
describe('isRefreshTokenExpired', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-15T10:30:00.000Z'));
  });

  afterEach(() => jest.useRealTimers());

  it('is expired one second after expiresAt', () => {
    expect(isRefreshTokenExpired(new Date('2026-01-15T10:29:59.000Z'))).toBe(true);
  });
});
```

Reference: [Jest Mock Functions](https://jestjs.io/docs/mock-functions) · [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)
