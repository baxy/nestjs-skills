---
title: Keep src/shared/ for Domain-Neutral Files Used by Several Modules
impact: HIGH
impactDescription: Shared code has one obvious home, business rules stay with the module that owns them, and no provider is instantiated twice
tags: architecture, shared, modules, utils, dtos, decorators
---

## Keep src/shared/ for Domain-Neutral Files Used by Several Modules

`src/shared/` is a folder of plain files that several modules import directly. It is **not a Nest module**: there is no `shared.module.ts` and no `SharedModule`. A file belongs there only when it passes all three tests:

1. **It is used by at least two modules**, or it is one of the app-wide pieces these rules give every module (below). A helper with one consumer lives in that module's type folder (`order/utils/`). When a second module needs it, move it to `shared/` in that change; when it drops back to one consumer, move it back; when nothing uses it, delete it.
2. **It is domain-neutral.** It knows no module's business rules: pagination, slugs, a unique-violation check, tenant-scoped ids. Logic that encodes one module's rules (who may view content, how an order total is computed) stays in that module, and other modules import it through the `@/` alias (see `arch-import-boundaries`). A shared file whose name wants a module prefix (`organization-label.ts`, `order-total.ts`) belongs in that module.
3. **It is not a provider that needs registering.** Services, controllers and entities never go in `shared/`. An injectable used by several modules gets its own module, named for what it does, that provides and exports it once (`storage-client/` exporting `StorageClientService`, see `arch-module-sharing`). Listing the same class in several modules' `providers` creates one instance per module.

**The app-wide pieces** are shared by design, whatever the module count: `dtos/pagination.query.dto.ts` and the `PaginatedResult` type (see `perf-optimize-database`), `decorators/auth-user.decorator.ts`, `decorators/public.decorator.ts`, `decorators/roles.decorator.ts` and `types/jwt-user.ts` (see `api-custom-param-decorators`, `security-use-guards`), `types/app-request.ts` (see `api-platform-agnostic`), the Swagger envelope decorators (see `api-document-with-openapi`), and the global filter and interceptors registered in `configureApp()` (see `error-use-exception-filters`, `api-use-interceptors`). So are the files they depend on (the `Role` enum behind `JwtUser`, a helper the global filter calls).

**Dependencies point into `shared/`, never out of it.** A shared file never imports from a module. The root wiring files (`app.module.ts`, `main.ts`, `configure-app.ts`) and the app-wide pieces each count as a consumer: what the app's wiring uses is app-wide. A helper used by the global filter and by one module, for example: `unique-violation.ts`, called by the global filter and by one module, stays in `shared/`, because moving it into the module would make the filter import from that module.

**Layout and names:**

- Every file sits in a type folder: `dtos/`, `types/`, `utils/`, `decorators/`, `constants/`, `errors/`, `validators/`, and `guards/`, `interceptors/`, `filters/` for the global ones. Nothing at the `shared/` root, and no folder named for a feature (`shared/acl/`) or for a kind of provider (`shared/services/`).
- Names describe the concern and carry no module prefix: `pagination.query.dto.ts`, `slug-generator.ts`, `unique-violation.ts`, `raw-bearer.decorator.ts`. DTO files follow `api-dto-naming` (`organization-id.param.dto.ts`, never `organization-id-param.dto.ts`).
- In a `shared/` folder that already breaks these rules, new files follow them; existing files are moved in a separate refactor, not as part of an unrelated change (the same as `arch-resource-naming`).

**Incorrect (a service, domain rules, loose files and single-consumer helpers in shared):**

```typescript
src/shared/
├── services/
│   └── storage-client.service.ts     // Listed in the providers of three modules: three instances
├── acl/
│   └── content-visibility.ts         // The content-share module's access rules, in a feature folder
├── internal-caller.ts                // Loose at the root
├── organization-label.ts             // Used by one module, and named for one
├── dtos/
│   └── organization-id-param.dto.ts  // -param instead of .param
└── utils/
    ├── assert-single-payload.ts      // One consumer
    └── validate-id.ts                // No consumer at all

// artifact.module.ts, asset.module.ts and tactic.module.ts each repeat:
providers: [ArtifactService, StorageClientService],
```

**Correct (domain-neutral files used by several modules; services and rules in their modules):**

```typescript
src/
├── shared/
│   ├── constants/
│   │   └── system-user.constants.ts   // SYSTEM_USER_ID, used by four modules
│   ├── decorators/
│   │   └── auth-user.decorator.ts     // App-wide
│   ├── dtos/
│   │   ├── organization-id.param.dto.ts
│   │   └── pagination.query.dto.ts    // App-wide
│   ├── types/
│   │   └── jwt-user.ts                // App-wide
│   └── utils/
│       ├── slug-generator.ts          // Two modules
│       └── unique-violation.ts        // Five modules
├── storage-client/                    // Injectable used by several modules: its own module
│   ├── services/
│   │   └── storage-client.service.ts
│   └── storage-client.module.ts       // providers and exports: [StorageClientService]
├── content-share/
│   ├── services/
│   │   └── content-share-visibility.service.ts  // Exported; artifact, asset and tactic inject it
│   └── content-share.module.ts
└── primitive/
    └── utils/
        └── assert-single-payload.ts   // Its only consumer
```

Reference: [NestJS Modules: shared modules](https://docs.nestjs.com/modules#shared-modules)
