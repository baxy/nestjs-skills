---
title: Organize by Feature Modules
impact: CRITICAL
impactDescription: Any module's layout is known before opening it, and every new file has one obvious home
tags: architecture, modules, organization, folders
---

## Organize by Feature Modules

Organize the application into feature modules that encapsulate related functionality. Each feature module owns its controllers, services, entities, DTOs and helpers. Never organize the whole app by technical layer (all controllers together, all services together).

Inside a module, **every file lives in a folder named for its type**. Only `{module}.module.ts` stays at the module root, plus `{module}.module-definition.ts` for a configurable module (see `arch-use-dynamic-modules`). Type folders: `controllers/`, `services/`, `entities/`, `dtos/`, `types/`, `constants/`, `utils/`, `validators/`, `guards/`, `strategies/`, `decorators/`, `interceptors/`, `filters/`, `errors/`, `events/` (event payload classes), `listeners/` (`@OnEvent` handlers), `processors/` (queue workers). There is no `repositories/` folder: services use TypeORM's repositories directly (see `arch-data-access-in-services`).

- This is unconditional. A folder holding one file is not redundant: it makes the home of the next file obvious, and the layout of a module you have never opened is known before you look. A threshold ("add a folder once there are three controllers") stops being applied the moment nobody notices the crossing.
- `utils/` holds module-local logic (pure functions and rules that belong to this module). What may move to `src/shared/` is in `arch-shared-folder`.
- `validators/` holds custom `class-validator` decorators (`is-postal-code.validator.ts`).
- Two exceptions, both files that belong to no module: `src/config/` stays flat (one `{concern}.config.ts` per concern, see `devops-use-config-module`; `config/` is already the type folder), and domain-neutral files used by several modules live under `src/shared/`, themselves in type subfolders (see `arch-shared-folder`).
- Top-level files in `src/`: `main.ts`, `app.module.ts` and `configure-app.ts` (global setup shared with tests, see `test-use-testing-module`).
- `src/shared/` is a folder of plain files, **not a Nest module**: no `shared.module.ts`, no services. Something that needs dependency injection and is used by several modules gets its own module named for what it does (`mail/`, `payment/`). See `arch-shared-folder`.

**Names** of the module and of everything in it (singular resource names, the module-name prefix, capability modules) are in `arch-resource-naming`.

**Incorrect (technical layers at the app root, or loose files at the module root):**

```typescript
// Technical layer organization (anti-pattern)
src/
├── controllers/
│   ├── user.controller.ts
│   └── order.controller.ts
├── services/
│   ├── user.service.ts
│   └── order.service.ts
└── app.module.ts

// Feature modules, but files loose at the module root
src/
└── user/
    ├── dto/
    │   └── create-user.dto.ts
    ├── user.controller.ts        // loose
    ├── user-admin.controller.ts   // second controller, still loose
    ├── user.service.ts           // loose
    ├── user.entity.ts             // loose
    ├── slug.ts                    // helper with no obvious home
    └── user.module.ts
```

**Correct (feature modules with type folders):**

```typescript
src/
├── user/
│   ├── controllers/
│   │   ├── user.controller.ts
│   │   └── user-admin.controller.ts
│   ├── services/
│   │   └── user.service.ts
│   ├── entities/
│   │   └── user.entity.ts
│   ├── dtos/
│   │   ├── create-user.dto.ts
│   │   ├── update-user.dto.ts
│   │   ├── find-all-users.query.dto.ts
│   │   └── user-id.param.dto.ts
│   ├── utils/
│   │   └── build-display-name.ts
│   └── user.module.ts            // the only file at the module root
├── order/
│   ├── controllers/
│   ├── services/
│   ├── entities/
│   ├── dtos/
│   └── order.module.ts
├── auth/
│   ├── controllers/
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   └── roles.guard.ts
│   ├── strategies/
│   │   └── jwt.strategy.ts
│   └── auth.module.ts
├── shared/
│   ├── decorators/
│   │   └── auth-user.decorator.ts
│   ├── dtos/
│   │   └── pagination.query.dto.ts
│   ├── types/
│   │   └── jwt-user.ts
│   └── utils/
│       └── slug-generator.ts          // no shared.module.ts: plain reusable files
├── config/
│   ├── app.config.ts
│   ├── auth.config.ts
│   ├── db.config.ts
│   └── validate-env.ts
├── app.module.ts
├── configure-app.ts
└── main.ts

// user/user.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UserController, UserAdminController],
  providers: [UserService],
  exports: [UserService], // Only export what other modules consume
})
export class UserModule {}

// app.module.ts
@Module({
  imports: [
    ConfigModule.forRoot(),
    TypeOrmModule.forRootAsync({ /* ... */ }),
    UserModule,
    OrderModule,
  ],
})
export class AppModule {}
```

See `arch-import-boundaries` for how files in these folders import each other.

Reference: [NestJS Modules](https://docs.nestjs.com/modules)
