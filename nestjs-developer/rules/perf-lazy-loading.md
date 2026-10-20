---
title: Use Lazy Loading for Large Modules
impact: MEDIUM
impactDescription: Improves startup time for large applications
tags: performance, lazy-loading, modules, optimization
---

## Use Lazy Loading for Large Modules

NestJS can lazy-load a module, deferring its initialization until first use. This is valuable where cold start time matters (serverless, CLI) and a module is heavy and rarely needed.

- **Only modules without controllers, gateways or resolvers.** A lazy-loaded module's routes are never registered, so HTTP-facing modules always load eagerly.
- Import it through the `@/` alias like any cross-module import (see `arch-import-boundaries`).
- Resolving providers from the lazy module with `moduleRef.get()` is one of the two allowed uses of `ModuleRef` (see `di-avoid-service-locator`).

**Incorrect (loading everything eagerly):**

```typescript
// Load everything eagerly in a large app
@Module({
  imports: [
    UserModule,
    OrderModule,
    PaymentModule,
    PdfRenderingModule, // Heavy (headless browser), used by one job
    BulkImportModule,   // Used once a month
  ],
})
export class AppModule {}

// All modules initialize at startup, even if never used
// Slow cold starts in serverless
// Memory wasted on unused modules
```

**Correct (lazy load rarely-used modules):**

```typescript
// invoice/services/invoice-pdf.service.ts - loads the PDF module on first use, then reuses it
@Injectable()
export class InvoicePdfService {
  private pdfModuleRef: ModuleRef | null = null;

  constructor(private readonly lazyModuleLoader: LazyModuleLoader) {}

  async render(invoice: Invoice): Promise<Buffer> {
    const moduleRef = await this._pdfModule();
    return moduleRef.get(PdfRenderer).render('invoice', invoice);
  }

  private async _pdfModule(): Promise<ModuleRef> {
    if (!this.pdfModuleRef) {
      const { PdfRenderingModule } = await import('@/pdf-rendering/pdf-rendering.module');
      this.pdfModuleRef = await this.lazyModuleLoader.load(() => PdfRenderingModule);
    }
    return this.pdfModuleRef;
  }
}
```

Reference: [NestJS Lazy Loading Modules](https://docs.nestjs.com/fundamentals/lazy-loading-modules)
