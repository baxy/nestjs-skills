---
title: PrismaService as Injectable Singleton with Lifecycle
impact: HIGH
impactDescription: One shared client, proper connect and disconnect
tags: database, prisma, setup, lifecycle
---

## PrismaService as Injectable Singleton with Lifecycle

Create a single `PrismaService` that extends `PrismaClient` (or wraps the generated client in Prisma 7+/8) and implements NestJS lifecycle hooks. Make the module global so every feature can inject it. Never create new `PrismaClient` instances inside services.

**Incorrect (new client per request or missing disconnect):**

```typescript
@Injectable()
export class UsersService {
  async findAll() {
    const prisma = new PrismaClient(); // New connection pool every call
    return prisma.user.findMany();
  }
}
```

**Correct (singleton with lifecycle, Prisma 6 style):**

```typescript
// src/prisma/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}

// src/prisma/prisma.module.ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

For Prisma 7+ with the driver adapter, pass the adapter in the constructor and still call `$connect` / `$disconnect` in the hooks. Import `PrismaModule` once in `AppModule`.

Reference: [Prisma NestJS guide](https://www.prisma.io/docs/guides/frameworks/nestjs)
