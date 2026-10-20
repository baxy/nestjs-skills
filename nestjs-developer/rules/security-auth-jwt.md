---
title: Authenticate with a Passport JWT Strategy That Builds JwtUser
impact: CRITICAL
impactDescription: Every handler receives a complete, verified caller, or the request is refused
tags: security, jwt, authentication, passport, tokens
---

## Authenticate with a Passport JWT Strategy That Builds JwtUser

Authentication has one mechanism: a `passport-jwt` strategy (`JwtStrategy`) behind a global `JwtAuthGuard` (see `security-use-guards`). The strategy verifies the token and turns its claims into a `JwtUser`, the one type for the authenticated caller. Handlers receive it with `@AuthUser()` (see `api-custom-param-decorators`), and services take it as their first parameter (see `arch-service-conventions`).

**`JwtUser` has no optional fields, and `validate()` refuses a token that cannot fill one.** An `undefined` id reaches TypeORM as a dropped `WHERE` condition, so a query scoped to the caller answers with every caller's rows. Refusing the token is what makes the type true.

- Verify signature, expiry, issuer and audience. With your own signing key, read it from config (`auth.jwt.*`, see `devops-use-config-module`); with an external identity provider (Auth0, Cognito), use `secretOrKeyProvider` from `jwks-rsa` and the provider's issuer and audience.
- Build `JwtUser` from the claims only. Do not load the user from the database on every request; services that need more than the claims load it themselves. A deactivated or deleted user therefore keeps access until their access token expires, which is why access tokens live minutes.
- **The refresh exchange checks the user again.** It loads the user and refuses (401) one that no longer exists or is deactivated, and builds the new access token from the user's current roles, so a role change takes effect at the next refresh. Deactivating or deleting a user revokes their refresh tokens.
- Never put secrets or personal data beyond what `JwtUser` needs into a token you issue.
- Tokens you issue: short-lived access tokens (minutes), and refresh tokens that are random, stored hashed with SHA-256 (they are high-entropy, so a slow password hash adds nothing and prevents lookup), and revocable. Passwords are the opposite case: see `security-hash-passwords`.

**Incorrect (hardcoded secret, untyped payload, partial users accepted):**

```typescript
@Module({
  imports: [JwtModule.register({ secret: 'my-secret-key', signOptions: { expiresIn: '7d' } })], // Secret in code, long-lived
})
export class AuthModule {}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({ jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), secretOrKey: 'my-secret-key' });
  }

  async validate(payload: any): Promise<any> {
    return payload; // Raw claims; a token without `sub` yields a user with no id
  }
}
```

**Correct (configured strategy, complete JwtUser or refusal):**

```typescript
// shared/types/jwt-user.ts - the authenticated caller; every field required
export type JwtUser = {
  id: string;
  email: string;
  roles: Role[];
};

// src/config/auth.config.ts - AUTH_JWT_SECRET, AUTH_JWT_ISSUER and AUTH_JWT_AUDIENCE are listed
// in validate-env.ts, so the empty defaults never reach the strategy (see devops-use-config-module)
export const authConfig = registerAs('auth', () => ({
  jwt: {
    secret: process.env.AUTH_JWT_SECRET || '',
    issuer: process.env.AUTH_JWT_ISSUER || '',
    audience: process.env.AUTH_JWT_AUDIENCE || '',
    accessTokenTtl: process.env.AUTH_JWT_ACCESS_TOKEN_TTL || '15m',
  },
}));

// auth/strategies/jwt.strategy.ts
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@Inject(authConfig.KEY) authSettings: ConfigType<typeof authConfig>) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: authSettings.jwt.secret,
      issuer: authSettings.jwt.issuer,
      audience: authSettings.jwt.audience,
      ignoreExpiration: false,
    });
  }

  validate(payload: JwtPayload): JwtUser {
    if (!payload.sub || !payload.email || !Array.isArray(payload.roles)) {
      throw new UnauthorizedException('Token is missing required claims');
    }
    return { id: payload.sub, email: payload.email, roles: payload.roles };
  }
}

// auth/auth.module.ts
@Module({
  imports: [
    UserModule, // UserService.verifyCredentials (see security-hash-passwords)
    PassportModule,
    JwtModule.registerAsync({
      inject: [authConfig.KEY],
      useFactory: (authSettings: ConfigType<typeof authConfig>) => ({
        secret: authSettings.jwt.secret,
        signOptions: {
          expiresIn: authSettings.jwt.accessTokenTtl,
          issuer: authSettings.jwt.issuer,
          audience: authSettings.jwt.audience,
        },
      }),
    }),
  ],
  controllers: [SessionController],
  providers: [JwtStrategy, SessionService],
})
export class AuthModule {}

// auth/services/session.service.ts - issuing tokens (POST /sessions, see api-controller-conventions)
@Injectable()
export class SessionService {
  constructor(
    @InjectRepository(RefreshToken)
    private readonly refreshTokenRepository: Repository<RefreshToken>,
    private readonly jwtService: JwtService,
    private readonly userService: UserService,
  ) {}

  async create(dto: CreateSessionDto): Promise<SessionResponseDto> {
    const user = await this.userService.verifyCredentials(dto.email, dto.password); // 401 on any mismatch
    const accessToken = this.jwtService.sign({ sub: user.id, email: user.email, roles: user.roles });
    const refreshToken = randomBytes(32).toString('hex');

    await this.refreshTokenRepository.save({
      userId: user.id,
      tokenHash: this._hash(refreshToken),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    });

    return { accessToken, refreshToken };
  }

  private _hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
```

Reference: [NestJS Passport](https://docs.nestjs.com/recipes/passport) · [passport-jwt](https://github.com/mikenicholson/passport-jwt)
