---
title: Use Proper Module Sharing Patterns
impact: CRITICAL
impactDescription: Prevents duplicate instances, memory leaks, and state inconsistency
tags: architecture, modules, sharing, exports
---

## Use Proper Module Sharing Patterns

NestJS modules are singletons by default. When a service is properly exported from a module and that module is imported elsewhere, the same instance is shared. However, providing a service in multiple modules creates separate instances, leading to memory waste, state inconsistency, and confusing behavior. Always encapsulate services in dedicated modules, export them explicitly, and import the module where needed.

**Incorrect (service provided in multiple modules):**

```typescript
// StorageService provided directly in multiple modules - WRONG
// storage.service.ts
@Injectable()
export class StorageService {
  private cache = new Map(); // Each instance has separate state!

  store(key: string, value: unknown): void {
    this.cache.set(key, value);
  }
}

// app.module.ts
@Module({
  providers: [StorageService], // Instance #1
  controllers: [AppController],
})
export class AppModule {}

// video.module.ts
@Module({
  providers: [StorageService], // Instance #2 - different from AppModule!
  controllers: [VideoController],
})
export class VideoModule {}

// Problems:
// 1. Two separate StorageService instances exist
// 2. cache.set() in VideoModule doesn't affect AppModule's cache
// 3. Memory wasted on duplicate instances
// 4. Debugging nightmares when state doesn't sync
```

**Correct (dedicated module with exports):**

```typescript
// storage/storage.module.ts
@Module({
  providers: [StorageService],
  exports: [StorageService], // Make available to importers
})
export class StorageModule {}

// video/video.module.ts
@Module({
  imports: [StorageModule], // Import the module, not the service
  controllers: [VideoController],
  providers: [VideoService],
})
export class VideoModule {}

// channel/channel.module.ts
@Module({
  imports: [StorageModule], // Same instance shared
  controllers: [ChannelController],
  providers: [ChannelService],
})
export class ChannelModule {}

// app.module.ts
@Module({
  imports: [
    StorageModule, // Only if AppModule itself needs StorageService
    VideoModule,
    ChannelModule,
  ],
})
export class AppModule {}

// Now all modules share the SAME StorageService instance
```

**Global modules: only third-party infrastructure, registered once in `AppModule`.** `ConfigModule.forRoot({ isGlobal: true })` (see `devops-use-config-module`), the logger module, `ClsModule`, `CacheModule` (see `perf-use-caching`) and `NestjsFormDataModule` (see `api-file-uploads`) are global. Do not write your own `@Global()` modules or give your configurable modules an `isGlobal` option, and never a catch-all `CoreModule`/`CommonModule`/`SharedModule` that bundles unrelated services: it hides what each module depends on, and every consumer gets everything. Plain reusable files go in `src/shared/` and are imported directly (see `arch-shared-folder`); a reusable service gets its own module named for what it does.

```typescript
// Incorrect: a grab-bag module, global so nobody sees who uses what
@Global()
@Module({
  providers: [DateService, MailService, PdfService],
  exports: [DateService, MailService, PdfService],
})
export class CommonModule {}

// Correct: one module per capability, imported where it is used
@Module({ providers: [MailService], exports: [MailService] })
export class MailModule {}

@Module({ imports: [MailModule], providers: [OrderService] })
export class OrderModule {}
```

**Re-export only what consumers need from you.** A module may re-export a module whose providers its consumers use directly, so they do not configure it a second time:

```typescript
// auth/auth.module.ts - a WebSocket gateway in another module verifies handshake tokens with
// JwtService, so AuthModule re-exports the JwtModule it configured (the HTTP guards are global
// and need no import, see security-use-guards)
@Module({
  imports: [UserModule, PassportModule, JwtModule.registerAsync({ /* ... */ })],
  providers: [JwtStrategy, SessionService],
  exports: [JwtModule],
})
export class AuthModule {}
```

Reference: [NestJS Modules](https://docs.nestjs.com/modules#shared-modules)
