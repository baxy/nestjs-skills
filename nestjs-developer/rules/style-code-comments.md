---
title: Comment Only What the Code Cannot Say
impact: MEDIUM
impactDescription: Code stays readable, and the comments that remain are true and worth reading
tags: style, comments, naming, readability, todo
---

## Comment Only What the Code Cannot Say

The default is **no comment**. Names carry the meaning: a variable, function, constant, class or module named for what it holds or does needs no sentence beside it. Comments are not checked by the compiler or the tests, so they drift from the code they describe, and a wrong comment costs more than a missing one: the reader trusts it.

**Before writing a comment, change the code instead:**

- A comment that says what a block does becomes a function named for it: `// check the order can be canceled` becomes `this._assertCancelable(order)`.
- A comment that explains a value becomes a named constant: `30 * 60 * 1000 // 30 minutes` becomes `const PAYMENT_WINDOW_MS = 30 * 60 * 1000`.
- A comment that explains a condition becomes a named boolean or method: `if (order.status === 'paid' && !order.shippedAt)` becomes `if (order.awaitsShipment())`.
- A comment that lists allowed values becomes a type or an enum.
- A comment that gives a unit becomes part of the name: `price: number; // in cents` becomes `priceCents: number`, `timeout // ms` becomes `timeoutMs`.

**Write a comment only when the code cannot carry the information, and then say why, not what:**

- **A reason that comes from outside the code**: a provider's limit, a spec, a security parameter. `// OWASP minimum for Argon2id: raise, never lower`.
- **A subtle invariant or ordering** that a reasonable edit would break, and that no name or type can express.
- **A complex algorithm**: one or two lines on the approach, with a link to the source it follows. Not a narration of each step.
- **A workaround**, with the issue link and the condition for removing it: `// Workaround for typeorm#1234: remove when upgrading past 1.2`.
- **A TODO**, with a ticket and a concrete action: `// TODO(SHOP-412): replace the polling with the provider's webhook`. A TODO without a ticket is forgotten; one without an action cannot be done.

Keep each comment short, on its own line above the code it explains.

**Never write:**

- What the code does, line by line, or what a name or type already says (`// Find the user`, `@param id the id`).
- A convention these rules already state (`// Hardcoded, never from config`, `// Outermost first`): the rule lives in the rules, not at each place that follows it.
- Details of other files, which change without this file changing (`// Shared by main.ts and test/helpers/create-test-app.ts`, `// Called by SessionService for POST /sessions`). A reason may say that other modules depend on this code (`// Not scoped to a caller: other modules look users up by id`); it does not name them or describe what they do.
- Statements tied to the moment of writing (`// For the endpoints that come next`, `// New`, `// Temporary`) without a ticket, including reasons that hold only until a later change (`// There are no write routes yet, so the specs insert rows directly`). Put those in the PR description or a `TODO(ticket)`.
- History: who changed what, when, or why the previous version was wrong (`// Fixed the race`, `// Added for PR #212`). That belongs in the commit message.
- Commented-out code, section banners (`// ===== Helpers =====`), or a comment on every member of a class.

**The comments in these rules' examples are notes for you**, explaining the example. They are not part of the pattern: never copy them into code.

**Stale comments.** A comment that no longer matches its code is a defect. When you change code, update or delete every comment about it in the same change. Delete stale, wrong or redundant comments you find in the files your change touches. In other files, list them in your summary instead of editing files outside the change.

Before keeping a comment, ask: would a reader who has the code and these rules lose anything if it were deleted? If not, delete it.

Swagger `description`s and `summary`s are API documentation for clients, required by `api-document-with-openapi`, not code comments. Test names (`describe('POST /orders/:id/cancel')`, `it('returns 400 for a shipped order')`) do the same job for tests: name the behavior instead of commenting it.

**Incorrect (comments that narrate, repeat, go stale or replace a name):**

```typescript
// ==================== Order cancellation ====================
@Injectable()
export class OrderService {
  /**
   * Cancels an order.
   * @param authUser the user
   * @param id the order id
   * @returns the order
   */
  async cancel(authUser: JwtUser, id: string): Promise<Order> {
    // Find the order for this user
    const order = await this.orderRepository.findOne({ where: { id, userId: authUser.id } });
    if (!order) throw new NotFoundException(`Order #${id} not found`);

    // Check status (pending and shipped can be canceled)
    if (order.status !== OrderStatus.Pending && order.status !== OrderStatus.Paid) {
      throw new BadRequestException(`An order in status ${order.status} cannot be canceled`);
    }

    // Fixed: used to save a spread copy, now uses merge (see PR #212)
    // await this.orderRepository.save({ ...order, status: OrderStatus.Canceled });
    return this.orderRepository.save(
      this.orderRepository.merge(order, { status: OrderStatus.Canceled, canceledAt: new Date() }),
    );
  }

  // Payment window
  isExpired(order: Order): boolean {
    return Date.now() - order.createdAt.getTime() > 1_800_000;
  }
}
```

The status comment is already stale: it says shipped orders can be canceled, the code says paid ones can.

**Correct (names carry the meaning, the one comment says why):**

```typescript
const CANCELABLE_STATUSES: readonly OrderStatus[] = [OrderStatus.Pending, OrderStatus.Paid];
// The payment provider voids an unpaid authorization after 30 minutes
const PAYMENT_WINDOW_MS = 30 * 60 * 1000;

@Injectable()
export class OrderService {
  async cancel(authUser: JwtUser, id: string): Promise<Order> {
    const order = await this._findOwnedOrder(authUser, id);
    this._assertCancelable(order);
    return this.orderRepository.save(
      this.orderRepository.merge(order, { status: OrderStatus.Canceled, canceledAt: new Date() }),
    );
  }

  isPaymentWindowExpired(order: Order): boolean {
    return Date.now() - order.createdAt.getTime() > PAYMENT_WINDOW_MS;
  }

  private _assertCancelable(order: Order): void {
    if (!CANCELABLE_STATUSES.includes(order.status)) {
      throw new BadRequestException(`An order in status ${order.status} cannot be canceled`);
    }
  }
}
```

Reference: [Google style guide: comments and TODOs](https://google.github.io/styleguide/cppguide.html#Comments) · [Clean Code, chapter 4: Comments](https://www.oreilly.com/library/view/clean-code-a/9780136083238/)
