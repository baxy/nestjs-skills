---
title: Keep Import Paths Aligned with Module Boundaries
impact: MEDIUM
impactDescription: Cross-module dependencies are visible at a glance and survive file moves
tags: architecture, imports, modules, path-alias
---

## Keep Import Paths Aligned with Module Boundaries

The import path tells the reader whether a dependency stays inside the module or crosses into another one.

- **Inside a module, import relatively**: `./dtos/create-order.dto` from the module root, `../services/order.service` from inside a type folder.
- **Across modules, use the `@/` alias with the module name first**: `@/payment/services/payment.service`.
- **Never reach into a sibling module with a relative path** (`../../payment/...`).
- **Never use the alias for the importing module's own files.**

With this, `grep -r "from '@/payment/" src` lists every consumer of the payment module, and moving a module only breaks the imports that genuinely cross into it.

**Incorrect (relative paths across modules, alias inside a module):**

```typescript
// src/order/services/order.service.ts
import { PaymentService } from '../../payment/services/payment.service'; // Crosses a module boundary relatively
import { CreateOrderDto } from '@/order/dtos/create-order.dto';             // Alias for the module's own file
import { Order } from '../../order/entities/order.entity';                  // Detour out of and back into the module
```

**Correct (relative within, alias across):**

```typescript
// src/order/services/order.service.ts
import { PaymentService } from '@/payment/services/payment.service';
import { PaginationQueryDto } from '@/shared/dtos/pagination.query.dto';
import { CreateOrderDto } from '../dtos/create-order.dto';
import { Order } from '../entities/order.entity';

// src/order/order.module.ts
import { OrderController } from './controllers/order.controller';
import { OrderService } from './services/order.service';
```

```jsonc
// tsconfig.json - no baseUrl: TypeScript 6 rejects it, and paths resolve from the tsconfig
{ "compilerOptions": { "paths": { "@/*": ["./src/*"] } } }
```

Tests reach their subject through the same alias; the runner reads it as shown in `references/test-runner-vitest.md` or `references/test-runner-jest.md`. In an ESM project every import, the alias included, ends in `.js` (`@/payment/services/payment.service.js`); see `references/project-setup.md`.

Reference: [TypeScript paths](https://www.typescriptlang.org/tsconfig/#paths)
