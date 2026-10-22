---
title: Use Async Lifecycle Hooks Correctly
impact: HIGH
impactDescription: The app accepts traffic only once its dependencies are ready, and starts without blocking the event loop
tags: performance, lifecycle, async, hooks
---

## Use Async Lifecycle Hooks Correctly

Nest awaits the promise returned by `onModuleInit` and `onApplicationBootstrap` before it starts listening. Use that:

- **Return (or `await`) the async work** in a hook. A promise started without being returned lets the app accept requests before the dependency is ready.
- **Constructors stay synchronous and cheap.** No I/O, no `readFileSync`, no connection attempts.
- `onModuleInit` prepares the module's own resources; `onApplicationBootstrap` runs once every module is initialized, so it may call other modules' services (cache warm-up). Do not rely on the order in which other modules' `onModuleInit` hooks run: NestJS 12 orders them by module hierarchy level, which can differ from earlier versions.
- Close clients and connections in `onApplicationShutdown`, once the HTTP server has stopped serving, never in a signal handler (see `devops-graceful-shutdown`).
- Settings come from config (see `devops-use-config-module`); never write your own `ConfigService`.

**Incorrect (fire-and-forget init, blocking constructor):**

```typescript
@Injectable()
export class SearchIndexService implements OnModuleInit {
  onModuleInit(): void {
    this._connect(); // Not returned: the app starts before the client is connected
  }

  private async _connect(): Promise<void> {
    await this.client.connect();
  }
}

@Injectable()
export class PricingRulesService {
  private readonly rules: PricingRule[];

  constructor() {
    this.rules = JSON.parse(fs.readFileSync('pricing-rules.json', 'utf8')); // Blocks module instantiation
  }
}
```

**Correct (awaited hooks, cheap constructors):**

```typescript
@Injectable()
export class SearchIndexService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(SearchIndexService.name);

  constructor(@Inject(SEARCH_CLIENT) private readonly client: SearchClient) {}

  async onModuleInit(): Promise<void> {
    await this.client.connect(); // Nest waits for this before listening
    this.logger.log('Search client connected');
  }

  async onApplicationShutdown(): Promise<void> {
    await this.client.close(); // After in-flight requests have finished
  }
}

@Injectable()
export class PricingRulesService implements OnModuleInit {
  private rules: PricingRule[] = [];

  constructor(@Inject(pricingConfig.KEY) private readonly pricingSettings: ConfigType<typeof pricingConfig>) {}

  async onModuleInit(): Promise<void> {
    const file = await fs.promises.readFile(this.pricingSettings.rulesPath, 'utf8');
    this.rules = JSON.parse(file) as PricingRule[];
  }
}

// Runs after every module is initialized: safe to use another module's service
@Injectable()
export class CatalogCacheWarmer implements OnApplicationBootstrap {
  constructor(
    private readonly productService: ProductService,
    private readonly catalogCache: CatalogCache,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.catalogCache.warm(await this.productService.findPopular());
  }
}
```

Reference: [NestJS Lifecycle Events](https://docs.nestjs.com/fundamentals/lifecycle-events)
