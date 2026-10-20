# NestJS Anti-Patterns

Rule IDs in brackets refer to `../nestjs-developer/rules/<rule-id>.md`, relative to the `nestjs-reviewer` skill folder.

## Contents
- Controller: fat controllers, direct repository access
- Service: god service, tight coupling to infrastructure
- Dependency injection: manual instantiation, circular dependencies
- Module: monolithic AppModule, over-exporting
- Error handling: swallowing errors, exposing internal errors, losing validation details
- Testing: mocking the service under test, interaction-only tests, allow-path-only guard tests, wrong tier, no isolation
- Configuration: hardcoded configuration

## Controller Anti-Patterns

### Fat Controllers [api-controller-conventions]
Business logic in controllers makes code untestable and violates single responsibility.

```typescript
// ❌ Anti-pattern: Business logic in controller
@Post('register')
async register(@Body() dto: RegisterDto) {
  const existing = await this.userRepository.findOne({ where: { email: dto.email } });
  if (existing) throw new ConflictException('Email exists');

  const hash = await bcrypt.hash(dto.password, 12);

  const user = this.userRepository.create({ ...dto, password: hash });
  await this.userRepository.save(user);

  const token = this.jwtService.sign({ sub: user.id });
  await this.emailService.sendWelcome(user.email);

  return { user, token }; // Also leaks the password hash
}
```

**Fix**: Move the logic to a service, return a response DTO, keep the controller thin.

### Direct Repository Access in Controllers [api-controller-conventions]
Controllers should never access repositories directly - always go through a service.

```typescript
// ❌ Anti-pattern
@Controller('products')
export class ProductController {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
  ) {}
}

// ✅ Fix: Inject the service instead
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}
}
```

## Service Anti-Patterns

### God Service [arch-single-responsibility]
A service that handles too many concerns becomes a maintenance nightmare.

```typescript
// ❌ Anti-pattern: Service handling users, orders, payments, emails
@Injectable()
export class AppService {
  async createUser() { /* ... */ }
  async processOrder() { /* ... */ }
  async chargePayment() { /* ... */ }
  async sendEmail() { /* ... */ }
  async generateReport() { /* ... */ }
}
```

**Fix**: Split into focused services - `UserService`, `OrderService`, `PaymentService`, etc.

### Tight Coupling to Infrastructure [di-use-interfaces-tokens]
Services that call infrastructure directly (HTTP APIs, file system, a specific vendor) are hard to test and replace.

```typescript
// ❌ Anti-pattern: Direct infrastructure dependency
@Injectable()
export class NotificationService {
  async send(email: string, message: string) {
    await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.SENDGRID_KEY}` },
      body: JSON.stringify({ to: email, content: message }),
    });
  }
}

// ✅ Fix: Depend on an abstraction injected via a token
export interface EmailProvider {
  send(to: string, content: string): Promise<void>;
}
export const EMAIL_PROVIDER = Symbol('EMAIL_PROVIDER');

@Injectable()
export class NotificationService {
  constructor(
    @Inject(EMAIL_PROVIDER) private readonly emailProvider: EmailProvider,
    private readonly userService: UserService,
  ) {}

  async send(userId: string, message: string): Promise<void> {
    const user = await this.userService.findById(userId);
    await this.emailProvider.send(user.email, message);
  }
}
```

## Dependency Injection Anti-Patterns

### Manual Instantiation [di-prefer-constructor-injection]
Creating injectable services with `new` bypasses the DI container: no lifecycle management, no shared instance, not mockable.

```typescript
// ❌ Anti-pattern
@Injectable()
export class OrderService {
  private cache = new CacheService(); // Not managed by DI, not mockable
}

// ✅ Fix
@Injectable()
export class OrderService {
  // new Logger(Class.name) is the standard NestJS pattern - don't flag it
  private readonly logger = new Logger(OrderService.name);

  constructor(private readonly cache: CacheService) {}
}
```

### Circular Dependencies [arch-avoid-circular-deps]
Two services depending on each other signal a missing boundary.

```typescript
// ❌ Anti-pattern: Circular dependency
@Injectable()
export class UserService {
  constructor(private orderService: OrderService) {}
}

@Injectable()
export class OrderService {
  constructor(private userService: UserService) {}
}

// ✅ Preferred fix: break the cycle with an event (or extract a shared service)
@Injectable()
export class OrderService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(authUser: JwtUser, dto: CreateOrderDto): Promise<Order> {
    const order = await this.orderRepository.save(this.orderRepository.create({ ...dto, userId: authUser.id }));
    this.eventEmitter.emit('order.created', new OrderCreatedEvent(order.id, authUser.id));
    return order;
  }
}

