---
title: Make Reusable Modules Configurable
impact: MEDIUM
impactDescription: Reusable modules without hardcoded config or hand-rolled forRoot boilerplate
tags: architecture, modules, dynamic-modules, configuration
---

## Make Reusable Modules Configurable

When a module wraps infrastructure that needs configuration (mail, storage, an API client) and is reused across apps or instantiated more than once, expose it as a dynamic module with `forRoot`/`forRootAsync` instead of reading `process.env` inside it or hardcoding values. A module used by one app only can inject its config namespace directly (see `devops-use-config-module`). Use `ConfigurableModuleBuilder` to generate the static methods, the options token, and the async variant instead of writing them by hand. Always provide the async variant so consumers can build options from their config namespace.

The options interface is the module's whole configuration contract. The module never imports from the app's `src/config/`, injects `ConfigService` or reads `process.env`: those tie it to one app's variable names. The app maps its own namespace into the options (see `devops-use-config-module`). A module shared by several apps in a monorepo lives as a library under `libs/` (`nest g library`), where it cannot reach an app's `src/config/` at all.

**Incorrect (config read inside the module, or a hand-rolled sync-only forRoot):**

```typescript
// Reads env directly - can't be configured per consumer or in tests
@Injectable()
export class MailService {
  private readonly apiKey = process.env.MAIL_API_KEY!;
  private readonly from = 'noreply@example.com';
}

// Hand-rolled forRoot - no forRootAsync, so consumers can't use ConfigService
@Module({})
export class MailModule {
  static forRoot(options: MailModuleOptions): DynamicModule {
    return {
      module: MailModule,
      providers: [{ provide: 'MAIL_OPTIONS', useValue: options }, MailService],
      exports: [MailService],
    };
  }
}
```

**Correct (ConfigurableModuleBuilder with async configuration):**

```typescript
// mail/mail.module-definition.ts - the one other file allowed at a module root (see arch-feature-modules)
export interface MailModuleOptions {
  apiKey: string;
  from: string;
}

export const {
  ConfigurableModuleClass,
  MODULE_OPTIONS_TOKEN: MAIL_OPTIONS,
} = new ConfigurableModuleBuilder<MailModuleOptions>()
  .setClassMethodName('forRoot')
  .build(); // No isGlobal extra: consumers import the module where they use it (see arch-module-sharing)

// mail/mail.module.ts
@Module({
  providers: [MailService],
  exports: [MailService],
})
export class MailModule extends ConfigurableModuleClass {}

// mail/services/mail.service.ts
@Injectable()
export class MailService {
  constructor(@Inject(MAIL_OPTIONS) private readonly options: MailModuleOptions) {}
}

// notification/notification.module.ts - configures MailModule once, mapping the app's mail namespace
// (src/config/mail.config.ts, see devops-use-config-module) onto its options, and re-exports it
// (see arch-module-sharing); forRootAsync also accepts useClass/useExisting
@Module({
  imports: [
    MailModule.forRootAsync({
      inject: [mailConfig.KEY],
      useFactory: (mailSettings: ConfigType<typeof mailConfig>) => ({ apiKey: mailSettings.apiKey, from: mailSettings.from }),
    }),
  ],
  providers: [NotificationService],
  exports: [NotificationService, MailModule], // Importers get the configured MailService
})
export class NotificationModule {}

// order/order.module.ts - a module that sends mail imports the configuring module
@Module({ imports: [NotificationModule], providers: [OrderService] })
export class OrderModule {}

// Tests pass plain options
MailModule.forRoot({ apiKey: 'test', from: 'test@example.com' });
```

Configure the module in exactly one place, in a module that re-exports it, and import that module wherever the service is needed. Do not configure it in `AppModule`: feature modules do not see `AppModule`'s imports, and importing plain `MailModule` in a feature module creates a second instance without options, so Nest fails at startup with "can't resolve dependencies of the MailService" (`MAIL_OPTIONS`).

Naming convention: `forRoot` configures a module once for the whole app, `forFeature` configures it per consuming module (like `TypeOrmModule.forFeature`), and `register` creates a separately configured instance for each import.

Reference: [NestJS Dynamic Modules](https://docs.nestjs.com/fundamentals/dynamic-modules#configurable-module-builder)
