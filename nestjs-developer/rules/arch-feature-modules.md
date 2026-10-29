---
title: Organize by Feature Modules
impact: CRITICAL
impactDescription: Any module's layout is known before opening it, and every new file has one obvious home
tags: architecture, modules, organization, folders
---

## Organize by Feature Modules

Organize the application into feature modules that encapsulate related functionality. Each feature module owns its controllers, services, entities (or models), DTOs and helpers. Never organize the whole app by technical layer.

Inside a module, **every file lives in a folder named for its type**. Only `{module}.module.ts` stays at the module root. Type folders: `controllers/`, `services/`, `entities/` (TypeORM) or schema references (Prisma), `dtos/`, `types/`, `constants/`, `utils/`, `validators/`, `guards/`, `strategies/`, `decorators/`, `interceptors/`, `filters/`, `errors/`, `events/`, `listeners/`, `processors/`.

There is no `repositories/` folder. Services use the ORM client directly (see `arch-data-access-in-services`).

### Data access registration

**TypeORM:** `TypeOrmModule.forFeature([User])` in the feature module.

**Prisma:** the global `PrismaModule` provides `PrismaService`. Feature modules do not import a Prisma module unless you choose a non-global setup.

### Shared layout rules

- `src/config/` stays flat. `src/shared/` holds domain-neutral files used by two or more modules, in type folders, no services.
- Top-level files in `src/`: `main.ts`, `app.module.ts`, `configure-app.ts`.
- Names of modules and files follow `arch-resource-naming`.

**Incorrect (technical layers at the app root):**

```
src/
├── controllers/
├── services/
└── app.module.ts
```

**Correct (feature modules with type folders):**

```
src/
├── user/
│   ├── controllers/
│   ├── services/
│   ├── entities/          # TypeORM
│   ├── dtos/
│   └── user.module.ts
├── prisma/               # Prisma only
│   ├── prisma.service.ts
│   └── prisma.module.ts
├── config/
├── app.module.ts
└── main.ts
```

Reference: [NestJS Modules](https://docs.nestjs.com/modules)
