---
title: Use Injection Tokens for Interfaces
impact: HIGH
impactDescription: Implementations can be swapped per environment or in tests without touching consumers
tags: dependency-injection, tokens, interfaces
---

## Use Injection Tokens for Interfaces

TypeScript interfaces do not exist at runtime, so they cannot be injection tokens. Inject an abstraction through a `Symbol` token declared next to the interface, or through an abstract class (which exists at runtime and needs no `@Inject`). Do not use string tokens: two modules can pick the same string by accident, and a typo fails only at startup.

- The token, the interface and the production binding live in the module that owns the abstraction (`payment/types/payment-gateway.ts`).
- Choose the implementation from config (see `devops-use-config-module`), never from `process.env.NODE_ENV`.
- Test doubles live in `test/`, and tests swap them in with `overrideProvider()` or a provider in the testing module. Production modules never import a mock.

**Incorrect (interface as a type-only token, mock selected by NODE_ENV):**

```typescript
@Injectable()
export class OrderService {
  constructor(private readonly paymentGateway: PaymentGateway) {} // Interface: nothing to inject at runtime
}

@Module({
  providers: [
    {
      provide: 'PAYMENT_GATEWAY', // String token
      useClass: process.env.NODE_ENV === 'test' ? MockPaymentGateway : StripePaymentGateway, // Mock shipped in production code
    },
  ],
})
export class PaymentModule {}
```

**Correct (Symbol token, binding in the owning module, doubles in tests):**

```typescript
// payment/types/payment-gateway.ts
export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');

export interface PaymentResult {
  success: boolean;
  transactionId: string;
  amount: number;
}

export interface PaymentGateway {
  charge(amount: number, currency: string): Promise<PaymentResult>;
}

// payment/payment.module.ts
@Module({
  providers: [
    StripePaymentGateway,
    { provide: PAYMENT_GATEWAY, useExisting: StripePaymentGateway },
  ],
  exports: [PAYMENT_GATEWAY],
})
export class PaymentModule {}

// order/services/order.service.ts
@Injectable()
export class OrderService {
  constructor(@Inject(PAYMENT_GATEWAY) private readonly paymentGateway: PaymentGateway) {}
}

// test/e2e/order/order.spec.ts - the double replaces the binding
const moduleRef = await Test.createTestingModule({ /* ... */ })
  .overrideProvider(PAYMENT_GATEWAY)
  .useValue(new FakePaymentGateway()) // test/helpers/fake-payment-gateway.ts
  .compile();

// Alternative: an abstract class is its own token
export abstract class PaymentGateway {
  abstract charge(amount: number, currency: string): Promise<PaymentResult>;
}

@Module({ providers: [{ provide: PaymentGateway, useClass: StripePaymentGateway }], exports: [PaymentGateway] })
export class PaymentModule {}

@Injectable()
export class OrderService {
  constructor(private readonly paymentGateway: PaymentGateway) {} // No @Inject needed
}
```

Reference: [NestJS Custom Providers](https://docs.nestjs.com/fundamentals/custom-providers)
