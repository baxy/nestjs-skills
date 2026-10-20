---
title: Hash Passwords with Argon2id in One Provider
impact: CRITICAL
impactDescription: A leaked database does not reveal passwords, and login does not reveal which accounts exist
tags: security, passwords, hashing, argon2, bcrypt, authentication
---

## Hash Passwords with Argon2id in One Provider

A password is stored only as a slow, salted hash. New code uses Argon2id from the `argon2` package; a project that already stores bcrypt hashes may keep bcrypt (below). Never store the plain text, never use a fast hash (SHA-256, MD5), and never encrypt a password: one leaked key would reveal every password. High-entropy tokens are a different case and are hashed with SHA-256 (see `security-auth-jwt`).

- **One provider knows the algorithm.** `PasswordHasher` in the user module hashes, verifies and decides when to rehash. It is not exported (see `arch-module-sharing`): other modules go through `UserService`.
- **Hash before the entity exists.** The service turns `CreateUserDto.password` into `passwordHash` before calling `repository.create()`. No column is named `password`, and `passwordHash` carries `@Exclude()` + `@ApiHideProperty()` (see `api-use-dto-serialization`).
- **Parameters are explicit**: `type: argon2id`, `memoryCost: 19_456` (19 MiB), `timeCost: 2`, `parallelism: 1`, the OWASP minimum. Raise them, never lower them. When they change, `needsRehash()` upgrades each stored hash at the user's next successful login.
- **bcrypt is accepted where it is already in use**, never chosen for new code. Use the native `bcrypt` package (not `bcryptjs`, which hashes on the main thread) with cost 12 or more, and cap the password at 72 **bytes** with `@IsByteLength(1, 72)`. bcrypt silently ignores everything after byte 72, so two passwords that share those bytes both log in, and multi-byte UTF-8 reaches 72 bytes well before 72 characters.
- **Moving from bcrypt to Argon2id needs no migration job.** `verify()` accepts both formats (`$2b$...` and `$argon2id$...`) and `needsRehash()` is true for every bcrypt hash, so each user moves to Argon2id at their next successful login.
- **Always use the async API.** Hashing takes tens of milliseconds and runs on libuv's thread pool; a sync call blocks the event loop for every request.
- **Login reveals nothing.** An unknown email and a wrong password get the same `401 Invalid email or password`, and an unknown email is still verified against a dummy hash so both paths take the same time. Rate-limit the endpoint (see `security-rate-limiting`).
- **Never transform a password.** No `trim()` or lowercasing in the DTO; length limits are 12 to 128 characters (see `security-validate-all-input`), plus 72 bytes on bcrypt, and the upper limit also caps the hashing cost.
- **A password change** requires the current password (`ChangePasswordDto`, see `api-use-mapped-types`) and revokes the user's refresh tokens (see `security-auth-jwt`).
- Passwords never appear in logs (see `devops-use-logging`) or error messages.

**Incorrect (plain text, fast or reversible hashes, a login that leaks accounts):**

```typescript
await this.userRepository.save(this.userRepository.create(dto)); // dto.password stored as-is

passwordHash: createHash('sha256').update(dto.password).digest('hex'); // Fast: billions of guesses per second on a GPU
passwordHash: encrypt(dto.password, key);                              // Reversible: one leaked key reveals every password

const user = await this.userRepository.findOne({ where: { email } });
if (!user) {
  throw new NotFoundException('No account with this email');          // Tells an attacker which emails exist
}
if (user.passwordHash !== sha256(password)) {                         // Fast hash, non-constant-time comparison
  throw new UnauthorizedException('Wrong password');
}
```

**Correct (one hashing provider, uniform login failure):**

```typescript
// user/services/password-hasher.ts - the only code that knows the algorithm; not exported from UserModule
import * as argon2 from 'argon2';
import * as bcrypt from 'bcrypt'; // Only while bcrypt hashes from before the switch remain

const HASH_OPTIONS = { type: argon2.argon2id, memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;
const BCRYPT_PREFIX = /^\$2[aby]\$/;

@Injectable()
export class PasswordHasher implements OnModuleInit {
  private dummyHash = '';

  async onModuleInit(): Promise<void> {
    // Verified against when the email is unknown, so both login paths take the same time
    this.dummyHash = await argon2.hash(randomBytes(32).toString('hex'), HASH_OPTIONS);
  }

  hash(password: string): Promise<string> {
    return argon2.hash(password, HASH_OPTIONS);
  }

  async verify(hash: string | null, password: string): Promise<boolean> {
    if (hash !== null && BCRYPT_PREFIX.test(hash)) {
      return bcrypt.compare(password, hash); // Legacy hash; rehashed to Argon2id after this login
    }
    const matches = await argon2.verify(hash ?? this.dummyHash, password);
    return hash !== null && matches;
  }

  needsRehash(hash: string): boolean {
    return BCRYPT_PREFIX.test(hash) || argon2.needsRehash(hash, HASH_OPTIONS);
  }
}

// user/services/user.service.ts
@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly passwordHasher: PasswordHasher,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    // Duplicate email check: see error-throw-http-exceptions
    return this.userRepository.save(await this._toEntity(dto));
  }

  // Called by SessionService (auth module) for POST /sessions; email is normalized by CreateSessionDto
  async verifyCredentials(email: string, password: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { email } });
    const valid = await this.passwordHasher.verify(user?.passwordHash ?? null, password);
    if (!user || !valid) {
      throw new UnauthorizedException('Invalid email or password'); // Same answer for both failures
    }
    if (this.passwordHasher.needsRehash(user.passwordHash)) {
      await this.userRepository.update(user.id, { passwordHash: await this.passwordHasher.hash(password) });
    }
    return user;
  }

  private async _toEntity(dto: CreateUserDto): Promise<User> {
    const { password, ...fields } = dto;
    return this.userRepository.create({ ...fields, passwordHash: await this.passwordHasher.hash(password) });
  }
}

// user/user.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UserController],
  providers: [UserService, PasswordHasher],
  exports: [UserService], // PasswordHasher stays internal
})
export class UserModule {}
```

**A project that stays on bcrypt** keeps the same class and the same `UserService`; only the internals and the DTO limit change:

```typescript
// user/services/password-hasher.ts - bcrypt variant, for a project that already stores bcrypt hashes
const BCRYPT_COST = 12;

hash(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

async verify(hash: string | null, password: string): Promise<boolean> {
  const matches = await bcrypt.compare(password, hash ?? this.dummyHash); // dummyHash made with bcrypt in onModuleInit
  return hash !== null && matches;
}

needsRehash(hash: string): boolean {
  return bcrypt.getRounds(hash) < BCRYPT_COST;
}

// user/dtos/create-user.dto.ts - bcrypt reads only the first 72 bytes
@ApiProperty({ description: 'Initial password, 12 to 128 characters and at most 72 bytes', example: 'correct-horse-battery' })
@IsString()
@MinLength(12)
@MaxLength(128)
@IsByteLength(1, 72)
password: string;
```

Reference: [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) · [node-argon2](https://github.com/ranisalt/node-argon2)