// ⚠️ Last resort only: forwardRef hides the design problem, and needs a comment saying why
@Injectable()
export class OrderService {
  constructor(
    @Inject(forwardRef(() => UserService)) // forwardRef: <why this cycle cannot be broken>
    private readonly userService: UserService,
  ) {}
}
```

## Module Anti-Patterns

### Monolithic AppModule [arch-feature-modules]
Placing all controllers, services, and entities in AppModule destroys modularity.

```typescript
// ❌ Anti-pattern
@Module({
  imports: [TypeOrmModule.forFeature([User, Order, Product, Invoice, Report])],
  controllers: [UserCtrl, OrderCtrl, ProductCtrl, InvoiceCtrl, ReportCtrl],
  providers: [UserSvc, OrderSvc, ProductSvc, InvoiceSvc, ReportSvc],
})
export class AppModule {}
```

### Over-Exporting [arch-module-sharing]
Exporting everything from a module breaks encapsulation.

```typescript
// ❌ Anti-pattern: Exporting internal implementation details
@Module({
  providers: [UserService, PasswordHasher, UserMapper],
  exports: [UserService, PasswordHasher, UserMapper],
})
export class UserModule {}

// ✅ Fix: Export only the public API
@Module({
  providers: [UserService, PasswordHasher, UserMapper],
  exports: [UserService],
})
export class UserModule {}
```

## Error Handling Anti-Patterns

### Swallowing Errors [error-handle-async-errors]
Catching errors without handling or logging hides bugs.

```typescript
// ❌ Anti-pattern
async findUser(id: string) {
  try {
    return await this.userRepository.findOne({ where: { id } });
  } catch (error) {
    return null; // A database outage now looks like "user not found"
  }
}
```

### Exposing Internal Errors [error-use-exception-filters]
Sending raw error messages or stack traces to clients leaks internals.

```typescript
// ❌ Anti-pattern
catch (error) {
  throw new HttpException(error.stack, 500); // Stack trace exposed
}

// ✅ Fix: generic message for the client, original error kept as the cause
catch (error) {
  throw new InternalServerErrorException('Could not process order', { cause: error });
}
```

### Losing Validation Details in a Global Filter [error-use-exception-filters]

```typescript
// ❌ Anti-pattern: every validation error becomes "Bad Request Exception"
const message = exception instanceof HttpException ? exception.message : 'Internal server error';

// ✅ Fix: read the message from exception.getResponse()
```

## Testing Anti-Patterns

### Mocking the Service Under Test [test-use-testing-module]
A suite that mocks the service it is named after only proves the controller calls it, and passes while the service is broken.

```typescript
// ❌ Anti-pattern: the service is mocked in its own suite
providers: [{ provide: UserService, useValue: { create: jest.fn() } }],

// ✅ Fix: real service, mocks at the repository boundary, driven over HTTP
providers: [
  UserService,
  { provide: getRepositoryToken(User), useValue: userRepository },
],
// ...
const res = await request(app.getHttpServer()).post('/users').send(dto);
expect(res.status).toBe(201);
expect(userRepository.save).toHaveBeenCalledWith(expect.objectContaining({ email: dto.email }));
```

### Only Testing Interactions [test-use-testing-module]
Tests that only assert which mock was called don't prove the result is right. Assert the status and body, and the repository call where it is the observable effect.

```typescript
// ❌ Anti-pattern: only the interaction is checked
it('creates a user', async () => {
  await request(app.getHttpServer()).post('/users').send(dto);
  expect(userRepository.save).toHaveBeenCalled();
});

// ✅ Fix: positive and negative paths, outcome asserted
describe('POST /users', () => {
  it('creates a user', async () => {
    userRepository.findOne.mockResolvedValue(null);
    userRepository.save.mockResolvedValue({ id: USER_ID, ...dto });

    const res = await request(app.getHttpServer()).post('/users').send(dto);

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ id: USER_ID, email: dto.email });
  });

  it('rejects a duplicate email', async () => {
    userRepository.findOne.mockResolvedValue({ id: USER_ID, email: dto.email });

    const res = await request(app.getHttpServer()).post('/users').send(dto);

    expect(res.status).toBe(409);
  });
});
```

### Only Testing the Allow Path of Guards [test-guards-and-interceptors]
A guard test that only checks that authorized users get in will never catch an authorization bypass. Test that unauthorized users are rejected.

### Tests in the Wrong Tier [test-organize-by-tier]
A spec in `src/`, a "unit" test that needs a database, or two spec files over the same routes. Each test belongs to exactly one tier under `test/`, decided by what it needs to run.

### No Test Isolation [test-integration-suites]
Tests that depend on shared state or execution order are fragile.

```typescript
// ❌ Anti-pattern: Shared mutable state between tests
describe('UserService', () => {
  const users = [];

  it('creates a user', () => {
    users.push(createUser());
    expect(users).toHaveLength(1);
  });

  it('checks user count', () => {
    expect(users).toHaveLength(1); // Depends on previous test
  });
});
```

## Configuration Anti-Patterns

### Hardcoded Configuration [devops-use-config-module]
Hardcoded values can't change per environment and leak secrets into source control. Settings come from `src/config/{concern}.config.ts` namespaces: inject the namespace for several values, or read a single value with a namespaced key.

```typescript
// ❌ Anti-pattern
@Injectable()
export class DatabaseService {
  private readonly host = 'localhost';
  private readonly password = 'secretpassword';
}

// ✅ Fix: inject the config namespace (src/config/db.config.ts)
@Injectable()
export class DatabaseService {
  constructor(@Inject(dbConfig.KEY) private readonly dbSettings: ConfigType<typeof dbConfig>) {}

  getConfig() {
    return { host: this.dbSettings.host, port: this.dbSettings.port };
  }
}
```
