---
title: Cache Expensive Reads with Explicit Keys and Invalidation
impact: HIGH
impactDescription: Cuts database load for hot reads without serving stale or another caller's data
tags: performance, caching, redis, cache-manager
---

## Cache Expensive Reads with Explicit Keys and Invalidation

Cache data that is expensive to compute and read far more often than it changes. Every cache entry has a key that identifies exactly what it holds, a TTL, and an invalidation path when the data changes.

- Use `@nestjs/cache-manager` with a shared store (Redis) when more than one instance runs; an in-memory cache differs per instance. The connection comes from the `redis` config namespace (`redis.host`, `redis.port`, see `devops-use-config-module`), shared with the queues (see `micro-use-queues`).
- TTLs are in **milliseconds** (cache-manager v5 and later).
- **Caller-dependent data needs the caller in the key.** The built-in `CacheInterceptor` keys by URL only, so use it only on routes whose response is the same for every caller (public catalogs, reference data). Everything else is cached in the service, with the user or organization id in the key.
- **A cache hit is a plain object, not an entity.** The shared store keeps JSON, so `ClassSerializerInterceptor` skips `@Exclude()` on what comes back (see `api-use-dto-serialization`) and hidden columns reach the client. In the service, rebuild instances on read with `plainToInstance(Entity, cached)`. On a route cached by `CacheInterceptor`, add `@SerializeOptions({ type: Entity })` so the serializer converts the cached value before applying `@Exclude()`.
- Invalidate on write: delete the affected keys in the service method that changes the data, or in a listener for the change event (see `arch-use-events`).
- Interceptors only run on controllers and handlers; `@UseInterceptors(CacheInterceptor)` on a service method does nothing.

**Incorrect (caller-blind interceptor, static key, no invalidation):**

```typescript
@Controller('orders')
@UseInterceptors(CacheInterceptor) // Keyed by URL: user B gets user A's cached GET /orders
export class OrderController {
  @Get(':id')
  @CacheKey('order')                // One key for every id: every GET /orders/:id returns the same order
  @CacheTTL(3_600_000)
  findById(@AuthUser() authUser: JwtUser, @Param() params: OrderIdParamDto): Promise<Order> {
    return this.orderService.findById(authUser, params.id);
  }
}
```

**Correct (shared store, keyed entries in the service, invalidation on write):**

```typescript
// app.module.ts
@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [redisConfig.KEY],
      useFactory: (redisSettings: ConfigType<typeof redisConfig>) => ({
        stores: [new KeyvRedis(`redis://${redisSettings.host}:${redisSettings.port}`)],
        ttl: 60_000, // Default 60 s
      }),
    }),
  ],
})
export class AppModule {}

// product/services/product.service.ts - caller-independent data, explicit keys
const POPULAR_PRODUCTS_KEY = 'products:popular';

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async findPopular(): Promise<Product[]> {
    const cached = await this.cache.get<Product[]>(POPULAR_PRODUCTS_KEY);
    if (cached) {
      return plainToInstance(Product, cached); // Plain JSON from Redis: rebuild instances so @Exclude() applies
    }
    const products = await this._queryPopular();
    await this.cache.set(POPULAR_PRODUCTS_KEY, products, 5 * 60_000); // 5 min
    return products;
  }

  async update(id: string, dto: UpdateProductDto): Promise<Product> {
    const product = await this.productRepository.findOneBy({ id });
    if (!product) {
      throw new NotFoundException(`Product #${id} not found`);
    }
    const updated = await this.productRepository.save(this.productRepository.merge(product, dto));
    await this.cache.del(POPULAR_PRODUCTS_KEY); // Invalidate on write
    return updated;
  }

  private _queryPopular(): Promise<Product[]> {
    return this.productRepository
      .createQueryBuilder('product')
      .orderBy('product.orderCount', 'DESC')
      .take(20)
      .getMany();
  }
}

// category/controllers/category.controller.ts - same response for every caller: the interceptor is fine
@UseInterceptors(CacheInterceptor)
@Controller('categories')
export class CategoryController {
  @Public()
  @CacheTTL(30 * 60_000) // 30 min: categories rarely change
  @SerializeOptions({ type: Category }) // Cache hits are plain objects: convert them so @Exclude() still applies
  @Get()
  findAll(): Promise<Category[]> {
    return this.categoryService.findAll();
  }
}
```

Reference: [NestJS Caching](https://docs.nestjs.com/techniques/caching)
