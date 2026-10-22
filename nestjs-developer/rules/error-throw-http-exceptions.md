---
title: Throw HTTP Exceptions from Services
impact: HIGH
impactDescription: Keeps controllers thin and error statuses decided where the rule lives
tags: error-handling, exceptions, services
---

## Throw HTTP Exceptions from Services

In an HTTP application, services throw `HttpException` subclasses directly: `NotFoundException` for a missing (or not visible) resource, `BadRequestException` for invalid input or a domain rule the request breaks (an illegal state transition, insufficient stock), `ConflictException` when the request clashes with existing data (a duplicate, a concurrent change), `ForbiddenException` when a rule forbids the caller an action on a resource it can see. Never return error objects for the controller to inspect.

A service that is also used outside HTTP (a queue processor, a CLI) throws a domain error class instead, such as `EntityNotFoundException`. The global filter maps it to a status (see `error-use-exception-filters`); do not add a second filter for it.

When a client needs to tell two errors with the same status apart (an email already taken versus a username already taken, insufficient stock versus a closed store), give the exception an `errorCode`: `throw new ConflictException('Email already registered', { errorCode: 'EMAIL_TAKEN' })`. Codes are `UPPER_SNAKE_CASE` and never change once clients use them; the message can still be reworded. The global filter copies the code into the error response (see `error-use-exception-filters`). Errors no client branches on need no code. The option exists from NestJS 12; on NestJS 11, pass the code in the response object instead: `new ConflictException({ message: 'Email already registered', errorCode: 'EMAIL_TAKEN' })`.

Messages may include identifiers that were validated by a DTO (a UUID from `UserIdParamDto`); never echo unvalidated input back (see `security-sanitize-output`).

**Incorrect (return error objects instead of throwing):**

```typescript
@Injectable()
export class UserService {
  async findById(id: string): Promise<{ user?: User; error?: string }> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      return { error: 'User not found' }; // Every caller must remember to check
    }
    return { user };
  }
}

@Controller('users')
export class UserController {
  @Get(':id')
  async findById(@Param() params: UserIdParamDto) {
    const result = await this.userService.findById(params.id);
    if (result.error) {
      throw new NotFoundException(result.error);
    }
    return result.user;
  }
}
```

**Correct (the service throws, the controller returns):**

```typescript
@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User #${id} not found`);
    }
    return user;
  }

  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.userRepository.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    return this.userRepository.save(await this._toEntity(dto)); // _toEntity hashes the password (see security-hash-passwords)
  }

  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id); // Throws if not found
    return this.userRepository.save(this.userRepository.merge(user, dto));
  }
}

@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get(':id')
  findById(@Param() params: UserIdParamDto): Promise<User> {
    return this.userService.findById(params.id);
  }
}

// shared/errors/entity-not-found.exception.ts - for services also used outside HTTP;
// AllExceptionsFilter maps it to 404
export class EntityNotFoundException extends Error {
  constructor(
    public readonly entity: string,
    public readonly id: string,
  ) {
    super(`${entity} #${id} not found`);
  }
}
```

Reference: [NestJS Built-in HTTP exceptions](https://docs.nestjs.com/exception-filters#built-in-http-exceptions)
