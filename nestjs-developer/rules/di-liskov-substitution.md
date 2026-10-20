---
title: Honor Liskov Substitution Principle
impact: HIGH
impactDescription: Ensures implementations are truly interchangeable without breaking callers
tags: dependency-injection, inheritance, solid, lsp
---

## Honor Liskov Substitution Principle

Subtypes must be substitutable for their base types without altering program correctness. In NestJS with dependency injection, this means any implementation of an interface or abstract class must honor the contract completely. A mock payment service used in tests must behave like a real payment service (return similar shapes, handle errors the same way). Violating LSP causes subtle bugs when swapping implementations.

**Incorrect (implementation violates the contract):**

```typescript
// Base interface with clear contract
interface PaymentGateway {
  /**
   * Charges the specified amount.
   * @returns PaymentResult on success
   * @throws PaymentFailedException on payment failure
   */
  charge(amount: number, currency: string): Promise<PaymentResult>;
}

// Production implementation - follows the contract
@Injectable()
export class StripePaymentGateway implements PaymentGateway {
  constructor(@Inject(STRIPE_CLIENT) private readonly stripe: Stripe) {}

  async charge(amount: number, currency: string): Promise<PaymentResult> {
    const response = await this.stripe.charges.create({ amount, currency });
    return { success: true, transactionId: response.id, amount };
  }
}

// Mock that violates LSP - different behavior!
@Injectable()
export class MockPaymentService implements PaymentGateway {
  async charge(amount: number, currency: string): Promise<PaymentResult> {
    // VIOLATION 1: Throws for valid input (contract says return PaymentResult)
    if (amount > 1000) {
      throw new Error('Mock does not support large amounts');
    }

    // VIOLATION 2: Returns null instead of PaymentResult
    if (currency !== 'USD') {
      return null as any; // Real service would convert or reject properly
    }

    // VIOLATION 3: Missing required field
    return { success: true } as PaymentResult; // Missing transactionId!
  }
}

// Consumer trusts the contract
@Injectable()
export class OrderService {
  constructor(@Inject(PAYMENT_GATEWAY) private readonly payment: PaymentGateway) {}

  async checkout(order: Order): Promise<void> {
    const result = await this.payment.charge(order.total, order.currency);
    // These fail with MockPaymentService:
    await this.saveTransaction(result.transactionId); // undefined!
    await this.sendReceipt(result); // might be null!
  }
}
```

**Correct (implementations honor the contract):**

```typescript
export const SUPPORTED_CURRENCIES = ['USD', 'EUR', 'GBP'];

// Well-defined interface with documented behavior
interface PaymentGateway {
  /**
   * Charges the specified amount.
   * @param amount - Amount in smallest currency unit (cents)
   * @param currency - ISO 4217 currency code
   * @returns PaymentResult with transactionId, success status, and amount
   * @throws PaymentFailedException if charge is declined
   * @throws InvalidCurrencyException if currency is not supported
   */
  charge(amount: number, currency: string): Promise<PaymentResult>;

  /**
   * Refunds a previous charge.
   * @throws TransactionNotFoundException if transactionId is invalid
   */
  refund(transactionId: string, amount?: number): Promise<RefundResult>;
}

// Production implementation
@Injectable()
export class StripePaymentGateway implements PaymentGateway {
  constructor(@Inject(STRIPE_CLIENT) private readonly stripe: Stripe) {}

  async charge(amount: number, currency: string): Promise<PaymentResult> {
    if (!SUPPORTED_CURRENCIES.includes(currency)) {
      throw new InvalidCurrencyException(`Unsupported currency: ${currency}`);
    }
    try {
      const response = await this.stripe.charges.create({ amount, currency });
      return {
        success: true,
        transactionId: response.id,
        amount: response.amount,
      };
    } catch (error) {
      if (error.type === 'card_error') {
        throw new PaymentFailedException(error.message);
      }
      throw error;
    }
  }

  async refund(transactionId: string, amount?: number): Promise<RefundResult> {
    // Implementation...
  }
}

// test/helpers/fake-payment-gateway.ts - a double that honors LSP: same contract, same behavior shape
export class FakePaymentGateway implements PaymentGateway {
  private readonly transactions = new Map<string, PaymentResult>();
  private sequence = 0;

  async charge(amount: number, currency: string): Promise<PaymentResult> {
    // Honor the contract: validate currency like real service would
    if (!SUPPORTED_CURRENCIES.includes(currency)) {
      throw new InvalidCurrencyException(`Unsupported currency: ${currency}`);
    }

    // Simulate decline for specific test scenarios
    if (amount === 99999) {
      throw new PaymentFailedException('Card declined (test scenario)');
    }

    // Return same shape as production
    const result: PaymentResult = {
      success: true,
      transactionId: `mock_${++this.sequence}`,
      amount,
    };

    this.transactions.set(result.transactionId, result);
    return result;
  }

  async refund(transactionId: string, amount?: number): Promise<RefundResult> {
    // Honor the contract: throw if transaction not found
    if (!this.transactions.has(transactionId)) {
      throw new TransactionNotFoundException(transactionId);
    }

    return {
      success: true,
      refundId: `refund_${transactionId}`,
      amount: amount ?? this.transactions.get(transactionId)!.amount,
    };
  }
}

// Consumer can swap implementations safely
@Injectable()
export class OrderService {
  constructor(@Inject(PAYMENT_GATEWAY) private readonly payment: PaymentGateway) {}

  async checkout(order: Order): Promise<Order> {
    try {
      const result = await this.payment.charge(order.total, order.currency);
      // Works with both StripePaymentGateway and FakePaymentGateway
      order.transactionId = result.transactionId;
      order.status = OrderStatus.Paid;
      return order;
    } catch (error) {
      if (error instanceof PaymentFailedException) {
        order.status = OrderStatus.PaymentFailed;
        return order;
      }
      throw error;
    }
  }
}
```

**Testing LSP compliance:**

```typescript
// test/helpers/payment-gateway.contract.ts - shared suite that every implementation must pass
export function testPaymentGatewayContract(
  createGateway: () => PaymentGateway,
) {
  describe('PaymentGateway contract', () => {
    let gateway: PaymentGateway;

    beforeEach(() => {
      gateway = createGateway();
    });

    it('returns PaymentResult with all required fields', async () => {
      const result = await gateway.charge(1000, 'USD');
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('transactionId');
      expect(result).toHaveProperty('amount');
      expect(typeof result.transactionId).toBe('string');
    });

    it('throws InvalidCurrencyException for unsupported currency', async () => {
      await expect(gateway.charge(1000, 'INVALID'))
        .rejects.toThrow(InvalidCurrencyException);
    });

    it('throws TransactionNotFoundException for invalid refund', async () => {
      await expect(gateway.refund('nonexistent'))
        .rejects.toThrow(TransactionNotFoundException);
    });
  });
}

// test/unit/payment/fake-payment-gateway.spec.ts - the fake has no injected dependencies, so it is
// constructed directly in the unit tier (see test-organize-by-tier)
describe('FakePaymentGateway', () => {
  testPaymentGatewayContract(() => new FakePaymentGateway());
});

// StripePaymentGateway has an injected client, so it is never constructed by hand
// (see di-prefer-constructor-injection): the payment module's e2e suite covers it with
// STRIPE_CLIENT mocked at its token (see test-mock-external-services).
```

Reference: [Liskov Substitution Principle](https://en.wikipedia.org/wiki/Liskov_substitution_principle)
