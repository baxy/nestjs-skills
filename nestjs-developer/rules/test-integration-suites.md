---
title: Keep Integration Suites Independent and Honest
impact: MEDIUM
impactDescription: Integration tests that pass or fail for the right reason, in any order
tags: testing, integration, isolation, authorization
---

## Keep Integration Suites Independent and Honest

The integration tier (`test/integration/`, see `test-organize-by-tier`) calls the running API over real HTTP against its real stack (database, storage, events). It shares that stack across specs and across runs, so it needs stricter habits than the in-process tiers.

- **Specs are order-independent.** Each spec creates the state it asserts on, so any spec runs alone. Never read rows another spec created, and never add a sequencer to pin the order: a fixed order hides the dependency instead of catching it.
- **The shared database accumulates.** Specs do not clean up, so rows pile up across runs. Never assert on the position of pre-existing or seeded rows in a page; assert on data the test just created. Assert a total only for a set the test created itself.
- **Count with the total, not the page.** `data.length` is bounded by `limit`; use the response's total count when the claim is about the whole set.
- **Assert the status, then read the body.** Use a client that returns `{ status, headers, body }` without throwing on HTTP errors, and narrow success vs error before reading fields.
- **Keep authorization out of functional tests.** Functional specs run as one default caller with enough permissions to arrange state. Authorization gets its own suite that varies roles, and data isolation between users gets its own suite; both are order-independent like every other spec. A functional failure then reads as "the feature broke", not "a policy changed".
- Structure: the top-level `describe` is the resource (`Orders`); inside it, `VERB /path` blocks in CRUD or lifecycle order, positives beside negatives; a specific scenario of one endpoint gets a parenthetical suffix (`POST /orders/:id/cancel (already shipped)`).
- Run with `--runInBand`: the suites share database state.

**Incorrect (order-dependent, position-based, policy mixed into features):**

```typescript
describe('Orders', () => {
  let orderId: string;

  it('creates an order', async () => {
    const res = await caller.post('/orders', { items: [{ sku: 'SKU-001', quantity: 1 }] });
    orderId = res.body.data.id; // Next spec depends on this one running first
  });

  it('lists orders', async () => {
    const res = await caller.get('/orders?limit=10');
    expect(res.body.data[0].status).toBe('shipped'); // Position of a pre-existing row
    expect(res.body.data.length).toBe(1);             // Page length used as a total
  });

  it('forbids another user from canceling', async () => { // Authorization inside a functional suite
    const res = await as({ userId: OTHER_USER_ID }).post(`/orders/${orderId}/cancel`, {});
    expect(res.status).toBe(404);
  });
});
```

**Correct (self-contained specs, fresh data, separate policy suites):**

```typescript
// test/integration/order/order.spec.ts
describe('Orders', () => {
  describe('POST /orders', () => {
    it('creates an order', async () => {
      const res = await caller.post<Order>('/orders', { items: [{ sku: 'SKU-001', quantity: 1 }] });
      expect(res.status).toBe(201);
    });

    it('rejects an order without items', async () => {
      const res = await caller.post('/orders', { items: [] });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /orders', () => {
    it('includes a just-created order on the first page', async () => {
      const created = await createOrder(); // Arranges its own state
      const res = await caller.get<Order[]>('/orders?limit=100');

      expect(res.status).toBe(200);
      expect(ok(res).data.some((order) => order.id === created.id)).toBe(true);
    });
  });

  describe('POST /orders/:id/cancel (already shipped)', () => {
    it('rejects canceling a shipped order', async () => {
      const order = await createShippedOrder();
      const res = await caller.post(`/orders/${order.id}/cancel`, { reason: 'Changed my mind' });
      expect(res.status).toBe(400);
    });
  });
});

// test/integration/order/order-isolation.spec.ts
describe('Orders isolation', () => {
  describe('POST /orders/:id/cancel', () => {
    it('hides another user\'s order', async () => {
      const order = await createOrder();
      const res = await as({ userId: OTHER_USER_ID }).post(`/orders/${order.id}/cancel`, {});
      expect(res.status).toBe(404);
    });
  });
});
```

Reference: [Jest runInBand](https://jestjs.io/docs/cli#--runinband)
